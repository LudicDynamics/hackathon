/**
 * doc-command/04 — the world-command effect primitive set.
 *
 * World commands have NO world-mutating power of their own (04 §1). They own a
 * CLOSED map from 7 author-facing verbs to `ACTION_METHODS` entries that already
 * exist: `createEntity` / `moveEntity` / `editEntity` (×3 effects) / `enterLayer`
 * plus the rider `linkCards`. Every capability a command has is therefore one the
 * action layer already exposed (`04 §2.4`), so path resolution, the nook gate,
 * event bookkeeping and the error codes are inherited for free.
 *
 * `arrangeCanvas` is deliberately NOT here (`04 §7.5` rejects it: it demands the
 * functional arranger scope, so a player-triggered command can never reach it,
 * and it writes no event). This module adds NO action method, NO error code and
 * NO event type (`04 §12.3`).
 *
 * The executor (`commands/execute.ts`, Wave B) calls `runEffect`; the receipt
 * (04 §6.6) is consumed by `10` and the front-end.
 */
import type { WorldEvent } from '../schemas/events.js';
import type { ActionErrorCode } from '../actions/errors.js';
import { ActionError } from '../actions/errors.js';
import type { ActionContext } from '../actions/types.js';
import type { LinkStyle } from '../schemas/canvas.js';
import type { WorldStore } from '../store/world-store.js';
import { parseFrontmatter } from '../schemas/frontmatter.js';
import { editEntity } from '../actions/delete.js';
import { createEntity } from '../actions/create.js';
import { moveEntity } from '../actions/move.js';
import { enterLayer } from '../actions/layer.js';
import { linkCards } from '../actions/canvas.js';

import { renderAppend } from '../actions/chalk.js';

// Reused verbatim, never re-implemented (04 §3.5): `append_body` MUST join with
// the ONE existing rule, not a second one (契约 §8 反模式 3).
export { renderAppend } from '../actions/chalk.js';
// The action layer's `editEntity` input, re-exported (not redeclared) so the
// barrel keeps a SINGLE symbol (a duplicate declaration is a TS2308 error).
export type { EditEntityInput } from '../actions/delete.js';

/* ────────────────────────────────────────────────────────────────────────────
 * 1. The closed effect set (04 §2.1 / §6.1)
 * ──────────────────────────────────────────────────────────────────────────── */

/** The closed set of effect names. 7 entries; `run` is NOT a member (R.15). */
export const WORLD_COMMAND_EFFECTS = [
  'give',
  'move',
  'edit',
  'set_status',
  'consume',
  'enter',
  'link',
] as const;
export type WorldCommandEffectName = (typeof WORLD_COMMAND_EFFECTS)[number];

/**
 * `give` accepts EITHER one item (`path`) OR a list (`rewards`). A list is
 * expanded by the ENGINE, one `createEntity` per element, in declaration order
 * (04 §2.6 契约 A). Exactly one of `path` / `rewards` MUST be present.
 */
export interface GiveEffect {
  action: 'give';
  /** Scalar-arg form. */
  path?: string;
  title?: string;
  body?: string;
  frontmatter?: Record<string, unknown>;
  /** Rider: connect the thing just created to this card (04 §2.3 E7). */
  link_to?: string;
  /** `list-args` form. Each element is one `{ path, title?, body? }`. */
  rewards?: Array<{ path: string; title?: string; body?: string }>;
}

/**
 * `consume` — a compound effect over `editEntity`, never a new action method
 * (04 §3.4). Either it moves the thing away (`to`) or it changes it in place
 * (`mark` / `append_body` / `title`); the two outcomes are mutually exclusive.
 */
export interface ConsumeEffect {
  action: 'consume';
  /** Ordered candidate paths. The FIRST one that exists is the one consumed. */
  from: string[];
  /** Move it away instead of editing it in place (§3.3 (b)). */
  to?: string;
  /** Key/values deep-merged into the target's `status.data` (§2.3 E4). */
  mark?: Record<string, string | number | boolean | null>;
  /** Appended verbatim to the target's body (`append_body`, §3.5). */
  append_body?: string;
  /** Optional replacement `title`; omitted = leave it untouched. */
  title?: string;
}

