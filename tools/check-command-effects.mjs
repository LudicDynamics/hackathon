#!/usr/bin/env node
/**
 * Generate `skills/world-commands/references/effects.md` from the effect
 * registry, and (as a gate) assert the committed copy is byte-identical.
 *
 * Precedent: `tools/check-voices.mjs` renders `voice-casting`'s
 * `references/voice-palette.md` from `rules/voices.ts` and gate V5 compares the
 * two byte-for-byte (`docs/prompts/04 §2.5`). The reason is the same here:
 * hand-copying the 7-effect table into the skill is "the same rule written
 * twice" (`doc-23 §2.9`) — change one and miss the other, and the skill starts
 * advertising an effect the executor no longer knows.
 *
 * `docs/command/04` is the contract for each effect's argument surface; this
 * script reads the CODE (`WORLD_COMMAND_EFFECT_ARGS`), not the doc, so drift
 * between the two shows up as a diff instead of as a stale skill page.
 *
 * Usage:
 *   node tools/check-command-effects.mjs            # gate
 *   node tools/check-command-effects.mjs --write-ref # regenerate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE_REF = process.argv.includes('--write-ref');

let failed = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' :: ' + extra : ''}`);
  if (!ok) failed += 1;
};

const {
  WORLD_COMMAND_EFFECTS,
  WORLD_COMMAND_EFFECT_ARGS,
  RESERVED_FRONTMATTER_KEYS,
} = await import(path.join(REPO, 'packages/shared/dist/commands/effects.js'));

/**
 * One sentence per effect saying what it does and what it refuses. Kept beside
 * this renderer rather than in the registry: the registry is machine-read
 * (`04`'s validator consumes it), and an English sentence in it would be a
 * second, translatable copy of the contract.
 */
const PROSE = {
  give: 'Creates one entity, or one per element when `rewards` is an array. `path` and `rewards` are mutually exclusive.',
  move: 'Moves an entity to another path, or to a layer directory (the filename is kept).',
  edit: 'Edits an entity in place: `frontmatter` shallow-merges, `body` replaces, `append_body` appends.',
  set_status: 'Writes scalar keys into the entity\'s `status.data`. This is the deep-merge form of `edit`.',
  consume: 'Takes the first existing path from `from`, then either moves it away (`to`) or changes it in place.',
  enter: 'Enters a layer. Usable only when the layer\'s gate requirement is satisfied.',
  link: 'A rider of `give`; it writes no event of its own. Prefer `give` with `link_to`.',
};

function renderEffectsRef() {
  const rows = WORLD_COMMAND_EFFECTS.map((name) => {
    const form = WORLD_COMMAND_EFFECT_ARGS[name];
    const args = form.names.map((n) => `\`${n}\``).join(', ');
    const req = form.required?.length
      ? form.required.map((n) => `\`${n}\``).join(' + ')
      : '—';
    const oneOf = form.oneOf?.length ? form.oneOf.map((n) => `\`${n}\``).join(' | ') : '—';
    const arrayForm = form.arrays?.length
      ? `${form.arrays.map((n) => `\`${n}\``).join(', ')} (${form.arrayForm ?? 'scalar'})`
      : '—';
    return `| \`${name}\` | ${args} | ${req} | ${oneOf} | ${arrayForm} | ${PROSE[name]} |`;
  }).join('\n');

  return `# The effect list

The seven verbs a \`do\` step may name, with the arguments each one accepts. Write the verb, not
the action method behind it: \`give\`, never \`createEntity\`.

This file is GENERATED from \`packages/shared/src/commands/effects.ts\` — do not edit it by hand.
To change an effect, follow \`docs/command/04\` and run
\`node tools/check-command-effects.mjs --write-ref\`.

| Effect | Arguments | Required | Exactly one | Array form | What it does |
|---|---|---|---|---|---|
${rows}

## Rules that apply to every effect

- \`path\` values are world-root-relative: \`world/\`, \`player/\`, or \`characters/\`, and a \`.md\` file.
- An array argument is passed WHOLE, as a static reference: \`"{{ trigger.entry.rewards }}"\`. A
  literal array is refused — content lives on the entity, not in the command.
- These keys are never writable: ${RESERVED_FRONTMATTER_KEYS.map((k) => `\`${k}\``).join(', ')}.
  They carry already-settled facts, and writing them would forge a result the player has seen.
- Whether an effect CAN happen is not checked at write time (a missing file, an item the player
  does not have). Those fail at trigger time, visibly.
`;
}

const REF_PATH = path.join(REPO, 'skills', 'world-commands', 'references', 'effects.md');
const expected = renderEffectsRef();

if (WRITE_REF) {
  fs.mkdirSync(path.dirname(REF_PATH), { recursive: true });
  fs.writeFileSync(REF_PATH, expected);
  console.log(`wrote ${path.relative(REPO, REF_PATH)}`);
  process.exit(0);
}

check('the effect registry is non-empty', WORLD_COMMAND_EFFECTS.length > 0, `${WORLD_COMMAND_EFFECTS.length} effects`);

for (const name of WORLD_COMMAND_EFFECTS) {
  check(`\`${name}\` declares an argument form`, WORLD_COMMAND_EFFECT_ARGS[name] !== undefined);
  check(`\`${name}\` has a description in the renderer`, typeof PROSE[name] === 'string');
}

if (!fs.existsSync(REF_PATH)) {
  check(`${path.relative(REPO, REF_PATH)} exists (run with --write-ref)`, false, 'missing');
} else {
  const actual = fs.readFileSync(REF_PATH, 'utf-8');
  const matches = actual === expected;
  check(
    `${path.relative(REPO, REF_PATH)} matches the effect registry (docs/command/04 §2.6)`,
    matches,
    matches ? '' : 'stale — run `node tools/check-command-effects.mjs --write-ref`'
  );
}

console.log(`\n${failed === 0 ? 'ALL COMMAND-EFFECT ASSERTIONS PASSED' : `${failed} ASSERTION(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
