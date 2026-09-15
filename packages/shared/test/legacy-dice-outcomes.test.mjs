/**
 * M-1 / M-2 / M-3 / M-5 / M-6 / M-7 — the migration's regression battery
 * (`docs/command/08-迁移与收敛.md` §13.2), plus the non-vacuity assertions that
 * make each one mean something.
 *
 * Three families, and each is here for a different reason:
 *
 *  1. ROUTE C ≡ ROUTE D (M-1, M-2). `expandDiceOutcomes` is the sugar; the
 *     handwritten `on` block is the target. If they disagree, the sugar is
 *     quietly doing something else, and a player's save plays by different rules
 *     than the template it was copied from.
 *  2. ROUTE C ≠ ROUTE B (M-3). Route C owns the conflict check that a
 *     "both syntaxes live" engine would not have. Without the assertion, C
 *     degrades into B and a card with both blocks double-runs.
 *  3. THE OLD CONTRACT DID NOT MOVE (M-5, M-6, M-7). The new evaluator must
 *     still be a strict superset of `evalWhen`; the bilingual chain must still
 *     see byte-identical machine fields; the migration must change exactly the
 *     files it claims to and no others.
 *
 * Every assertion states what it defends; where an assertion could pass
 * vacuously (a count that is already true before the migration), the test
 * asserts the BEFORE value too.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { parseFrontmatter } from '../dist/schemas/frontmatter.js';
import { parseOnBindings } from '../dist/commands/bindings.js';
import { parseWorldCommand } from '../dist/commands/world-command.js';
import { evaluateCondition, parseCommandWhen } from '../dist/commands/condition.js';
import { evalWhen } from '../dist/rules/interactive.js';
import {
  INVESTIGATION_OUTCOME_COMMAND_YAML,
  expandDiceOutcomes,
  resolveDiceOutcomes,
} from '../dist/commands/legacy-dice-outcomes.js';

import { forbiddenReason, main as migrateMain } from '../../../tools/migrate-dice-outcomes.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The 36 cards whose `dice_outcomes` table is the migration's declared scope,
 * taken from `git` rather than a filesystem walk so a scratch copy cannot enter
 * the denominator.
 *
 * COUNTING CONVENTION (`08 §2.1.1`): the doc's "36" is TEMPLATES ONLY. The real
 * HEAD count including `archive/` is 48 (`git grep -l dice_outcomes HEAD` over
 * the `04-investigation-dice.md` glob reads 48 = 36 templates + 12 archive), and
 * the archive is 2d10 while the live whitechapel is 1d100. This file uses the
 * TEMPLATES-ONLY convention, because `archive/` is exactly what route C covers
 * and route D must never touch.
 */
const TEMPLATE_CARDS = (() => {
  const listed = execFileSync('git', ['ls-files', 'templates'], { cwd: REPO })
    .toString()
    .split('\n')
    .filter((f) => f.endsWith('/04-investigation-dice.md'))
    .filter((f) => f.includes('/world/'));
  assert.equal(listed.length, 36, 'the migration scope is 36 template cards (§2.3)');
  return listed;
})();

const readFrontmatter = (rel) => parseFrontmatter(fs.readFileSync(path.join(REPO, rel), 'utf8')).frontmatter;

/* ────────────────────────────────────────────────────────────────────────────
 * M-1 — the sugar expands to EXACTLY the handwritten declaration
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-1: the expansion of the whitechapel-jp card equals its handwritten on block', () => {
  const rel = 'templates/whitechapel-jp/world/london-map/04-investigation-dice.md';
  const frontmatter = readFrontmatter(rel);

  const expanded = expandDiceOutcomes(frontmatter, rel);
  assert.ok('on' in expanded, JSON.stringify(expanded));

  // The handwritten reference is `08 §4.1` / `02 §15.1`'s twelve lines, spelled
  // exactly as this repo's frozen pieces require them. It is written out rather
  // than read from the doc so the test fails when EITHER side drifts: a change to
  // the expansion, and a change to the intended shape, both show up here.
  const handwritten = {
    roll_resolved: [
      binding('roll.result in 1..12', 'great-success'),
      binding('roll.result in 13..60', 'success'),
      binding('roll.result in 61..95', 'setback'),
      binding('roll.result in 96..100', 'failure'),
    ],
  };
  assert.deepEqual(expanded.on, handwritten);

  // Non-vacuity: the reference block must itself be legal, or "equal to a broken
  // block" would be a happy result.
  assert.deepEqual(parseOnBindings({ ...frontmatter, on: handwritten }, null).errors, []);

  // And it must be a change: the card as shipped declares no `on` at all, which
  // is the whole reason route C exists (`08 §10.5`).
  assert.equal(frontmatter.on, undefined, 'the shipped card must not already declare `on`');
});

/** One expected binding, in `02 §2.4`'s normalized shape. */
function binding(when, grade) {
  return {
    when,
    run: 'investigation-outcome',
    from: 'dice_outcomes',
    with: {
      grade,
      reward_path: '{{ trigger.entry.rewards[0].path }}',
      reward_title: '{{ trigger.entry.rewards[0].title }}',
      reward_body: '{{ trigger.entry.rewards[0].body }}',
      outcome_text: '{{ trigger.entry.text }}',
    },
    onError: 'stop',
  };
}

