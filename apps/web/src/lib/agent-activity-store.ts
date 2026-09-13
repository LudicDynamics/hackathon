/**
 * agent-activity-store.ts — module store for the `agent_activity` chips
 * (docs/agent-awareness/03 §3.3). `useSyncExternalStore`-compatible, same shape
 * as lib/dice-ceremony.ts / lib/writer-state.ts.
 *
 * The store owns the only list of chips. Components never listen on
 * `airp:agent-frame` themselves (03 §9.3): `useWorld`'s `agent_activity` case
 * is the single ingest point, and the timer below is the only clock. The list
 * reference only changes when the list really changes, which is what
 * `useSyncExternalStore`'s `Object.is` check needs — and what keeps the 250ms
 * tick from re-rendering an idle rail.
 */

import {
  MAX_VISIBLE_ACTIVITIES,
  normalizeAgentActivityFrame,
  promoteActivities,
  pruneActivities,
  surfaceForSource,
  upsertActivity,
  type ActivitySurface,
  type AgentActivity,
} from './agent-activity.js';

export interface AgentActivityStore {
  subscribe(cb: () => void): () => void;
  /** Reference-stable snapshot: a new array only when the content changed. */
  getSnapshot(): readonly AgentActivity[];
  /** Only entry point: normalize + upsert + prune. True when anything changed. */
  ingest(raw: unknown, now?: number): boolean;
  /** running → error('cancelled'); used when the character / nook closes. */
  clearSurface(surface: ActivitySurface, now?: number): void;
  /** Hard clear, no fade tail: disconnect / world switch. */
  clearAll(): void;
  /** Lazy clock advance (250ms); tests call it directly with an explicit now. */
  tick(now?: number): void;
}

const TICK_MS = 250;

export function createAgentActivityStore(): AgentActivityStore {
  let list: readonly AgentActivity[] = [];
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function notify(): void {
    for (const cb of listeners) cb();
  }

  function armTimer(): void {
    if (timer !== null || list.length === 0) return;
    timer = setInterval(() => tick(), TICK_MS);
  }

  function disarmTimer(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  /** Promote queued chips for both surfaces after any change to the list. */
  function withPromotions(next: readonly AgentActivity[], now: number): readonly AgentActivity[] {
    let out = promoteActivities(next, 'rail', now, MAX_VISIBLE_ACTIVITIES);
    out = promoteActivities(out, 'character-modal', now, MAX_VISIBLE_ACTIVITIES);
    return out;
  }

  function tick(now: number = Date.now()): void {
    const next = withPromotions(pruneActivities(list, now), now);
    // A tick with nothing to do must not swap in a new array: that would make
    // every consumer re-render every 250ms for the life of the process.
    if (next !== list) {
      list = next;
      notify();
    }
    if (list.length === 0) disarmTimer();
  }

  function ingest(raw: unknown, now: number = Date.now()): boolean {
    const act = normalizeAgentActivityFrame(raw, now);
    if (act === null) return false;

    // Advance the clock to the frame's own time first, so a stale chip that a
    // late frame might otherwise resurrect is retired before the merge.
    const at = act.state === 'running' ? act.startedAt : (act.endedAt ?? act.startedAt);
    const pruned = pruneActivities(list, at);
    const merged = upsertActivity(pruned, act);
    const next = withPromotions(merged, at);
    // Absorbed frame and no promotion → nothing observable changed.
    if (next === list) return false;
    list = next;
    armTimer();
    notify();
    return true;
  }

  function clearSurface(surface: ActivitySurface, now: number = Date.now()): void {
    let changed = false;
    const next = list.map((a) => {
      if (a.state !== 'running' || surfaceForSource(a.source) !== surface) return a;
      changed = true;
      return {
        ...a,
        state: 'error' as const,
        errorKind: 'cancelled',
        endedAt: now,
        visibleAt: a.visibleAt ?? now,
      };
    });
    if (!changed) return;
    list = next;
    armTimer();
    notify();
  }

  function clearAll(): void {
    disarmTimer();
    if (list.length === 0) return;
    list = [];
    notify();
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    // First listener while chips already exist: start the clock even if the
    // store was populated before React mounted.
    if (list.length > 0) armTimer();
    return () => {
      listeners.delete(cb);
    };
  }

  return {
    subscribe,
    getSnapshot: () => list,
    ingest,
    clearSurface,
    clearAll,
    tick,
  };
}

/** Singleton wired into `useWorld` / `App` / the rails. */
export const agentActivityStore: AgentActivityStore = createAgentActivityStore();

/** Test seam: reset the singleton between cases (mirrors resetSeenForTest). */
export function resetAgentActivityForTest(): void {
  agentActivityStore.clearAll();
}
