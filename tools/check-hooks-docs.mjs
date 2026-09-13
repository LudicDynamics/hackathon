#!/usr/bin/env node
/**
 * check-hooks-docs.mjs — mechanical consistency gate for the design docs.
 *
 * Born from the B2/B3 review gate (5 independent reviewers converged): the batch's
 * "frozen contract" was frozen only in prose. Ten-plus cross-doc contradictions
 * (barrel export lists, sentinel strings, DDL columns, symbol names) survived
 * because *nothing could fail* when two docs disagreed. The B1 post-mortem's rule
 * applies: **a contract that cannot be mechanically checked is not frozen.**
 *
 * Checks (each is a defect a batch actually contained):
 *   1. SYMBOL OWNERSHIP — a symbol in a landing table must have ONE owning file.
 *   2. BARREL UNION      — every barrel module any doc requires must be listed by
 *                          every doc that publishes a barrel list; union diffed.
 *   3. SENTINEL LITERAL  — frozen string literals must be byte-identical.
 *   4. FILE:LINE CITATION— every citation of an EXISTING file must resolve; line
 *                          numbers must be in range. Planned/NEW files are exempt.
 *   5. GHOST SYMBOL      — `Pick<X,...>` / "owns X" must name a declared symbol.
 *
 * Checks 1–3 and 5 are scoped to the hooks batch (their notion of "ownership" and
 * "barrel union" only makes sense inside one batch contract). **Check 4 runs over a
 * wider citation corpus** (`CITE_DIRS` + `CITE_FILES`) because a dead path is a
 * dead path anywhere — and the entry docs whose path tables drift most are the
 * ones most worth guarding (2026-09-13: §7.8/`assets/README.md` both described a
 * gitignore that had already changed).
 *
 * Usage: node tools/check-hooks-docs.mjs [--json]
 * Exit: 0 clean, 1 findings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HOOKS = path.join(REPO, 'docs/hooks');
const JSON_OUT = process.argv.includes('--json');
const rel = (abs) => path.relative(REPO, abs).split(path.sep).join('/');

const load = (name, abs) => ({ name, text: fs.readFileSync(abs, 'utf-8'), lines: fs.readFileSync(abs, 'utf-8').split('\n') });

// Checks 1–3, 5: the hooks batch contract only.
const docs = fs
  .readdirSync(HOOKS)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort()
  .map((f) => load(f, path.join(HOOKS, f)));

// Check 4 (citations): a WIDER corpus. A dead path is a dead path wherever it is
// written, and the entry docs (AGENTS.md's directory tree, assets/README.md) are
// exactly where path tables go stale unnoticed. Only the hooks batch docs carry
// the batch contract, so only they feed checks 1–3/5 — but all of these are
// scanned for citations.
const CITE_DIRS = ['docs/hooks', 'docs/audio'];
const CITE_FILES = ['AGENTS.md', 'assets/README.md'];
const citeDocs = [];
for (const dir of CITE_DIRS) {
  const abs = path.join(REPO, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) {
    if (/\.md$/.test(f)) citeDocs.push(load(`${dir}/${f}`, path.join(abs, f)));
  }
}
for (const f of CITE_FILES) {
  const abs = path.join(REPO, f);
  if (fs.existsSync(abs)) citeDocs.push(load(f, abs));
}

// Git-tracked paths under assets/ — used to tell a REPO asset (must exist; e.g.
// `assets/audio/PLAN.md`) from a WORLD-RELATIVE path that merely shares the
// `assets/` prefix (`<worldRoot>/assets/audio/rain.mp3`, a test fixture). The
// prefix alone cannot distinguish them; the tracked set can.
const trackedAssetDirs = new Set();
try {
  const tracked = execSync('git ls-files assets', { cwd: REPO, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  for (const t of tracked) {
    const parts = t.split('/');
    for (let i = 1; i < parts.length; i++) trackedAssetDirs.add(parts.slice(0, i).join('/'));
  }
} catch {
  // Not a git checkout (or assets/ absent): asset citations simply aren't checked.
}

const findings = [];
const report = (check, doc, line, message, fix) => findings.push({ check, doc, line, message, fix });

// A repo path as the first cell of a table row is a PLANNED artifact (landing
// table) — expected not to exist yet.
const PLANNED = new Set();
for (const d of docs) {
  for (const line of d.lines) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cell = t.replace(/^\||\|$/g, '').split('|')[0].trim().replace(/`/g, '');
    if (/^(?:packages|apps|extensions|tools|vendor)\/[\w/\-.]+\.(?:tsx|json|mjs|ts|js)$/.test(cell)) {
      PLANNED.add(cell);
    }
  }
}

// ---------------------------------------------------------------- 1. symbols
const PATH_CELL = /^`?(packages\/shared\/src\/[\w/\-.]+\.ts|extensions\/[\w/\-.]+\.ts|apps\/[\w-]+\/src\/[\w/\-.]+\.ts)`?$/;
const SYM = /`([A-Z][A-Za-z0-9_]{2,})`/g;
const ownerOf = new Map();
for (const d of docs) {
  d.lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t.startsWith('|')) return;
    const cells = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < 2) return;
    const m = cells[0].match(PATH_CELL);
    if (!m) return;
    for (const sym of cells[1].matchAll(SYM)) {
      const s = sym[1];
      if (!ownerOf.has(s)) ownerOf.set(s, new Map());
      const byFile = ownerOf.get(s);
      if (!byFile.has(m[1])) byFile.set(m[1], []);
      byFile.get(m[1]).push(`${d.name}:${i + 1}`);
    }
  });
}

// A doc with an odd number of ``` fences has a broken code block — it swallows
// the rest of the doc into a fence (found live while fixing 02/06).
for (const d of docs) {
  const n = d.lines.filter((l) => l.trim().startsWith('```')).length;
  if (n % 2 !== 0) {
    report('fence-balance', d.name, null, `${n} \`\`\` fences — odd count means an unclosed code block`, 'close the dangling fence');
  }
}
for (const [sym, byFile] of ownerOf) {
  if (byFile.size <= 1) continue;
  const [first] = [...byFile.values()].flat();
  const [doc, line] = first.split(':');
  report(
    'symbol-ownership', doc, line,
    `symbol \`${sym}\` is claimed by ${byFile.size} files: ${[...byFile.entries()].map(([f, l]) => `${f} (${l.join(', ')})`).join('; ')}`,
    'pick ONE owning file; other docs reference it instead of redefining it',
  );
}

// ---------------------------------------------------------------- 2. barrel
const BARREL_RE = /export \* from '\.\/([\w/-]+)\.js'/g;
const barrelByDoc = new Map();
for (const d of docs) {
  const found = new Set();
  // (a) fenced block mentioning index.ts (first content line or nearest heading)
  let inFence = false;
  let isBarrel = false;
  let lastNonBlank = '';
  for (let i = 0; i < d.lines.length; i++) {
    const l = d.lines[i];
    if (l.trim().startsWith('```')) {
      inFence = !inFence;
      if (inFence) isBarrel = /index\.ts/.test(d.lines[i + 1] ?? '') || /index\.ts/.test(lastNonBlank);
      continue;
    }
    if (inFence && isBarrel) for (const m of l.matchAll(BARREL_RE)) found.add(m[1]);
    if (l.trim()) lastNonBlank = l;
  }
  // (b) inline prose mentions on a line that names index.ts
  for (const l of d.lines) {
    if (!/index\.ts/.test(l)) continue;
    for (const m of l.matchAll(/`'\.\/([\w/-]+)\.js'`/g)) found.add(m[1]);
  }
  if (/index\.ts/.test(d.text)) barrelByDoc.set(d.name, found);
}

// ---------------------------------------------------------------- 3. literals
const LITERALS = [/\[World state:[^\]]*\]/g];
const seen = new Map();
// Contract rule (§15): ONLY `00` publishes the barrel union; every other doc
// must reference it instead of re-listing (a partial list silently misleads).
const OWNER_DOC = '00-共同上下文.md';
for (const [doc, set] of barrelByDoc) {
  if (doc === OWNER_DOC) continue;
  if (set.size > 0) {
    report(
      'barrel-union', doc, null,
      `publishes its own barrel list (${set.size} row(s)) — §15 makes \`00\` the single source`,
      `delete the list and reference 00 §15 (an incomplete copy ships a silent missing export)`,
    );
  }
}
// And the owner must actually be complete once any module is mentioned anywhere.
const allBarrel = new Set([...barrelByDoc.values()].flatMap((s) => [...s]));
const ownerList = barrelByDoc.get(OWNER_DOC) ?? new Set();
const ownerMissing = [...allBarrel].filter((m) => !ownerList.has(m));
if (ownerMissing.length) {
  report(
    'barrel-union', OWNER_DOC, null,
    `the union owner does not list ${ownerMissing.length} module(s) others mention: ${ownerMissing.map((m) => `'./${m}.js'`).join(', ')}`,
    'add them to 00 §15 (or remove the stray mention)',
  );
}
const sentinels = [...seen.keys()];
if (sentinels.length > 2) {
  report(
    'literal', 'docs/hooks', null,
    `${sentinels.length} distinct [World state: ...] sentinels: ${sentinels.map((s) => `"${s}"`).join(' vs ')}`,
    'at most two are allowed (writer + character); freeze them and delete superseded copies',
  );
}

// ---------------------------------------------------------------- 4. citations
// A citation is a repo path written in a doc. Two families:
//   CITE       — code/test/schema paths (packages|apps|extensions|tools|vendor)
//   CITE_ASSET — assets/ text/code paths (README.md, PLAN.md, skills/**), which
//                are the platform pool's own docs and must resolve.
// Media under assets/ is DELIBERATELY not matched: world-relative references like
// `<worldRoot>/assets/audio/rain.mp3` share the prefix but live in a player's world
// dir, not the repo. CITE_ASSET additionally requires the parent dir to be
// git-tracked, so a bare `assets/foo/x.md` world path is skipped rather than
// mis-reported.
// The leading `(?<![\w/.-])` matters: without it, `server/extensions/guards.ts`
// (a path in the *Nodesign* repo, cited by an audit doc) matches from its middle
// as if it were this repo's `extensions/guards.ts`. A citation starts at a token
// boundary, never mid-path.
export const CITE = /(?<![\w/.-])((?:packages|apps|extensions|tools|vendor)\/[\w/\-.]*?[\w/-])\.(tsx|mts|cts|json|mjs|cjs|ts|js)(?::(\d+)(?:-(\d+))?)?/g;
export const CITE_ASSET = /(?<![\w/.-])(assets\/[\w/\-.]*?[\w/-])\.(md|tsx|ts|mjs|json|yml|yaml)(?::(\d+)(?:-(\d+))?)?/g;
// A doc that talks about a path it does NOT claim exists must say so. These
// markers exempt a LINE (the path is being introduced, retired, or corrected):
const NEWISH_LINE = /\bNEW\b|新建|新增|新文件|待建|拟建|尚未存在|不存在|（新）|\(新\)|一次性|不进仓库|已删|已退休|已下沉|已废弃|已归档|引错|真路径是|~~|曾|原(先|来)|旧稿|计划/;
// ...and a batch design doc declares its NEW files in a header table (file name
// on one line, NEW in the same row). That declaration exempts the file DOC-WIDE:
// the doc's whole premise is "this batch creates it". Matched per line (no `s`
// flag) so an unrelated NEW far away cannot launder a stale citation.
const declaredNew = (text, file) => {
  const q = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${q}[^\\n]{0,80}(NEW|新建|新增|不存在|待建|拟建|删)`).test(text);
};

/**
 * Pure citation scan. `deps` supplies the impure bits so the detector is
 * testable without a checkout:
 *   exists(file)            — does the repo have it?
 *   lineCount(file)         — total lines (only called when `exists`)
 *   trackedAssetDirs        — Set of git-tracked asset parent dirs
 *   planned                 — paths that are a landing-table first cell (exempt)
 * Returns findings shaped like `report()`'s arguments.
 */
