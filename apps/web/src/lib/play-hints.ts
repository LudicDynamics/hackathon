import { useSyncExternalStore } from 'react';

const KEY = 'airp:play-hints';
const listeners = new Set<() => void>();
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* Keep the default in memory. */ }
export function setPlayHintsEnabled(next: boolean): void {
  enabled = next;
  try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* Storage is optional. */ }
  listeners.forEach(listener => listener());
}
export function usePlayHintsEnabled(): boolean {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => enabled, () => true);
}

export const PLAY_HINT_REQUEST = 'Give me one small next-step hint based only on what I have actually discovered and the items I carry. Read the full current scene README, including its intent, and the relevant existing records once. Say what I can try, where, and why; distinguish drafting, reviewing, and confirming an action. If an earlier action is incomplete, identify the missing step without calling it completed. Do not reveal undiscovered answers, invent clues, advance time, send anything, consume items, unlock gates, or change game state. Only write or update one short hint Chalk, then wait for my decision.';
