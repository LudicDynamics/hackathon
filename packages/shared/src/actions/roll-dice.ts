import type { WorldEvent } from '../schemas/events.js';
import { entityName, parseFrontmatter } from '../schemas/frontmatter.js';
import {
  diceRange,
  evaluateExpect,
  parseDiceType,
  parseExpect,
  patchRollDiceResult,
  rollOnce,
} from '../rules/dice.js';
import { ActionError, fail } from './errors.js';
import { registerAction } from './service.js';
import type { ActionContext, ActionResult } from './types.js';
import { runTriggeredCommands } from '../commands/trigger.js';

export interface RollDiceInput {
  /** World-root relative path, POSIX, no leading './' (00 §2.1). An existing single .md file. */
  path: string;
  /**
   * **god only** (doc-21 §4.3). A non-god passing this is `dice_forced_not_allowed`
   * (403) — never silently ignored (01 §2.4). Must be an integer inside `diceRange`.
   */
  forcedResult?: number;
}

export interface RollDiceDetails {
  /** == input.path (stable id). */
  path: string;
  /** The entity's name at this moment (`entityName`, 06 §2.3). */
  name: string;
  /** The declared expression, verbatim, e.g. "1d100". */
  dice: string;
  /** The declared check name, e.g. "Pick the rusted lock". */
  desc: string;
  /** The declared pass condition, verbatim, e.g. ">50". */
  expect: string;
  /** Final score (sum of the dice + modifier). */
  result: number;
  /** Verdict against `expect`. */
  passed: boolean;
  /** Individual faces (`1d100` → [62], `2d6` → [3,4]) for the dice animation. */
  rolls: number[];
  /** Every die shows its max face — the animation enlarges the success. */
  crit: boolean;
  /** Every die shows 1 — the animation plays a big failure. */
  fumble: boolean;
  /** True when god forged this score via `forcedResult` (show the total only, no faces). */
  forged: boolean;
  /** `resolveLayer(path)` (01 §3.9); null for bag / character-nook entities. */
  layer: string | null;
}

function diceBreakdown(rolls: number[], modifier: number, result: number): string {
  if (rolls.length === 1 && modifier === 0) return String(result);
  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `-${-modifier}` : '';
  return `${rolls.join('+')}${sign} = ${result}`;
}

function verdict(passed: boolean): string {
  return passed ? 'passed' : 'failed';
}

/** "Rolled 1d100 for "…" (world/x.md): 62 — passed (>50)." (§2.3) */
function rolledText(d: RollDiceDetails, breakdown: string): string {
  return `Rolled ${d.dice} for "${d.desc}" (${d.path}): ${breakdown} — ${verdict(d.passed)} (${d.expect}).`;
}

function alreadyRolledMessage(path: string, result: number, passed: boolean | undefined): string {
  const old = passed === undefined ? `${result}` : `${result}, ${verdict(passed)}`;
  return `"${path}" already has a rolled result (${old}); edit the file to remove it, then roll again`;
}

function assertForcedResultUsable(
  forcedResult: number,
  dice: string,
  min: number,
  max: number
): void {
  if (typeof forcedResult !== 'number' || !Number.isInteger(forcedResult)) {
    fail('invalid_argument', `forcedResult must be an integer, got ${forcedResult}`);
  }
  if (forcedResult < min || forcedResult > max) {
    fail('invalid_argument', `forcedResult ${forcedResult} is outside the range of ${dice} (${min}..${max})`);
  }
}

/**
 * Resolve an entity's declared dice check (doc-tools/07). The engine reads
 * `type / desc / expect` from the file, rolls true random, judges the result,
 * writes `result / passed` back into the file and records `roll_resolved`.
 *
 * The caller can never supply the outcome: `forcedResult` is god-only and is the
 * single, event-recording exception (doc-21 §4.3).
 */
