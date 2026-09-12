import { randomUUID } from 'node:crypto';
import type { WorldStore } from '../store/world-store.js';
import type { ActionContext, ActionDetails, ActionResult } from './types.js';
import type { Actor } from './actor.js';
import { fail } from './errors.js';

/**
 * `createActionService` is the single action entry point shared by the server
 * routes and the agent extension tools (00 §1 / doc-20 §12): both `new` their
 * own `WorldStore`, but both call this function, so the UI and the agent can
 * never run two sets of dice / move / choice semantics.
 *
 * The service binds the frozen twenty-four method names and dispatches each to
 * a handler that the per-tool modules (02–11) register into `ACTION_REGISTRY`.
 * This module therefore carries no business logic — only the binding table —
 * which is exactly the split 01 §2.1 asks for, and it lets the shared skeleton
 * compile before any tool module exists.
 */

/** Inputs are passed through opaquely; each tool module owns its real shape. */
export type ActionInput = Record<string, unknown>;

export type ActionHandler = (ctx: ActionContext, input: ActionInput) => Promise<ActionResult>;

/**
 * The frozen method list (01 §2.6 + §5: 22 tool methods and the 2 extra
 * `createEntity` / `carryFollowers` rows). The names are the contract; the
 * per-tool input and detail types live with their own modules and are applied
 * by the callers that know them.
 */
export interface ActionService {
  readonly ctx: ActionContext;
  readonly actor: Actor;

  // — doc-03 (read-only, no event) —
  lookAt(input: ActionInput): Promise<ActionResult>;
  viewCanvas(input: ActionInput): Promise<ActionResult>;
  // — doc-02 —
  writeChalk(input: ActionInput): Promise<ActionResult>;
  // — doc-04 —
  moveEntity(input: ActionInput): Promise<ActionResult>;
  removeEntity(input: ActionInput): Promise<ActionResult>;
  editEntity(input: ActionInput): Promise<ActionResult>;
  // — doc-05 —
  moveCharacter(input: ActionInput): Promise<ActionResult>;
  setFollowing(input: ActionInput): Promise<ActionResult>;
  carryFollowers(input: ActionInput): Promise<ActionResult>;
  // — doc-06 —
  chooseOption(input: ActionInput): Promise<ActionResult>;
  // — doc-07 —
  rollDice(input: ActionInput): Promise<ActionResult>;
  // — doc-08 —
  useItemOn(input: ActionInput): Promise<ActionResult>;
  // — doc-09 (no event; canvas.db state only) —
  linkCards(input: ActionInput): Promise<ActionResult>;
  arrangeCards(input: ActionInput): Promise<ActionResult>;
  // — doc-10 (read-only / broadcast only) —
  getComponent(input: ActionInput): Promise<ActionResult>;
  showComponent(input: ActionInput): Promise<ActionResult>;
  // — doc-11 —
  generateImage(input: ActionInput): Promise<ActionResult>;
  // — doc-11 / doc-12 —
  enterLayer(input: ActionInput): Promise<ActionResult>;
  noteCharacterTalked(input: ActionInput): Promise<ActionResult>;
  recordLayerInitialized(input: ActionInput): Promise<ActionResult>;
  /** The ONE action that appends an event while reporting failure (doc-21 §3.6). */
  recordLayerInitFailed(input: ActionInput): Promise<ActionResult>;
  // — doc-12 (god create branch) —
  createEntity(input: ActionInput): Promise<ActionResult>;
  // — doc-16 (signature frozen; implementation post-hackathon) —
  snapshotWorld(input: ActionInput): Promise<ActionResult>;
  rollbackWorld(input: ActionInput): Promise<ActionResult>;
}

/** The registered method names, in the order 01 §5 lists them. */
export const ACTION_METHODS = [
  'lookAt',
  'viewCanvas',
  'writeChalk',
  'moveEntity',
  'removeEntity',
  'editEntity',
  'moveCharacter',
  'setFollowing',
  'carryFollowers',
  'chooseOption',
  'rollDice',
  'useItemOn',
  'linkCards',
  'arrangeCards',
  'getComponent',
  'showComponent',
  'generateImage',
  'enterLayer',
  'noteCharacterTalked',
  'recordLayerInitialized',
  'recordLayerInitFailed',
  'createEntity',
  'snapshotWorld',
  'rollbackWorld',
] as const;

export type ActionMethodName = (typeof ACTION_METHODS)[number];

const ACTION_REGISTRY = new Map<ActionMethodName, ActionHandler>();

/**
 * Called by the per-tool modules (02–11) at import time. A handler receives the
 * service's `ActionContext` plus the caller's input and returns the frozen
 * `{ text, details }`, or throws an `ActionError`.
 */
export function registerAction(name: ActionMethodName, handler: ActionHandler): void {
  ACTION_REGISTRY.set(name, handler);
}

/** Test seam: the probe / unit tests drop registrations between worlds. */
export function clearActionRegistry(): void {
  ACTION_REGISTRY.clear();
}

async function invoke(name: ActionMethodName, ctx: ActionContext, input: ActionInput): Promise<ActionResult> {
  const handler = ACTION_REGISTRY.get(name);
  if (!handler) {
    fail('unsupported', `Action '${name}' is not implemented yet (no handler registered)`);
  }
  return handler(ctx, input);
}

export function createActionService(
  store: WorldStore,
  actor: Actor,
  opts?: { turn?: string; now?: () => string; rng?: () => number }
): ActionService {
  const ctx: ActionContext = {
    store,
    actor,
    // One service instance = one batch anchor (01 §2.6): the C entry passes a
    // `req:<uuid>`; the A entry passes the agent's `turn:<session>:<n>`.
    turn: opts?.turn ?? `svc:${randomUUID()}`,
    now: opts?.now,
    rng: opts?.rng,
  };
  const bind = (name: ActionMethodName) => (input: ActionInput) => invoke(name, ctx, input);

  const service = { ctx, actor } as ActionService;
  for (const name of ACTION_METHODS) {
    (service as unknown as Record<string, unknown>)[name] = bind(name);
  }
  return service;
}