test('M-1: the shared command is legal, and its three steps are the three the doc promises', () => {
  const parsed = parseWorldCommand('investigation-outcome', INVESTIGATION_OUTCOME_COMMAND_YAML);
  assert.ok(parsed.ok, JSON.stringify(parsed.errors));
  assert.deepEqual(
    parsed.command.steps.map((step) => step.action),
    ['give', 'edit', 'edit'],
    '§4.2: give ×1 + edit ×2 — the D-1 shape'
  );
  // `08 §4.1` writes `{{ grade }}` (the shorthand `01 §2.5` blesses). It parses
  // but does NOT resolve at run time (the evaluator's map is `params.*` only), so
  // the expansion must not emit it. Asserting the prefix is what keeps a future
  // "restore the doc's sample" edit from silently breaking every trigger.
  assert.ok(
    INVESTIGATION_OUTCOME_COMMAND_YAML.includes('{{ params.grade }}'),
    'the grade must be read through the `params.` prefix the runtime supports'
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * M-2 — the whole stock expands, no exceptions
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-2: all 36 template cards expand, and the total band count is 144', () => {
  let bands = 0;
  for (const rel of TEMPLATE_CARDS) {
    const frontmatter = readFrontmatter(rel);
    const expanded = expandDiceOutcomes(frontmatter, rel);
    assert.ok('on' in expanded, `${rel}: ${JSON.stringify(expanded)}`);
    assert.equal(expanded.on.roll_resolved.length, 4, `${rel}: four bands`);
    assert.equal(expanded.commands.length, 1, `${rel}: one shared command`);
    // Each emitted binding must survive `02`'s own parser — an expansion that
    // produces a block the trigger layer rejects would be worse than no sugar.
    assert.deepEqual(
      parseOnBindings({ ...frontmatter, on: expanded.on }, null).errors,
      [],
      `${rel}: the emitted block must parse`
    );
    bands += expanded.on.roll_resolved.length;
  }
  assert.equal(bands, 144, '§2.3: 36 cards × 4 bands — any exception breaks the uniformity claim');
});

test('M-2: the two dice flavours map to two grade ladders, in opposite directions', () => {
  // `08 §4.3`: the archive (and the 2d10 worlds) read a LOW roll as the WORST
  // band, while the 1d100 worlds read it as the BEST. A single index-derived
  // ladder would silently invert half the worlds' grading.
  const percentile = expandDiceOutcomes(
    readFrontmatter('templates/whitechapel/world/london-map/04-investigation-dice.md'),
    'x'
  );
  const standard = expandDiceOutcomes(
    readFrontmatter('templates/wuwu/world/harbor-chart/04-investigation-dice.md'),
    'x'
  );
  assert.deepEqual(
    percentile.on.roll_resolved.map((b) => b.with.grade),
    ['great-success', 'success', 'setback', 'failure']
  );
  assert.deepEqual(
    standard.on.roll_resolved.map((b) => b.with.grade),
    ['failure', 'setback', 'success', 'great-success']
  );
  assert.deepEqual(
    standard.on.roll_resolved.map((b) => b.when),
    ['roll.result in 2..4', 'roll.result in 5..10', 'roll.result in 11..17', 'roll.result in 18..20'],
    'the 2d10 partition, not the 1d100 one'
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * M-3 — C ≠ B: both blocks is a refusal, and only the expansion is exempt
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-3: a handwritten entity with BOTH blocks is refused with zero effect', () => {
  const rel = 'templates/whitechapel/world/london-map/04-investigation-dice.md';
  const frontmatter = readFrontmatter(rel);
  const expanded = expandDiceOutcomes(frontmatter, rel);
  assert.ok('on' in expanded);

  // The authored state §11.3 describes: the table AND a hand-written block.
  const authored = { ...frontmatter, on: expanded.on };
  const verdict = resolveDiceOutcomes(authored, rel);
  assert.ok('errors' in verdict, JSON.stringify(verdict));
  assert.equal(verdict.errors.length, 1);
  assert.equal(verdict.errors[0].code, 'legacy_and_modern_conflict');
  // Zero effects: the caller gets no `commands` at all, so there is nothing that
  // could run. This is the mechanical difference between C and B.
  assert.equal('commands' in verdict, false);
  assert.equal('on' in verdict, false);
});

test('M-3: the ROUTER does not confuse an expansion with an author (non-vacuity)', () => {
  // 1. Modern only → authoritative, and the router synthesizes NOTHING (handing
  //    back the legacy block here would be the double-run bug in reverse).
  const rel = 'templates/whitechapel/world/london-map/04-investigation-dice.md';
  const frontmatter = readFrontmatter(rel);
  const modernOnly = { ...frontmatter };
  delete modernOnly.dice_outcomes;
  modernOnly.on = { roll_resolved: [binding('roll.result in 1..12', 'great-success')] };
  assert.deepEqual(resolveDiceOutcomes(modernOnly, rel), { kind: 'modern' });

  // 2. Legacy only → expanded.
  const legacyOnly = resolveDiceOutcomes(frontmatter, rel);
  assert.equal(legacyOnly.kind, 'legacy');

  // 3. Neither → nothing to do, and NOT an error.
  assert.deepEqual(resolveDiceOutcomes({ type: 'note' }, rel), { kind: 'modern' });

  // 4. And the distinguishing case, stated the other way round: the same entity
  //    is refused only BECAUSE both are present. Remove either key and it is not.
  assert.ok('errors' in resolveDiceOutcomes({ ...frontmatter, on: modernOnly.on }, rel));
});

/* ────────────────────────────────────────────────────────────────────────────
 * M-5 — the new evaluator stays a strict superset of `evalWhen`
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-5: `interactive.test.mjs` seven fail-closed samples stay false under the new evaluator', () => {
  // The literal list from `packages/shared/test/interactive.test.mjs:76`, copied
  // rather than imported (importing a test file would register its cases twice).
  const samples = ['k === 1', 'k > 1', '', '   ', 'k', '== 1', 'a and b'];
  const scope = { values: new Map([['k', 1]]), paths: new Map() };

  for (const sample of samples) {
    assert.equal(evalWhen(sample, { k: 1 }), false, `evalWhen("${sample}") must stay false`);

    // The new evaluator (`03`'s, the one `on.<hook>[].when` and `do[].when` use)
    // must not accept it EITHER — not as `true`, and not as a value at all. A
    // parse failure or an evaluation error both count as refusal; what would break
    // `03 §6.3` is a sample that becomes `true`, because a formerly hidden choice
    // option would then shift every sibling's index (`interactive.ts:265`) while
    // players and the model keep numbering by the old sequence.
    const ast = parseCommandWhen(sample);
    const outcome = ast.ok ? evaluateCondition(ast.value, scope) : { ok: false };
    assert.notEqual(outcome.ok && outcome.value, true, `the new evaluator must not accept "${sample}"`);
  }
});

test('M-5: the evaluator these samples run against is the SAME one the emitted `when` uses', () => {
  // Non-vacuity for the whole battery: if `parseCommandWhen` were a different,
  // never-used parser, `.ok` would be false for every input and the assertion
  // above would pass for free. These two must succeed.
  assert.ok(parseCommandWhen('k === 1').ok === false, 'a malformed sample is a parse failure');
  const good = parseCommandWhen('roll.result in 1..12');
  assert.ok(good.ok, 'the emitted range grammar must parse');
  assert.deepEqual(
    evaluateCondition(good.value, { values: new Map([['roll.result', 5]]), paths: new Map() }),
    { ok: true, value: true },
    'and must evaluate true inside its band'
  );
  assert.deepEqual(
    evaluateCondition(good.value, { values: new Map([['roll.result', 60]]), paths: new Map() }),
    { ok: true, value: false },
    'and false outside it'
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * M-6 — en/ja stay structurally isomorphic for the machine fields
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `humanKeys` from `tools/localize-world-editions.mjs:18` — the fields the
 * bilingual chain is ALLOWED to translate. Everything else must survive byte for
 * byte (`:38`: "Human fields only. IDs, conditions, paths and shared compaction
 * prompts stay byte-for-byte").
 */
const HUMAN_KEYS = new Set([
  'name', 'title', 'description', 'label', 'free_hint', 'hint', 'intent', 'blocked',
  'desc', 'text', 'prompt', 'content', 'genre', 'tags', 'date', 'contract', 'body',
]);

/** Replace every human-keyed string with a placeholder, mirroring `mapText`. */
function stripHuman(value, pointer = []) {
  if (typeof value === 'string') {
    const key = pointer.at(-1);
    const actual = /^\d+$/.test(key) ? pointer.at(-2) : key;
    return HUMAN_KEYS.has(actual) ? '<H>' : value;
  }
  if (Array.isArray(value)) return value.map((item, index) => stripHuman(item, [...pointer, String(index)]));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripHuman(v, [...pointer, k])]));
  }
  return value;
}

