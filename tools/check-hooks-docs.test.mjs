/**
 * tools/check-hooks-docs.test.mjs — behaviour proof for the citation check.
 *
 * The gate grew two things worth pinning (2026-09-13): a WIDER citation corpus
 * (hooks + audio + the entry docs) and an `assets/` family, because the entry
 * docs' path tables are exactly where drift goes unnoticed — §7.8 of AGENTS.md
 * and assets/README.md both described a gitignore that had already changed.
 *
 * A citation check that never fires is coverage theatre; one that fires on
 * legitimate prose is a red wall nobody reads. So the dangerous cases are the
 * EXEMPTIONS, and every one of them gets a case here. These are the assertions
 * that make `pnpm check:docs` trustworthy.
 *
 * Run:  node --test tools/check-hooks-docs.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scanCitations } from './check-hooks-docs.mjs';

/** Drive `scanCitations` with a fake filesystem: `files` = [path, lineCount] pairs. */
const scan = (docs, { files = [], trackedAssetDirs = [], planned = [] } = {}) => {
  const fs = new Map(files);
  return scanCitations(
    docs.map((text, i) => ({ name: `d${i}.md`, text, lines: text.split('\n') })),
    {
      exists: (f) => fs.has(f),
      lineCount: (f) => fs.get(f) ?? 0,
      trackedAssetDirs: new Set(trackedAssetDirs),
      planned: new Set(planned),
    },
  );
};

const missing = (findings) => findings.filter((f) => /does not exist/.test(f[3])).map((f) => f[3]);
const eof = (findings) => findings.filter((f) => /past EOF/.test(f[3])).map((f) => f[3]);

// ── the detector fires ──────────────────────────────────────────────────────

test('a code path that does not exist is a finding (the gate can go red)', () => {
  assert.deepEqual(missing(scan(['see `packages/shared/src/rules/ghost.ts`'])), [
    'cited as EXISTING but path does not exist: packages/shared/src/rules/ghost.ts',
  ]);
});

test('an existing path with an in-range line is clean (the gate can go green)', () => {
  const findings = scan(['see `apps/server/src/index.ts:3`'], { files: [['apps/server/src/index.ts', 10]] });
  assert.deepEqual(findings, []);
});

test('a tracked assets/ doc path is validated like any other', () => {
  const tracked = ['assets', 'assets/audio', 'assets/audio/PLAN.md'];
  // Under a tracked dir the .md is checked: missing → finding, present → clean.
  assert.deepEqual(missing(scan(['plan lives in `assets/audio/PLAN.md`'], { trackedAssetDirs: tracked })), [
    'cited as EXISTING but path does not exist: assets/audio/PLAN.md',
  ]);
  assert.deepEqual(
    scan(['plan lives in `assets/audio/PLAN.md`'], { files: [['assets/audio/PLAN.md', 5]], trackedAssetDirs: tracked }),
    [],
  );
});

test('a world-relative assets/ path under an UNtracked dir is skipped', () => {
  // `<worldRoot>/assets/characters/ryo/README.md` is a player's world file. Its
  // parent dir is not in the repo → not a citation, no finding.
  const findings = scan(
    ['fixture writes `assets/characters/ryo/README.md` into the world root'],
    { trackedAssetDirs: ['assets', 'assets/audio'] },
  );
  assert.deepEqual(findings, []);
});

test('assets/ media (mp3/webm/png) is never matched as a citation', () => {
  // These are world-world paths by construction; matching them would be all noise.
  assert.deepEqual(scan(['bg: assets/audio/rain.mp3', 'video: assets/characters/ryo/ryo.webm']), []);
});

// ── the exemptions (the part that decides whether a red build is believable) ─

test('a mid-path match in an external repo path is not a citation', () => {
  // An audit doc cites Nodesign's own `server/extensions/guards.ts`. The regex
  // must not match from its middle as if it were this repo's extensions/guards.ts.
  assert.deepEqual(scan(['Nodesign uses `server/extensions/guards.ts:118`']), []);
});

test('an elided path (`vendor/pi-rp/.../x.ts`) is skipped', () => {
  assert.deepEqual(scan(['see `vendor/pi-rp/.../core/skills.ts`']), []);
});

test('a NEW marker on the line exempts the citation', () => {
  assert.deepEqual(scan(['- `apps/web/test/ghost.test.mjs` NEW — covers the phantom seat']), []);
});

test('a doc-wide NEW declaration exempts the file everywhere else in the doc', () => {
  // Batch design docs declare new files in a header table, then cite them freely.
  const doc = [
    '| `packages/shared/test/init.test.mjs` | 不存在 | **NEW** |',
    '',
    'We add `packages/shared/test/init.test.mjs` with ten cases.',
  ].join('\n');
  assert.deepEqual(scan([doc]), []);
});

test('a stale citation the doc does NOT declare is still caught', () => {
  const doc = ['| `packages/shared/test/init.test.mjs` | 不存在 | **NEW** |', '', 'see `packages/shared/src/rules/gone.ts`'].join('\n');
  assert.deepEqual(missing(scan([doc])), ['cited as EXISTING but path does not exist: packages/shared/src/rules/gone.ts']);
});

test('a landing-table row is exempt even without NEW', () => {
  const findings = scan(['see `apps/server/src/engine/planned.ts`'], { planned: ['apps/server/src/engine/planned.ts'] });
  assert.deepEqual(findings, []);
});

// ── the NEW exemption is file-scoped, not line-scoped ───────────────────────

test('the NEW exemption is file-scoped: an undeclared sibling still fires', () => {
  const doc = [
    '| `apps/server/src/engine/kept.ts` | 不存在 | **NEW** |',
    '',
    'we add `apps/server/src/engine/kept.ts` and touch `apps/server/src/engine/legacy.ts`',
  ].join('\n');
  // `kept.ts` is declared NEW → exempt everywhere. `legacy.ts` is not → caught,
  // even though it sits on the same line as a citation of the exempt file.
  assert.deepEqual(missing(scan([doc])), [
    'cited as EXISTING but path does not exist: apps/server/src/engine/legacy.ts',
  ]);
});