export function scanCitations(citeDocs, deps) {
  const out = [];
  const cited = new Map();
  for (const d of citeDocs) {
    d.lines.forEach((raw, i) => {
      const record = (file, m, isAsset) => {
        if (file.includes('...')) return; // docs legitimately elide: `vendor/pi-rp/.../x.ts`
        if (isAsset && !deps.trackedAssetDirs.has(file.split('/').slice(0, -1).join('/'))) return;
        if (!cited.has(file)) cited.set(file, []);
        cited.get(file).push({
          doc: d.name, line: i + 1,
          start: m[3] ? +m[3] : null, end: m[4] ? +m[4] : null,
          newish: NEWISH_LINE.test(raw) || declaredNew(d.text, file),
        });
      };
      for (const m of raw.matchAll(CITE)) record(`${m[1]}.${m[2]}`, m, false);
      for (const m of raw.matchAll(CITE_ASSET)) record(`${m[1]}.${m[2]}`, m, true);
    });
  }
  for (const [file, cites] of cited) {
    if (!deps.exists(file)) {
      if (deps.planned.has(file) || cites.every((c) => c.newish)) continue;
      const c = cites.find((x) => !x.newish);
      out.push(['citation', c.doc, c.line, `cited as EXISTING but path does not exist: ${file}`,
        'fix the path, or mark it NEW/新建 if this batch creates it']);
      continue;
    }
    const total = deps.lineCount(file);
    for (const c of cites) {
      const n = c.end ?? c.start;
      if (n && n > total) out.push(['citation', c.doc, c.line, `${file}:${n} is past EOF (file has ${total} lines)`, 'update the line number']);
    }
  }
  return out;
}

