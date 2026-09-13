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
  ACTIVITY_LOG_MAX_ENTRIES,
  ACTIVITY_STALE_TTL_MS,
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
  /** Bounded terminal-inclusive projection for the complete activity log. */
  getLogSnapshot(): readonly AgentActivity[];
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
  let logList: readonly AgentActivity[] = [];
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function notify(): void {
    for (const cb of listeners) cb();
  }

  function hasClockWork(): boolean {
    return list.length > 0 || logList.some((activity) => activity.state === 'running');
  }

  function armTimer(): void {
    if (timer !== null || !hasClockWork()) return;
    timer = setInterval(() => tick(), TICK_MS);
  }

  function disarmTimer(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  function withPromotions(next: readonly AgentActivity[], now: number): readonly AgentActivity[] {
    let out = promoteActivities(next, 'rail', now, MAX_VISIBLE_ACTIVITIES);
    out = promoteActivities(out, 'character-modal', now, MAX_VISIBLE_ACTIVITIES);
    return out;
  }

  function pruneLogRunning(next: readonly AgentActivity[], now: number): readonly AgentActivity[] {
    let changed = false;
    const out = next.map((activity) => {
      if (activity.state !== 'running' || now - activity.startedAt < ACTIVITY_STALE_TTL_MS) return activity;
      changed = true;
      return { ...activity, state: 'error' as const, errorKind: 'timeout', endedAt: now };
    });
    return changed ? out : next;
  }

  function boundLog(next: readonly AgentActivity[]): readonly AgentActivity[] {
    if (next.length <= ACTIVITY_LOG_MAX_ENTRIES) return next;
    const terminals = next
      .filter((activity) => activity.state !== 'running')
      .sort((a, b) =>
        (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt) ||
        a.activityId.localeCompare(b.activityId),
      );
    const removeCount = Math.min(terminals.length, next.length - ACTIVITY_LOG_MAX_ENTRIES);
    if (removeCount === 0) return next;
    const removed = new Set(terminals.slice(0, removeCount).map((activity) => activity.activityId));
    return next.filter((activity) => !removed.has(activity.activityId));
  }

  function tick(now: number = Date.now()): void {
    const nextList = withPromotions(pruneActivities(list, now), now);
    const nextLog = boundLog(pruneLogRunning(logList, now));
    const listChanged = nextList !== list;
    const logChanged = nextLog !== logList;
    if (listChanged) list = nextList;
    if (logChanged) logList = nextLog;
    if (listChanged || logChanged) notify();
    if (!hasClockWork()) disarmTimer();
  }

  function ingest(raw: unknown, now: number = Date.now()): boolean {
    const act = normalizeAgentActivityFrame(raw, now);
    if (act === null) return false;

    const at = act.state === 'running' ? act.startedAt : (act.endedAt ?? act.startedAt);
    const prunedList = pruneActivities(list, at);
    const prunedLog = boundLog(pruneLogRunning(logList, at));
    const existingLog = prunedLog.find((entry) => entry.activityId === act.activityId);
    const nextLog = boundLog(upsertActivity(prunedLog, act));

    const nextList = existingLog === undefined || existingLog.state === 'running'
      ? withPromotions(upsertActivity(prunedList, act), at)
      : withPromotions(prunedList, at);
    const listChanged = nextList !== list;
    const logChanged = nextLog !== logList;
    if (!listChanged && !logChanged) return false;
    list = nextList;
    logList = nextLog;
    armTimer();
    notify();
    return true;
  }

  function clearSurface(surface: ActivitySurface, now: number = Date.now()): void {
    let changed = false;
    const cancel = (activity: AgentActivity): AgentActivity => {
      changed = true;
      return {
        ...activity,
        state: 'error',
        errorKind: 'cancelled',
        endedAt: now,
        visibleAt: activity.visibleAt ?? now,
      };
    };
    const nextList = list.map((activity) =>
      activity.state === 'running' && surfaceForSource(activity.source) === surface
        ? cancel(activity)
        : activity,
    );
    const nextLog = logList.map((activity) =>
      activity.state === 'running' && surfaceForSource(activity.source) === surface
        ? cancel(activity)
        : activity,
    );
    if (!changed) return;
    list = nextList;
    logList = nextLog;
    armTimer();
    notify();
  }

  function clearAll(): void {
    disarmTimer();
    if (list.length === 0 && logList.length === 0) return;
    list = [];
    logList = [];
    notify();
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    if (hasClockWork()) armTimer();
    return () => listeners.delete(cb);
  }

  return {
    subscribe,
    getSnapshot: () => list,
    getLogSnapshot: () => logList,
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
