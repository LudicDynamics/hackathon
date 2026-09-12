import type { WorldEvent } from '../schemas/events.js';
import { entityName, parseFrontmatter } from '../schemas/frontmatter.js';
import { resolveChoice, visibleChoiceOptions } from '../rules/interactive.js';
import { ActionError, fail } from './errors.js';
import { registerAction } from './service.js';
import { actorLabel } from './actor.js';
import type { ActionContext, ActionResult } from './types.js';

export interface ChooseOptionInput {
  /** World-relative, POSIX, no leading './' (00 §2.1). An entity with a choice group. */
  path: string;
  /** 1-based visible index, option text, or option id (06 §3.2 resolution order). */
  choice: string | number;
}

export interface ChooseOptionDetails {
  /** == input.path (normalized). */
  path: string;
  /** The entity's name AT THIS MOMENT (entityName); the event's `name` is the same. */
  name: string;
  /** The RESOLVED option label, never the caller's raw input (§2.1). */
  choice: string;
  /** 1-based, the same number look_at prints and the UI shows (01 §2.5). */
  index: number;
  /** The visible candidate count at resolution time; the UI uses it to detect staleness. */
  count: number;
  event?: WorldEvent;
}

/** Render a caller-supplied choice for an error message without changing its type. */
function quotedChoice(choice: string | number): string {
  return typeof choice === 'number' ? String(choice) : `"${choice}"`;
}

/** `3 visible options: "a", "b", "c"` — the menu an agent reads to fix its next call. */
function optionMenu(labels: string[]): string {
  const shown = labels.map((l) => `"${l}"`).join(', ');
  return `${labels.length} visible option${labels.length === 1 ? '' : 's'}: ${shown}`;
}

/**
 * Record that an actor picked one of the public options an entity declares
 * (doc-tools/06). This is the thinnest action in the layer: it re-reads the
 * entity, claims one option from the VISIBLE list and appends `choice_selected`.
 * It never writes a file, never deletes options and never assumes consequences
 * (doc-20 §6) — the event itself is the trigger the writer reacts to.
 */
export async function chooseOption(
  ctx: ActionContext,
  input: ChooseOptionInput
): Promise<ActionResult<ChooseOptionDetails>> {
  const path = input.path;
  if (typeof path !== 'string' || path === '') {
    fail('invalid_argument', 'Path must not be empty');
  }

  // The choice parameter is validated before any I/O so a caller's typo is
  // reported as a parameter error, not as "this entity has no options".
  const rawChoice = input.choice;
  if (typeof rawChoice === 'string') {
    if (rawChoice === '') fail('invalid_argument', 'choice must not be empty');
  } else if (typeof rawChoice === 'number') {
    if (!Number.isInteger(rawChoice)) {
      fail('invalid_argument', `Choice number must be a positive integer, got ${rawChoice}`);
    }
  } else {
    fail('invalid_argument', 'choice must be a string or a number');
  }

  // Step 2 — read the source of truth. `readFile` runs `resolvePath` first, so an
  // unsafe path is `invalid_path`; a genuine ENOENT / EISDIR becomes `not_found`.
  let raw: string;
  try {
    raw = await ctx.store.readFile(path);
  } catch (err) {
    if (err instanceof ActionError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') fail('not_found', `Entity not found: "${path}"`);
    fail('internal', `Could not read "${path}": ${(err as Error).message}`);
  }

  const parsed = parseFrontmatter(raw);
  if (parsed.frontmatter === null) {
    fail('malformed_entity', `"${path}" has no YAML frontmatter block`);
  }
  const fm = parsed.frontmatter;
  const name = entityName(fm, path);

  // Step 3 — normalized-missing is `not_interactive`, never `malformed_entity`
  // (that one is only for a broken frontmatter block; REVIEW m-4). No fallback to
  // raw frontmatter: `interactive` is a deterministic function of raw, so a null
  // choice here means the declared choice really has no usable shape (§3.3).
  const choice = parsed.interactive.choice;
  if (choice === null) {
    const declared = fm.choice != null;
    if (declared) {
      const reason = parsed.errors.find((e) => e.startsWith('choice'));
      fail(
        'not_interactive',
        `"${path}" declares choice but it is malformed${reason ? `: ${reason}` : ''}`
      );
    }
    fail('not_interactive', `"${path}" has no choice group; nothing to choose`);
  }

  // Legal but unimplemented: never silently treat multi as single (06 §7.3).
  if (choice.mode === 'multi') {
    fail(
      'unsupported',
      `"${path}" declares a multi-select choice; B1 only supports single-select`
    );
  }

  const visible = visibleChoiceOptions(choice);
  const declaredCount = choice.options.length;
  if (visible.length === 0) {
    fail(
      'choice_not_found',
      `"${path}" has no visible options right now (${declaredCount} defined, all filtered by when)`
    );
  }

  // Step 4 — claim exactly one option from the visible list (numbering is shared
  // with look_at / the UI, so it cannot drift).
  const resolved = resolveChoice(choice, rawChoice);
  if ('error' in resolved) {
    if (resolved.error === 'out_of_range') {
      fail(
        'choice_not_found',
        `Choice ${quotedChoice(rawChoice)} is out of range for "${path}" (${optionMenu(visible.map((o) => o.label))})`
      );
    }
    fail(
      'choice_not_found',
      `Choice ${quotedChoice(rawChoice)} does not match any option of "${path}" (${optionMenu(visible.map((o) => o.label))})`
    );
  }
  const option = resolved.option;

  const layer = await ctx.store.resolveLayer(path);

  // Step 5 — record the event, once. There is no file write to compensate for:
  // a failure here leaves the world untouched (06 §4.2).
  let event: WorldEvent;
  try {
    event = await ctx.store.appendEvent({
      type: 'choice_selected',
      actor: ctx.actor,
      detail: { path, name, choice: option.label, index: option.index },
      subject: path,
      turn: ctx.turn,
      ...(layer === null ? {} : { layer }),
    });
  } catch (err) {
    fail(
      'event_failed',
      `Choice "${option.label}" on "${path}" could not be recorded: ${(err as Error).message}`
    );
  }

  const actor = actorLabel(ctx.actor);
  const who = actor.charAt(0).toUpperCase() + actor.slice(1);
  const text = `${who} chose "${option.label}" (option ${option.index} of ${visible.length}) on "${name}" (${path}).`;

  return {
    text,
    details: { path, name, choice: option.label, index: option.index, count: visible.length, event },
  };
}

registerAction('chooseOption', (ctx, input) => chooseOption(ctx, input as unknown as ChooseOptionInput));
