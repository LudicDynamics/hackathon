import type { WorldEvent } from '../schemas/events.js';
import type { WorldStore } from '../store/world-store.js';
import type { Actor } from './actor.js';

/**
 * Everything an action needs, and nothing else.
 * Deliberately transport-free: no HTTP req/res, no WebSocket, no pi-rp types.
 * Frozen fields: store / actor / turn / now? / rng?. No AbortSignal, no progress channel.
 */
export interface ActionContext {
  store: WorldStore;
  /** Who is acting (00 §3). */
  actor: Actor;
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