/** One effect's declared shape AFTER `{{ }}` substitution. */
export type EffectInput =
  | GiveEffect
  | { action: 'move'; from: string | string[]; to: string; near?: string }
  | {
      action: 'edit';
      path: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
      append_body?: string;
    }
  | { action: 'set_status'; path: string; values: Record<string, string | number | boolean | null> }
  | ConsumeEffect
  | { action: 'enter'; layer: string }
  | { action: 'link'; from: string; to: string; style?: string; label?: string };

/**
 * What ONE effect reports back (04 §6.1). `03` uses `ok` to decide
 * `on_error: stop|continue`; `05` reads `reused` + `event`; `06` renders from
 * `path` + `event`; the trigger's tool_result carries it verbatim.
 */
export interface EffectOutcome {
  ok: boolean;
  action: WorldCommandEffectName;
  /**
   * The FINAL path this effect acted on (after directory expansion / candidate
   * resolution). `null` only for `enter` (which acts on a layer, not a path).
   */
  path: string | null;
  /**
   * Present on success when a world event was recorded. Absent for `link` (a
   * rider of `give`: it takes effect with the `give`'s `entity_created` and
   * produces no event of its own) and for `reused` replays (no write → no event).
   */
  event?: WorldEvent;
  /** `true` when the effect deliberately did nothing because its result was
   *  already settled (硬门 2). NOT a failure. */
  reused?: true;
  /** Present when `ok === false`. An existing `ActionErrorCode` — this module
   *  invents no new code (§6.3). */
  code?: ActionErrorCode;
  /** The action layer's own message, verbatim. NEVER rewritten (§5.4 (c)). */
  reason?: string;
}

/**
 * The per-command receipt carried in the triggering action's `details` (04 §6.6,
 * `04:999`). `10` and the front-end consume it. `effects[].event` is the REAL
 * event object (not the effect name) so `10` renders each line through the
 * existing `renderEvent` and the wording stays byte-identical to the next turn.
 */