export async function rollDice(
  ctx: ActionContext,
  input: RollDiceInput
): Promise<ActionResult<RollDiceDetails>> {
  const path = input.path;
  if (typeof path !== 'string' || path === '') {
    fail('invalid_argument', 'Path must not be empty');
  }

  // Step 2 — the forgery gate runs on the CALLER, before the file is even read.
  const forged = input.forcedResult !== undefined;
  if (forged && ctx.actor.type !== 'god') {
    fail(
      'dice_forced_not_allowed',
      `A forged dice result requires actor 'god', got '${ctx.actor.type}'`
    );
  }

  // Step 3 — read the source of truth. `readFile` runs `resolvePath` first, so an
  // unsafe path fails as `invalid_path` (400) rather than being misreported as
  // `not_found`; only a genuine ENOENT / EISDIR becomes `not_found` (§7.1 rows 2-4).
  let raw: string;
  try {
    raw = await ctx.store.readFile(path);
  } catch (err) {
    if (err instanceof ActionError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') fail('not_found', `File "${path}" not found`);
    fail('internal', `Could not read "${path}": ${(err as Error).message}`);
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.frontmatter === null) {
    fail('malformed_entity', `"${path}" has no YAML frontmatter block`);
  }

  // Step 4 — the declaration. Normalized-missing is `not_interactive`, never
  // `malformed_entity` (that one is for a broken frontmatter block; REVIEW m-4).
  const declared = parsed.interactive.roll_dice;
  if (declared === null) {
    const hasBlock = parsed.frontmatter.roll_dice != null;
    const reason = parsed.errors[0] ? `: ${parsed.errors[0]}` : '';
    fail(
      'not_interactive',
      hasBlock
        ? `"${path}" declares roll_dice but is missing "expect"${reason}`
        : `"${path}" declares no roll_dice check${reason}`
    );
  }

  // Step 5 — parse the declared expression and condition.
  const spec = parseDiceType(declared.type);
  if (!spec.ok) fail('invalid_field_value', spec.error);
  const ast = parseExpect(declared.expect);
  if (!ast.ok) fail('invalid_field_value', ast.error);

  // Step 6 — re-roll gate. Existing `result` is the only reliable signal that
  // this check was already adjudicated; god + forcedResult may overwrite (§3.3).
  const previousResult = declared.result;
  const overwrite = forged && previousResult !== undefined;
  if (previousResult !== undefined && !overwrite) {
    fail('dice_already_rolled', alreadyRolledMessage(path, previousResult, declared.passed));
  }

  // Step 7 — produce the score.
  const { min, max } = diceRange(spec.value);
  let rolls: number[];
  let result: number;
  let crit: boolean;
  let fumble: boolean;
  if (forged) {
    const forcedResult = input.forcedResult as number;
    assertForcedResultUsable(forcedResult, declared.type, min, max);
    rolls = [forcedResult];
    result = forcedResult;
    crit = rolls.every((r) => r === spec.value.faces);
    fumble = rolls.every((r) => r === 1);
  } else {
    const rng = ctx.rng ?? Math.random;
    ({ rolls, result, crit, fumble } = rollOnce(spec.value, rng));
  }

  // Step 8 — judge.
  const passed = evaluateExpect(ast.value, result);
  const name = entityName(parsed.frontmatter, path);
  const layer = await ctx.store.resolveLayer(path);

  const details: RollDiceDetails = {
    path,
    name,
    dice: declared.type,
    desc: declared.desc,
    expect: declared.expect,
    result,
    passed,
    rolls,
    crit,
    fumble,
    forged,
    layer,
  };
  // §3.3 quotes the overwrite line verbatim; the plain-forgery line mirrors the roll line.
  const text = forged
    ? overwrite
      ? `Overwrote the previous result (${previousResult}) with a forged ${result} for "${declared.desc}" (${path}).`
      : `Forged ${result} for "${declared.desc}" (${path}) — ${verdict(passed)} (${declared.expect}).`
    : rolledText(details, diceBreakdown(rolls, spec.value.modifier, result));

  // Step 9 — surgical rewrite of the two lines inside the roll_dice block.
  let next: string;
  try {
    next = patchRollDiceResult(raw, result, passed);
  } catch (err) {
    // Inline YAML / no block: never guess, never rewrite the author's frontmatter.
    fail('malformed_entity', `"${path}" cannot be updated: ${(err as Error).message}`);
  }

  // Step 10 — atomic write. On failure the original file is untouched.
  try {
    await ctx.store.writeFileAtomic(path, next);
  } catch (err) {
    fail('write_failed', `Failed to write "${path}": ${(err as Error).message}`);
  }

  // Step 11 — record the event, once. The file is the truth (00 constraint 1), so
  // the event must describe a change that already happened; a failure here is
  // reported without rolling the file back (01 §3.6).
  let event: WorldEvent;
  try {
    event = await ctx.store.appendEvent({
      type: 'roll_resolved',
      actor: ctx.actor,
      detail: {
        path,
        name,
        dice: declared.type,
        desc: declared.desc,
        expect: declared.expect,
        result,
        passed,
      },
      subject: path,
      turn: ctx.turn,
      ...(layer === null ? {} : { layer }),
    });
  } catch (err) {
    fail(
      'event_failed',
      `File "${path}" was updated with result ${result} but the world event could not be recorded: ${(err as Error).message}`
    );
  }

  // Steps 11b/12 — world commands bound to this entity (docs/command/02 §3).
  // Runs AFTER the event landed: a command may only react to a fact that is
  // already true. NEVER throws — the roll is already adjudicated, and the
  // re-roll gate would turn a thrown error into a dead end.
  const commands = await runTriggeredCommands(ctx, {
    source: path,
    hook: 'roll_resolved',
    mode: 'fresh',
    parsed,
    facts: {
      'roll.result': result,
      'roll.passed': passed,
      'roll.crit': crit,
      'roll.fumble': fumble,
      'roll.forged': forged,
      'roll.dice': declared.type,
      'roll.expect': declared.expect,
      'roll.desc': declared.desc,
      'roll.name': name,
      'roll.layer': layer,
      'trigger.path': path,
      'trigger.name': name,
      'trigger.id': null,
      actor: ctx.actor.type,
      actor_id: ctx.actor.id ?? null,
      layer,
    },
  });

  // Step 12 — return the stable details payload the router / toolkit wrap.
  // `...(commands ? { commands } : {})` is NOT style: no `on` ⇒ no `commands`
  // key; a declared `on` ⇒ always a `commands` key, even all-skipped. That is
  // what makes "wrote `on`, nothing ran" impossible to miss in the response.
  return { text, details: { ...details, event, ...(commands ? { commands } : {}) } };
}

registerAction('rollDice', (ctx, input) => rollDice(ctx, input as unknown as RollDiceInput));
