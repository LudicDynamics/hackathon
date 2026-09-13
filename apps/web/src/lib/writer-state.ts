/**
 * Writer busy state — module scope, React-visible via useSyncExternalStore.
 *
 * The writer is "writing" from the moment it starts a turn until `writer_idle`
 * arrives. `WriterBar` disables input while writing (docs/ui/前端改造计划 T3.4:
 * "writing 中再按 Enter → placeholder 变『作家正在写……』，输入无效（诚实，不排队
 * 不打断）"). The state must also reset on WS reconnect, or a `writer_idle` lost
 * to a disconnect leaves the input permanently disabled (docs/perform/01 §6.4).
 */

import { useSyncExternalStore } from 'react';

export type WriterPhase = 'idle' | 'writing';

export interface WriterState {
  phase: WriterPhase;
  reason: 'turn' | 'chalk' | null;
}

let state: WriterState = { phase: 'idle', reason: null };
const listeners = new Set<() => void>();

function set(next: WriterState): void {
  if (next.phase === state.phase && next.reason === state.reason) return;
  state = next;
  for (const fn of listeners) fn();
}

export function beginTurn(reason: 'turn' | 'chalk'): void {
  set({ phase: 'writing', reason });
}

export function endTurn(): void {
  set({ phase: 'idle', reason: null });
}

/** Reconnect guard: a lost `writer_idle` must not wedge the input. */
export function reset(): void {
  set({ phase: 'idle', reason: null });
}

export function getWriterState(): WriterState {
  return state;
}

export function subscribeWriterState(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useWriterPhase(): WriterPhase {
  return useSyncExternalStore(subscribeWriterState, getWriterState).phase;
}