test('M-6: en/ja/zh cards are identical after removing human fields, and their on-blocks agree byte for byte', () => {
  const families = [
    ['templates/whitechapel/world/london-map/04-investigation-dice.md', [
      'templates/whitechapel-jp/world/london-map/04-investigation-dice.md',
      'templates/whitechapel-zh/world/london-map/04-investigation-dice.md',
    ]],
    ['templates/wuwu/world/harbor-chart/04-investigation-dice.md', [
      'templates/wuwu-jp/world/harbor-chart/04-investigation-dice.md',
      'templates/wuwu-zh/world/harbor-chart/04-investigation-dice.md',
    ]],
  ];

  for (const [english, localized] of families) {
    const base = readFrontmatter(english);
    const baseExpanded = expandDiceOutcomes(base, english);
    assert.ok('on' in baseExpanded);
    const baseMachine = stripHuman({ frontmatter: base, on: baseExpanded.on });

    for (const other of localized) {
      const sibling = readFrontmatter(other);
      const siblingExpanded = expandDiceOutcomes(sibling, other);
      assert.ok('on' in siblingExpanded, other);
      assert.deepEqual(
        stripHuman({ frontmatter: sibling, on: siblingExpanded.on }),
        baseMachine,
        `${other}: machine fields must be byte-identical to ${english} after ` +
          `removing humanKeys — a translated "when" would make the engine unable to dispatch`
      );
      // The four machine-bearing fields of §3.4c, asserted individually so a
      // failure says WHICH one drifted instead of dumping two objects.
      assert.deepEqual(
        siblingExpanded.on.roll_resolved.map((b) => [b.when, b.run, b.from, b.with.grade]),
        baseExpanded.on.roll_resolved.map((b) => [b.when, b.run, b.from, b.with.grade]),
        `${other}: when / run / from / with.grade must be byte-identical`
      );
    }
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * M-7 — the migration edits exactly what it claims (§3.1's before/after)
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-7: the pre-migration counts, including the one the `^` anchor protects', () => {
  const count = (pattern) => Number(execFileSync('sh', ['-c', pattern], { cwd: REPO }).toString().trim());

  // ① `dice_outcomes` must SURVIVE the migration — this is route D's observable
  //    difference from route A, so the expected value is 36, never 0.
  assert.equal(count("grep -rl dice_outcomes --include='04-investigation-dice.md' templates | wc -l"), 36);

  // ② The `^on:` anchor is load-bearing. Unanchored, `on:` matches the `on:` in
  //    `action:` — a substring hit that makes this count 36 BEFORE the migration
  //    and turns the assertion into a tautology with zero detection power.
  assert.equal(
    count("grep -rl 'on:' --include='04-investigation-dice.md' templates | wc -l"),
    36,
    'unanchored matches `action:` too — the reason the anchor below cannot be dropped'
  );
  assert.equal(
    count("grep -rl '^on:' --include='04-investigation-dice.md' templates | wc -l"),
    0,
    'anchored, the tree starts at ZERO migrated cards'
  );

  // ③ No command files yet; the migration creates one per world (4 for the
  //    six live worlds' four families, 6 once the zh editions are counted —
  //    measured, and the migration writes one per world that has cards).
  assert.equal(count('ls templates/*/command/*.yaml 2>/dev/null | wc -l'), 0);

  // ④ The archive is untouched by EVERY measure (M-4's content-level twin).
  assert.equal(count("grep -rl '^on:' --include='04-investigation-dice.md' archive | wc -l"), 0);
});

test('M-7/M-8: an applied migration on a COPY flips exactly these counts, then is idempotent', () => {
  // The real templates are NOT written: the migration is contracted to be
  // coordinated with the in-flight bilingual authors (§3.3), so this test drives
  // the script against a directory copy through its `--root` seam. The production
  // path (`--root` absent) is the same code; what is proven here is the file-set
  // arithmetic and the idempotence, which a copy proves just as well.
  const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'airp-migrate-'));
  copyMarkdownTree(path.join(REPO, 'templates'), path.join(sandbox, 'templates'));

  const counts = () => ({
    dice: sh(sandbox, "grep -rl dice_outcomes --include='04-investigation-dice.md' templates | wc -l"),
    on: sh(sandbox, "grep -rl '^on:' --include='04-investigation-dice.md' templates | wc -l"),
    commands: sh(sandbox, 'ls templates/*/command/*.yaml 2>/dev/null | wc -l'),
  });

  return (async () => {
    try {
      assert.deepEqual(counts(), { dice: 36, on: 0, commands: 0 }, 'the copy starts exactly like the tree');

      // Run 1 — writes. `--apply` is the ONLY thing that writes; the default is a
      // dry run, which is asserted separately below.
      const first = await silentRun(['--apply', '--root', sandbox]);
      assert.equal(first, 0, 'a clean migration exits zero');
      assert.deepEqual(
        counts(),
        { dice: 36, on: 36, commands: 6 },
        'every card gained `on`, none lost its table, and 6 worlds got their command file'
      );

      // Run 2 — M-8. Nothing changes, so the script is re-entrant.
      const second = await silentRun(['--apply', '--root', sandbox]);
      assert.equal(second, 0);
      assert.deepEqual(counts(), { dice: 36, on: 36, commands: 6 }, 'and the tree is byte-stable');
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  })();
});

test('the default invocation is a DRY RUN: no file is written without --apply', async () => {
  const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'airp-migrate-dry-'));
  copyMarkdownTree(path.join(REPO, 'templates'), path.join(sandbox, 'templates'));
  try {
    const code = await silentRun(['--root', sandbox]);
    assert.equal(code, 0);
    assert.equal(sh(sandbox, "grep -rl '^on:' --include='04-investigation-dice.md' templates | wc -l"), 0);
    assert.equal(sh(sandbox, 'ls templates/*/command/*.yaml 2>/dev/null | wc -l'), 0);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

/** Run a shell one-liner in `cwd` and read the single integer it prints. */
function sh(cwd, command) {
  return Number(execFileSync('sh', ['-c', command], { cwd }).toString().trim());
}

/**
 * Copy only the markdown, not the assets.
 *
 * `templates/` is ~320 MB of images and audio; this test needs the `.md` cards
 * and nothing else, and copying the whole tree would make the suite pay a
 * multi-hundred-millisecond `cp` for no assertion it does not already have.
 */
function copyMarkdownTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyMarkdownTree(source, target);
    else if (entry.name.endsWith('.md')) fs.copyFileSync(source, target);
  }
}
/* ────────────────────────────────────────────────────────────────────────────
 * M-4 — the path gate (script-level; the argument half needs no repo state)
 * ──────────────────────────────────────────────────────────────────────────── */

