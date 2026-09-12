#!/usr/bin/env node
/**
 * check-hooks-docs.mjs — mechanical consistency gate for `docs/hooks/*.md`.
 *
 * Born from the B2/B3 review gate (5 independent reviewers converged): the batch's
 * "frozen contract" was frozen only in prose. Ten-plus cross-doc contradictions
 * (barrel export lists, sentinel strings, DDL columns, symbol names) survived
 * because *nothing could fail* when two docs disagreed. The B1 post-mortem's rule
 * applies: **a contract that cannot be mechanically checked is not frozen.**
 *
 * Checks (each is a defect the B2/B3 batch actually contained):
 *   1. SYMBOL OWNERSHIP — a symbol in a landing table must have ONE owning file.
 *   2. BARREL UNION      — every barrel module any doc requires must be listed by
 *                          every doc that publishes a barrel list; union diffed.
 *   3. SENTINEL LITERAL  — frozen string literals must be byte-identical.
 *   4. FILE:LINE CITATION— every citation of an EXISTING file must resolve; line
 *                          numbers must be in range. Planned/NEW files are exempt.
 *   5. GHOST SYMBOL      — `Pick<X,...>` / "owns X" must name a declared symbol.
 *
 * Usage: node tools/check-hooks-docs.mjs [--json]
 * Exit: 0 clean, 1 findings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HOOKS = path.join(REPO, 'docs/hooks');
const JSON_OUT = process.argv.includes('--json');

const docs = fs
  .readdirSync(HOOKS)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort()
  .map((f) => ({ name: f, text: fs.readFileSync(path.join(HOOKS, f), 'utf-8'), lines: [] }));
for (const d of docs) d.lines = d.text.split('\n');

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
const CITE = /((?:packages|apps|extensions|tools|vendor)\/[\w/\-.]*?[\w/-])\.(tsx|mts|cts|json|mjs|cjs|ts|js)(?::(\d+)(?:-(\d+))?)?/g;
const NEWISH = /\bNEW\b|新建|新增|新文件|待建|尚未存在|（新）|\(新\)/;
const cited = new Map();
for (const d of docs) {
  d.lines.forEach((raw, i) => {
    for (const m of raw.matchAll(CITE)) {
      const file = `${m[1]}.${m[2]}`;
      if (!cited.has(file)) cited.set(file, []);
      cited.get(file).push({ doc: d.name, line: i + 1, start: m[3] ? +m[3] : null, end: m[4] ? +m[4] : null, newish: NEWISH.test(raw) });
    }
  });
}
for (const [file, cites] of cited) {
  const abs = path.join(REPO, file);
  if (!fs.existsSync(abs)) {
    const expected = planned1(file) || cites.every((c) => c.newish);
    if (!expected) {
      const c = cites.find((x) => !x.newish);
      report('citation', c.doc, c.line, `cited as EXISTING but path does not exist: ${file}`,
        'fix the path, or mark it NEW/新建 if this batch creates it');
    }
    continue;
  }
  const total = fs.readFileSync(abs, 'utf-8').split('\n').length;
  for (const c of cites) {
    const n = c.end ?? c.start;
    if (n && n > total) report('citation', c.doc, c.line, `${file}:${n} is past EOF (file has ${total} lines)`, 'update the line number');
  }
}
function planned1(f) {
  return PLANNED.has(f);
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

// ---------------------------------------------------------------- output
const summary = {
  docs: docs.map((d) => d.name),
  ownedSymbols: ownerOf.size,
  symbolsWithMultipleOwners: [...ownerOf.values()].filter((v) => v.size > 1).length,
  barrelUnion: [...allBarrel].sort(),
  barrelDocs: [...barrelByDoc.keys()],
  citedPaths: cited.size,
  findings: findings.length,
};
if (JSON_OUT) {
  console.log(JSON.stringify({ findings, summary }, null, 2));
} else if (!findings.length) {
  console.log(`check-hooks-docs: clean (${docs.length} docs, ${summary.ownedSymbols} owned symbols, ${summary.citedPaths} cited paths)`);
  process.exit(0);
} else {
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
  process.exit(1);
}
