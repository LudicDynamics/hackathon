#!/usr/bin/env node
/**
 * Merge-log gate (`pnpm check:merge`) — AGENTS.md §6.6, docs/merge/00-合并纪律.md.
 *
 * The bug this exists to catch: a merge lands and nobody can say, afterwards,
 * HOW its conflicts were resolved. `git log --merges` records that a merge
 * happened and nothing else — the reasoning lives in the author's scrollback and
 * dies with it. 813c0f3 lost the inbound `airp_init` WS frame that way: a
 * two-parent merge dropped it silently (the server handler survived, so it read
 * as "half-chain", not "deleted"), and it took a hand audit two days later to
 * find it (docs/settings/00 §6).
 *
 * The remedy is a REGISTRY: every merge on this branch's first-parent line must
 * have `docs/merge/<title>-<7hex>-<author>.md` (00-合并纪律.md §2). A merge
 * commit is not pushable until its entry exists — enforced at push time by
 * `tools/git-hooks/pre-push` and at review time by this gate.
 *
 * Scope is FIRST-PARENT merges of HEAD, not "all merges reachable": those are
 * the merges that landed on the line you are about to push. Registering the
 * branch-internal merges (merging main INTO a feature branch) is strongly
 * recommended and quoted by the main-line entry — see 00-合并纪律.md §3 — but it
 * is not what this gate can see from HEAD, so it is not what it fails on.
 *
 * Merges older than the norm are GRANDFATHERED by explicit SHA in
 * `docs/merge/BASELINE.md`. A SHA list, not a date, because a date is a clock
 * the gate cannot trust; the baseline is auditable line by line.
 *
 * The core (`evaluate`) is pure so `tools/check-merge-log.test.mjs` can drive it
 * without a git repo — a gate that never fires is coverage theatre.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MERGE_DIR = path.join(REPO, 'docs', 'merge');
const BASELINE_PATH = path.join(MERGE_DIR, 'BASELINE.md');

/** The three sections every entry MUST carry (00-合并纪律.md §2.2). */
export const REQUIRED_SECTIONS = ['## 1. 这次合了什么', '## 2. 冲突处理', '## 3. 验证'];

/** `<title>-<7hex>-<author>.md`, applying the LAST '-' pair (titles may contain dashes). */
export const ENTRY_RE = /^(.+)-([0-9a-f]{7})-([a-z0-9][a-z0-9-]*)\.md$/;

/** Parse a 40-hex baseline row: `- <sha>  # <note>`. */
export function parseBaseline(text) {
  const shas = new Set();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*([0-9a-f]{40})\b/);
    if (m) shas.add(m[1]);
  }
  return shas;
}

/** Pull `- <sha>` rows out of a `git log` render (tab- or space-separated). */
export function parseMergeLog(out) {
  const merges = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    // <full sha>\t<short>\t<subject>\t<parent sha> <parent sha>
    const [sha, short, subject, parentsField] = line.split('\t');
    if (!sha || sha.length !== 40) continue;
    merges.push({
      sha,
      short: short ?? sha.slice(0, 7),
      subject: subject ?? '',
      parents: (parentsField ?? '').split(/\s+/).filter(Boolean).map((p) => p.slice(0, 7)),
    });
  }
  return merges;
}

/**
 * Pure core. `merges` = [{ sha, short, subject, parents:[7hex…] }],
 * `entries` = [{ file, sha7, author, text }], `baseline` = Set<full sha>.
 * Returns findings; `[]` means clean.
 */