export interface WorldCommandReceipt {
  id: string;
  name: string;
  /** `05`'s four verbs. NOT a boolean — `ok` cannot express `resumed`. */
  settle: 'ran' | 'reused' | 'resumed' | 'failed';
  /** One entry per FLATTENED effect (§2.6), not per `do[]` entry. */
  effects: Array<{
    action: WorldCommandEffectName;
    ok: boolean;
    event?: WorldEvent;
    error?: string;
  }>;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. The reserved-key rejection column (doc-00 §R.2 / 04 §6.1)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Keys a world command MUST NOT write through `edit` (or any effect routing
 * through `editEntity`). `roll_dice` (covers `.result` / `.passed`) would forge
 * already-settled facts (硬门 3); `command_log` / `command_error` would forge a
 * command receipt (硬门 2); `on` would rewrite the trigger graph.
 *
 * This is enforced HERE, at the effect layer — never as a prompt-level request
 * (R.2 item 2). `status` is deliberately NOT reserved: `set_status` and `edit`
 * writing it is a legitimate use (R.2 item 3).
 */
export const RESERVED_FRONTMATTER_KEYS: readonly string[] = [
  'roll_dice',
  'command_log',
  'command_error',
  'on',
] as const;

const RESERVED_LIST_TEXT = 'roll_dice.result, roll_dice.passed, command_log, command_error, on';

/** Throws `invalid_argument` when a would-be merge carries a reserved key. */
function assertNoReservedKeys(frontmatter: Record<string, unknown> | undefined): void {
  if (frontmatter === undefined) return;
  for (const key of RESERVED_FRONTMATTER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(frontmatter, key)) {
      throw new ActionError({
        code: 'invalid_argument',
        message:
          `edit: "${key}" is a reserved key — a world command MUST NOT rewrite ` +
          `already-settled facts or forge a command receipt. Reserved: ${RESERVED_LIST_TEXT}.`,
      });
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Small helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Convert a thrown action failure into an outcome; this module never throws. */
function toErrorOutcome(
  action: WorldCommandEffectName,
  path: string | null,
  err: unknown
): EffectOutcome {
  if (err instanceof ActionError) {
    return { ok: false, action, path, code: err.code, reason: err.message };
  }
  return {
    ok: false,
    action,
    path,
    code: 'internal',
    reason: err instanceof Error ? err.message : String(err),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. The seven effect runners
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `give` → `createEntity` (04 §2.3 E1).
 *
 * Returns one outcome PER item that RAN. The `list-args` form stops at the first
 * failure (`04 §2.6` 契约 A): already-settled prefix stays in the world, later
 * items never run. An empty `rewards` yields zero outcomes — legal, not an error.
 */
export async function runGiveEffect(ctx: ActionContext, input: GiveEffect): Promise<EffectOutcome[]> {
  const hasPath = input.path !== undefined;
  const hasRewards = input.rewards !== undefined;
  if (hasPath === hasRewards) {
    return [
      {
        ok: false,
        action: 'give',
        path: input.path ?? null,
        code: 'invalid_argument',
        reason:
          `give: pass exactly one of "path" (one item) or "rewards" (a list), ` +
          `not ${hasPath ? 'both' : 'neither'}.`,
      },
    ];
  }

  const items = hasPath
    ? [{ path: input.path as string, title: input.title, body: input.body }]
    : (input.rewards as Array<{ path: string; title?: string; body?: string }>);

  const outcomes: EffectOutcome[] = [];
  for (const item of items) {
    try {
      const frontmatter: Record<string, unknown> = {
        ...(input.frontmatter ?? {}),
        // `title` is sugar for `frontmatter.title` (04 §2.3 E1: `nameOf` reads it).
        ...(item.title !== undefined ? { title: item.title } : {}),
      };
      const result = await createEntity(ctx, { path: item.path, body: item.body, frontmatter });
      outcomes.push({ ok: true, action: 'give', path: result.details.path, event: result.details.event });
      if (input.link_to !== undefined) {
        outcomes.push(await runLinkEffect(ctx, { action: 'link', from: result.details.path, to: input.link_to }));
      }
    } catch (err) {
      outcomes.push(toErrorOutcome('give', item.path, err));
      break; // stop-at-failure (04 §2.6 契约 A)
    }
  }
  return outcomes;
}

/** `move` → `moveEntity` (04 §2.3 E2). A `from` array is a candidate list. */
export async function runMoveEffect(
  ctx: ActionContext,
  input: { action: 'move'; from: string | string[]; to: string; near?: string }
): Promise<EffectOutcome> {
  const candidates = Array.isArray(input.from) ? input.from : [input.from];
  try {
    let from: string | null = null;
    for (const candidate of candidates) {
      if ((await ctx.store.statKind(candidate)) === 'file') {
        from = candidate;
        break;
      }
    }
    if (from === null) {
      throw new ActionError({
        code: 'not_found',
        message: `Entity not found: ${candidates.map((p) => `"${p}"`).join(', ')}`,
      });
    }
    const result = await moveEntity(ctx, { from, to: input.to, near: input.near });
    return { ok: true, action: 'move', path: result.details.path, event: result.details.event };
  } catch (err) {
    return toErrorOutcome('move', candidates[0], err);
  }
}

/** `edit` → `editEntity` (04 §2.3 E3). `append_body` joins via `renderAppend`. */
export async function runEditEffect(
  ctx: ActionContext,
  input: {
    action: 'edit';
    path: string;
    frontmatter?: Record<string, unknown>;
    body?: string;
    append_body?: string;
  }
): Promise<EffectOutcome> {
  try {
    // The reserved-key column is enforced here, before any write (doc-00 §R.2).
    assertNoReservedKeys(input.frontmatter);
    if (input.body !== undefined && input.append_body !== undefined) {
      throw new ActionError({
        code: 'invalid_argument',
        message: 'edit: pass either "body" (replace) or "append_body" (append), not both.',
      });
    }

    const body = await joinedAppendBody(ctx.store, input.path, input.append_body, input.body);

    const result = await editEntity(ctx, { path: input.path, frontmatter: input.frontmatter, body });
    return { ok: true, action: 'edit', path: result.details.path, event: result.details.event };
  } catch (err) {
    return toErrorOutcome('edit', input.path, err);
  }
}

/**
 * `set_status` → `editEntity` (narrow) (04 §2.3 E4).
 *
 * The whole POINT is the deep merge: `editEntity` shallow-merges, so writing
 * `frontmatter: { status: { data: {...} } }` directly would erase the author's
 * `status.label` / `status.chart`. We read-modify-write the `status` object.
 */
export async function runSetStatusEffect(
  ctx: ActionContext,
  input: { action: 'set_status'; path: string; values: Record<string, string | number | boolean | null> }
): Promise<EffectOutcome> {
  const { path, values } = input;
  try {
    const kind = await ctx.store.statKind(path);
    if (kind !== 'file') {
      throw new ActionError({ code: 'not_found', message: `Entity not found: "${path}"` });
    }
    const parsed = parseFrontmatter(await ctx.store.readFile(path));
    const existingStatus = isPlainObject(parsed.frontmatter?.status) ? parsed.frontmatter.status : {};
    const existingData = isPlainObject(existingStatus.data) ? existingStatus.data : {};
    const frontmatter: Record<string, unknown> = {
      status: { ...existingStatus, data: { ...existingData, ...values } },
    };
    assertNoReservedKeys(frontmatter);
    const result = await editEntity(ctx, { path, frontmatter });
    return { ok: true, action: 'set_status', path: result.details.path, event: result.details.event };
  } catch (err) {
    return toErrorOutcome('set_status', path, err);
  }
}

/**
 * `consume` — the compound effect (04 §3.4). Resolves the FIRST existing
 * candidate, treats an already-set `mark` as a replay (`reused`, no write), and
 * otherwise either moves the thing away (`to`) or edits it in place.
 */
export async function runConsumeEffect(ctx: ActionContext, input: ConsumeEffect): Promise<EffectOutcome> {
  const store = ctx.store;

  // 1. Resolve the FIRST candidate that exists — bounded `from.length` stats,
  //    never an event scan (04 §4.3).
  let target: string | null = null;
  for (const candidate of input.from) {
    if ((await store.statKind(candidate)) === 'file') {
      target = candidate;
      break;
    }
  }
  if (target === null) {
    // 硬门 6: never silently treat a missing item as consumed.
    return {
      ok: false,
      action: 'consume',
      path: input.from[0] ?? null,
      code: 'not_found',
      reason: `Nothing to spend: none of ${input.from.map((p) => `"${p}"`).join(', ')} exists.`,
    };
  }

  const hasInPlace = input.mark !== undefined || input.append_body !== undefined || input.title !== undefined;
  if (input.to !== undefined && hasInPlace) {
    return {
      ok: false,
      action: 'consume',
      path: target,
      code: 'invalid_argument',
      reason:
        'consume: "to" (move it away) and "mark"/"append_body"/"title" (change it in place) ' +
        'are different outcomes; pass one.',
    };
  }

  try {
    // 2. Idempotency precondition: the mark is already set → this is a REPLAY,
    //    not a new spend. Write nothing (硬门 2). `05` owns the receipt policy.
    if (input.mark !== undefined && (await alreadyMarked(store, target, input.mark))) {
      return { ok: true, action: 'consume', path: target, reused: true };
    }

    // 3. One call. The engine does the read-modify-write; the AUTHOR never does
    //    string concatenation (04 §3.4 step 3).
    if (input.to !== undefined) {
      const moved = await moveEntity(ctx, { from: target, to: input.to });
      return { ok: true, action: 'consume', path: moved.details.path, event: moved.details.event };
    }

    const frontmatter = await mergedStatusFrontmatter(store, target, input.mark, input.title);
    assertNoReservedKeys(frontmatter);
    const body = await joinedAppendBody(store, target, input.append_body);
    const edited = await editEntity(ctx, { path: target, frontmatter, body });
    return { ok: true, action: 'consume', path: edited.details.path, event: edited.details.event };
  } catch (err) {
    return toErrorOutcome('consume', target, err);
  }
}

/** `enter` → `enterLayer` (04 §2.3 E6). Acts on a layer, so `path` is `null`. */
export async function runEnterEffect(
  ctx: ActionContext,
  input: { action: 'enter'; layer: string }
): Promise<EffectOutcome> {
  try {
    const result = await enterLayer(ctx, { layer: input.layer });
    return { ok: true, action: 'enter', path: null, event: result.details.event };
  } catch (err) {
    return toErrorOutcome('enter', null, err);
  }
}

/**
 * `link` → `linkCards` (04 §2.3 E7). A rider, not a standalone power: it lands
 * NO event, so it only appears as `give`'s `link_to` (and, when a declaration
 * names it directly, as an effect whose outcome carries `path` but no `event`).
 */
export async function runLinkEffect(
  ctx: ActionContext,
  input: { action: 'link'; from: string; to: string; style?: string; label?: string }
): Promise<EffectOutcome> {
  try {
    const result = await linkCards(ctx, {
      op: 'create',
      from: input.from,
      to: input.to,
      style: input.style as LinkStyle | undefined,
      label: input.label,
    });
    return { ok: true, action: 'link', path: result.details.path ?? input.from };
  } catch (err) {
    return toErrorOutcome('link', input.from, err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. The dispatcher (04 §9.1) — the ONLY entry the executor calls
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Run ONE declared effect. Returns an outcome array because `give`'s `list-args`
 * form expands to N independent steps (04 §2.6 / §6.7): the array length is NOT
 * `do[]`'s length, and `03` MUST budget on the FLATTENED count.
 *
 * Action failures never throw out of here — they come back as `ok: false`
 * outcomes carrying the action layer's own code and message (04 §6.3).
 */
export async function runEffect(ctx: ActionContext, input: EffectInput): Promise<EffectOutcome[]> {
  switch (input.action) {
    case 'give':
      return runGiveEffect(ctx, input);
    case 'move':
      return [await runMoveEffect(ctx, input)];
    case 'edit':
      return [await runEditEffect(ctx, input)];
    case 'set_status':
      return [await runSetStatusEffect(ctx, input)];
    case 'consume':
      return [await runConsumeEffect(ctx, input)];
    case 'enter':
      return [await runEnterEffect(ctx, input)];
    case 'link':
      return [await runLinkEffect(ctx, input)];
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6. `consume` helpers (04 §3.5 — NEW, private to this module)
 * ──────────────────────────────────────────────────────────────────────────── */

/** True when every key/value of `mark` already equals the target's `status.data`. */
async function alreadyMarked(
  store: WorldStore,
  path: string,
  mark: Record<string, unknown>
): Promise<boolean> {
  const parsed = parseFrontmatter(await store.readFile(path));
  const status = isPlainObject(parsed.frontmatter?.status) ? parsed.frontmatter.status : {};
  const data = isPlainObject(status.data) ? status.data : {};
  return Object.entries(mark).every(([key, value]) => data[key] === value);
}

/**
 * Read-modify-write that produces the shallow-merge-safe `frontmatter` argument
 * for `editEntity` (04 §2.3 E4). Returns `undefined` when there is nothing to
 * change — so a `consume` with no `mark`/`title` still lands `append_body` alone.
 */
async function mergedStatusFrontmatter(
  store: WorldStore,
  path: string,
  mark?: Record<string, string | number | boolean | null>,
  title?: string
): Promise<Record<string, unknown> | undefined> {
  if (mark === undefined && title === undefined) return undefined;
  const frontmatter: Record<string, unknown> = {};
  if (title !== undefined) frontmatter.title = title;
  if (mark !== undefined) {
    const parsed = parseFrontmatter(await store.readFile(path));
    const existingStatus = isPlainObject(parsed.frontmatter?.status) ? parsed.frontmatter.status : {};
    const existingData = isPlainObject(existingStatus.data) ? existingStatus.data : {};
    frontmatter.status = { ...existingStatus, data: { ...existingData, ...mark } };
  }
  return frontmatter;
}

/**
 * Produce the `body` argument for `editEntity` from an optional `append_body`
 * (04 §3.5, `[C-6]`). Joining happens HERE — the author supplies only text, and
 * the ONE existing join rule (`renderAppend`) is reused, never a second one
 * (契约 §8 反模式 3). A missing `append_body` leaves the body untouched.
 */
async function joinedAppendBody(
  store: WorldStore,
  path: string,
  appendBody?: string,
  replaceBody?: string
): Promise<string | undefined> {
  if (appendBody === undefined) return replaceBody;
  const kind = await store.statKind(path);
  if (kind !== 'file') {
    throw new ActionError({ code: 'not_found', message: `Entity not found: "${path}"` });
  }
  const existing = parseFrontmatter(await store.readFile(path)).body;
  return renderAppend(existing, appendBody);
}
