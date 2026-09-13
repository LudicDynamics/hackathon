/**
 * dice-ceremony.ts — boundary guard, layer filter and de-dup for the
 * `dice_result` presentation frame (docs/perform/02). Module state, no React,
 * no side effects (same shape as lib/phantom.ts / lib/writer-state.ts).
 *
 * The frame is the agent's counterpart to the player's own /api/dice roll: the
 * server emits it the moment `roll_dice` lands, and the frontend replays the
 * exact same ceremony (docs/perform/02 §1). It changes no data, posts no
 * request and writes no event (§5) — a missed frame costs nothing, because
 * `roll_resolved` → `world_event` → `fetchLayer` still shows the result.
 */

/** Frame after the boundary guard: same shape as DiceVerdict (DiceRoller.tsx)
 *  plus the presentation-only fields the ceremony reads. */
export interface DiceFrameVerdict {
  path: string;
  name: string;
  dice: string;
  desc: string;
  expect: string;
  result: number;
  passed: boolean;
  rolls: number[];
  crit: boolean;
  fumble: boolean;
  layer: string | null;
}

/** One pending ceremony. `key` changes per play so React remounts the
 *  component and the CSS animations restart from zero (docs/perform/02 §8.1). */
export interface CeremonySnapshot {
  verdict: DiceFrameVerdict;
  key: number;
}

/** De-dup window / cap (§6.2): replay after a WS reconnect must not roll twice. */
const SEEN_TTL_MS = 5000;
const SEEN_LIMIT = 50;

/** path → playedAt, in insertion order (Map order = FIFO for eviction). */
const seen = new Map<string, number>();

/**
 * Boundary guard for the untrusted frame payload. Any missing required field
 * or type mismatch → null: the whole frame is dropped, never half-rendered
 * (docs/perform/02 §7.2).
 *
 * Stricter than `parseDiceVerdict` (DiceRoller.tsx) on purpose: that one guards
 * the HTTP response and has no `path`, while the frame is unusable without one.
 */
export function parseDiceFrame(raw: unknown): DiceFrameVerdict | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.path !== 'string' || o.path === '') return null;
  if (typeof o.result !== 'number' || !Number.isFinite(o.result)) return null;
  if (typeof o.passed !== 'boolean') return null;
  // `rolls` is the per-die face list (rules/dice.ts). No fallback to `[result]`:
  // that would stage a 2d6 as a single die (docs/perform/02 §2.3, §7.2).
  if (!Array.isArray(o.rolls) || o.rolls.length === 0) return null;
  if (!o.rolls.every((r) => typeof r === 'number' && Number.isFinite(r))) return null;

  return {
    path: o.path,
    name: typeof o.name === 'string' ? o.name : '',
    dice: typeof o.dice === 'string' ? o.dice : '',
    desc: typeof o.desc === 'string' ? o.desc : '',
    expect: typeof o.expect === 'string' ? o.expect : '',
    result: o.result,
    passed: o.passed,
    rolls: o.rolls as number[],
    // No 95/5 heuristic: the engine decides crit/fumble (roll-dice.ts). The
    // frame either carries them or the roll is plain (docs/perform/02 §7.2).
    crit: typeof o.crit === 'boolean' ? o.crit : false,
    fumble: typeof o.fumble === 'boolean' ? o.fumble : false,
    // `null` (backpack / nook entity) and missing both mean "no layer filter".
    layer: typeof o.layer === 'string' ? o.layer : null,
  };
}

/**
 * Layer filter + de-dup (§6.2, §6.4). A frame for another layer is discarded,
 * never queued: queuing would replay a stale ceremony after a layer switch.
 */
export function shouldPlayFrame(v: DiceFrameVerdict, currentLayer: string, now = Date.now()): boolean {
  if (v.layer !== null && v.layer !== currentLayer) return false;
  const at = seen.get(v.path);
  if (at !== undefined && now - at < SEEN_TTL_MS) return false;
  return true;
}

/** Register a play (by path), FIFO-capped at SEEN_LIMIT entries. */
export function markPlayed(path: string, now = Date.now()): void {
  seen.delete(path); // re-insert at the tail so re-plays refresh the window
  seen.set(path, now);
  while (seen.size > SEEN_LIMIT) {
    const oldest = seen.keys().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
}

// ---- Subscription (React side, useSyncExternalStore) ----

let snapshot: CeremonySnapshot | null = null;
let key = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

export function subscribeCeremony(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current pending ceremony. The reference only changes when it changes — the
 *  `Object.is` requirement of useSyncExternalStore. */
export function getCeremonySnapshot(): CeremonySnapshot | null {
  return snapshot;
}

/**
 * Face shown while a die is still tumbling: a deterministic roll-in so the
 * spin survives React re-renders (never Math.random during render). Values
 * above a d6 cycle up to 100 — the tiles show raw numbers, not pips, because
 * `rolls` can hold 1d100 / 4d6 faces (docs/perform/02 §8).
 */
export function rollingFace(index: number, tick: number, value: number): number {
  const ceiling = value > 6 ? 100 : 6;
  return ((index * 7 + tick * 13) % ceiling) + 1;
}


/** Stage one ceremony (App's `setCeremony`); a new `key` remounts the view. */
export function playCeremony(verdict: DiceFrameVerdict): void {
  key += 1;
  snapshot = { verdict, key };
  notify();
}

/** End the ceremony (played out / dismissed / layer switched). Idempotent. */
export function clearCeremony(): void {
  if (snapshot === null) return;
  snapshot = null;
  notify();
}

/** Test-only seam: forget every played path (one test must not leak into the
 *  next). Mirrors the debug seams in lib/audio.ts / useWorld.ts. */
export function resetSeenForTest(): void {
  seen.clear();
}
