import type { WorldEvent } from '../schemas/events.js';
import type { WorldStore } from '../store/world-store.js';
import type { AgentScope, Actor } from './actor.js';

/**
 * Everything an action needs, and nothing else.
 * Deliberately transport-free: no HTTP req/res, no WebSocket, no pi-rp types.
 * Frozen fields: store / actor / turn / now? / rng?. The one later addition is
 * `commandDepth` (docs/command/02 §11.4) — the ONLY thing that stops a world
 * command's effects from triggering further world commands. No AbortSignal, no
 * progress channel: a command chain is depth 1 by construction, so nothing
 * needs to interrupt it.
 */
export interface ActionContext {
  store: WorldStore;
  /** Who is acting (00 §3). */
  actor: Actor;
  /** Launcher-injected, model-inaccessible process scope. */
  agentScope?: AgentScope;
  /** Internal capability used only by the validated /api/nook-note adapter. */
  nookNote?: boolean;
  /**
   * How many world commands deep this call is. Absent === 0 === a real actor's
   * first action. Any value > 0 suppresses every implicit command trigger point
   * (docs/command/02 §3 step 2): a command's effects never trigger further
   * commands. The ONLY writer is `03`'s executor, adding 1 when it invokes an
   * action on a command's behalf.
   */
  commandDepth?: number;
  /**
   * Merge anchor (doc-21 §3.4). One agent turn, or one HTTP request.
   * Opaque string; the action layer never parses it, only forwards it.
   */
  turn: string;
  /** Injectable clock for tests; defaults to () => new Date().toISOString(). */
  now?: () => string;
  /** Injectable uniform [0,1) source for `rollDice`; defaults to Math.random. */
  rng?: () => number;
}
export type ActionDetails = Record<string, any>;

/**
 * The single return shape of the whole action layer.
 * `text` is the human-facing English line (00 §6.2); `details` is the stable
 * structured payload the router and the toolkit wrap differently.
 * `event` is OPTIONAL: read-only actions (lookAt / viewCanvas / getComponent /
 * showComponent) write nothing and therefore carry no event.
 */
export interface ActionResult<TDetails extends ActionDetails = ActionDetails> {
  text: string;
  details: TDetails & { event?: WorldEvent };
}