export function evaluate({ merges, entries, baseline }) {
  const findings = [];

  // V0 — a vacuous pass is the failure mode that hides everything below: an
  // empty baseline means the file was not parsed, so every merge would look
  // "grandfathered"; an empty merge list means the git call returned nothing.
  if (baseline.size === 0) findings.push('BASELINE.md lists no merge SHAs — the baseline was not read (00-合并纪律.md §4)');
  if (!Array.isArray(merges) || merges.length === 0) {
    findings.push('no merge commits found on the first-parent line — is this a shallow clone, or is HEAD detached?');
  }

  const bySha7 = new Map();
  for (const e of entries) {
    if (!bySha7.has(e.sha7)) bySha7.set(e.sha7, []);
    bySha7.get(e.sha7).push(e);
  }

  const seen = new Set();
  for (const m of merges ?? []) {
    seen.add(m.short);
    if (baseline.has(m.sha)) continue;

    const hits = bySha7.get(m.short) ?? [];
    if (hits.length === 0) {
      findings.push(
        `unregistered merge ${m.short} ("${m.subject}"): write docs/merge/<title>-${m.short}-<author>.md ` +
          `(00-合并纪律.md §2) — a merge is not pushable until its entry exists`
      );
      continue;
    }
    if (hits.length > 1) {
      findings.push(`merge ${m.short} has ${hits.length} entries (${hits.map((h) => h.file).join(', ')}) — keep one`);
    }

    const entry = hits[0];
    for (const section of REQUIRED_SECTIONS) {
      if (!entry.text.includes(section)) {
        findings.push(`${entry.file}: missing section "${section}" (00-合并纪律.md §2.2)`);
      }
    }
    // The entry must be self-locating: the merge it documents and BOTH parents,
    // so a reader can run `git show` without guessing (00-合并纪律.md §2.2).
    if (!entry.text.includes(`\`${m.short}\``)) {
      findings.push(`${entry.file}: does not cite the merge \`${m.short}\``);
    }
    for (const p of m.parents) {
      if (p && !entry.text.includes(`\`${p}\``)) {
        findings.push(`${entry.file}: does not cite parent \`${p}\``);
      }
    }
    // §2 is the whole point: an entry that resolves nothing is not a record.
    const body = (entry.text.split(REQUIRED_SECTIONS[1])[1] ?? '').split(REQUIRED_SECTIONS[2])[0] ?? '';
    if (body.trim().length < 40) {
      findings.push(`${entry.file}: "## 2. 冲突处理" is empty — record HOW the conflicts were resolved, not that they were`);
    }
  }

  // An entry for a merge that is not on this line is not a failure (a
  // branch-internal merge registered on the branch), only worth seeing.
  for (const e of entries) {
    if (!seen.has(e.sha7)) {
      findings.push(`note: ${e.file} documents ${e.sha7}, which is not a first-parent merge of HEAD`);
    }
  }

  return findings;
}

/** Read every `docs/merge/*.md` EXCEPT the contract and the baseline. */
export function readEntries(dir = MERGE_DIR) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    if (name === 'BASELINE.md' || name.startsWith('00-')) continue;
    const m = name.match(ENTRY_RE);
    if (!m) continue;
    out.push({
      file: `docs/merge/${name}`,
      sha7: m[2],
      author: m[3],
      text: fs.readFileSync(path.join(dir, name), 'utf-8'),
    });
  }
  return out;
}

function gitLogFirstParentMerges() {
  const out = execFileSync(
    'git',
    ['log', '--merges', '--first-parent', '--format=%H%x09%h%x09%s%x09%p', 'HEAD'],
    { cwd: REPO, encoding: 'utf-8' }
  );
  return parseMergeLog(out);
}

function main() {
  const quiet = process.argv.includes('--quiet');
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`FAIL  ${path.relative(REPO, BASELINE_PATH)} is missing (00-合并纪律.md §4)`);
    process.exit(1);
  }
  const baseline = parseBaseline(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  // %H%x09%h%x09%s%x09%p — %p can hold two SHAs; join them back with a space
  // because parseMergeLog splits on TAB, not space.
  const merges = gitLogFirstParentMerges();
  const findings = evaluate({ merges, entries: readEntries(), baseline });

  const hard = findings.filter((f) => !f.startsWith('note:'));
  if (!quiet) {
    for (const f of findings) console.log(`  ${f.startsWith('note:') ? '~~' : 'FAIL'}  ${f}`);
    console.log(
      `\n  ${merges.length} first-parent merge(s), ${baseline.size} grandfathered, ` +
        `${readEntries().length} entry file(s)`
    );
  }
  if (hard.length > 0) {
    console.error(`\n${hard.length} MERGE-LOG ASSERTION(S) FAILED`);
    process.exit(1);
  }
  console.log(`\n${quiet ? '' : 'ALL MERGE-LOG ASSERTIONS PASSED'}`);
}

// Only run when invoked directly (the test imports the pure core).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