for (const args of scanCitations(citeDocs, {
  exists: (f) => fs.existsSync(path.join(REPO, f)),
  lineCount: (f) => fs.readFileSync(path.join(REPO, f), 'utf-8').split('\n').length,
  trackedAssetDirs,
  planned: PLANNED,
})) report(...args);

// Distinct repo paths the citation corpus references (for the summary line).
const citedPaths = new Set();
for (const d of citeDocs) for (const re of [CITE, CITE_ASSET]) {
  for (const raw of d.lines) for (const m of raw.matchAll(re)) {
    const file = `${m[1]}.${m[2]}`;
    if (!file.includes('...')) citedPaths.add(file);
  }
}

// ---------------------------------------------------------------- 5. ghosts
const declared = new Set(ownerOf.keys());
const OWNS = /(?:拥有|冻结|声明|declares|owns|exports?)\s*`([A-Z][A-Za-z0-9_]{2,})`/g;
for (const d of docs) {
  for (const l of d.lines) for (const m of l.matchAll(OWNS)) declared.add(m[1]);
}
const PICKS = /Pick<\s*([A-Z][A-Za-z0-9_]{2,})/g;
for (const d of docs) {
  d.lines.forEach((raw, i) => {
    for (const m of raw.matchAll(PICKS)) {
      if (!declared.has(m[1])) {
        report('ghost-symbol', d.name, i + 1, `\`Pick<${m[1]}, ...>\` references a symbol never declared in any doc`, 'declare it or use the correct existing name');
      }
    }
  });
}