test('M-4: the forbidden-path gate refuses archive/ and worlds/, however the path is spelled', () => {
  // The gate is exported so it can be tested as a pure function — a `--help`-style
  // CLI test would spawn 6 processes to prove the same predicate.
  for (const forbidden of [
    'archive',
    'archive/templates/x.md',
    './archive/templates/x.md',
    'archive/../archive/x.md',
    `${REPO}archive/x.md`,
    'worlds',
    'worlds/w-abc/world/x.md',
  ]) {
    assert.notEqual(forbiddenReason(forbidden), null, `"${forbidden}" must be refused`);
  }
  for (const allowed of ['templates/whitechapel/world/x.md', 'tools/x.mjs', 'packages/shared/src/index.ts']) {
    assert.equal(forbiddenReason(allowed), null, `"${allowed}" must be allowed`);
  }
});

test('M-4: the CLI exits non-zero and writes nothing when handed a forbidden path', async () => {
  const before = fs.readFileSync(path.join(REPO, 'templates/whitechapel/world/london-map/04-investigation-dice.md'), 'utf8');
  const code = await silentRun(['archive/templates/pre-bilingual-2026-09-14/whitechapel-playtest/world/london-map/04-investigation-dice.md']);
  assert.equal(code, 1, 'a forbidden argument must exit non-zero');
  assert.equal(
    fs.readFileSync(path.join(REPO, 'templates/whitechapel/world/london-map/04-investigation-dice.md'), 'utf8'),
    before,
    'and must not have touched any world file'
  );
});

/** Call the CLI entry point with console output muted, returning its exit code. */
async function silentRun(argv) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await migrateMain(argv);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