// ---------------------------------------------------------------- main (direct run only)
// Guarded so a test can `import { scanCitations }` without triggering the I/O
// scan, the report, and `process.exit`.
function main() {
  const summary = {
    docs: docs.map((d) => d.name),
    ownedSymbols: ownerOf.size,
    symbolsWithMultipleOwners: [...ownerOf.values()].filter((v) => v.size > 1).length,
    barrelUnion: [...allBarrel].sort(),
    barrelDocs: [...barrelByDoc.keys()],
    citedPaths: citedPaths.size,
    findings: findings.length,
  };
  if (JSON_OUT) {
    console.log(JSON.stringify({ findings, summary }, null, 2));
    return findings.length > 0;
  }
  if (!findings.length) {
    console.log(`check-hooks-docs: clean (${docs.length} docs, ${summary.ownedSymbols} owned symbols, ${summary.citedPaths} cited paths)`);
    return false;
  }
  console.log(`check-hooks-docs: ${findings.length} finding(s)\n`);
  const byCheck = {};
  for (const f of findings) (byCheck[f.check] ??= []).push(f);
  for (const [check, items] of Object.entries(byCheck)) {
    console.log(`── ${check} (${items.length})`);
    for (const f of items) {
      console.log(`  [${f.doc}${f.line ? ':' + f.line : ''}] ${f.message}`);
      console.log(`      → ${f.fix}`);
    }
    console.log();
  }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main() ? 1 : 0);
}
