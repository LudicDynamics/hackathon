import { useEffect, useState } from 'react';

/**
 * Which portrait may play, given every card on a canvas (nook 03 §③-6).
 *
 * The canvas-level invariant is "at most ONE portrait video decodes at a time"
 * (AGENTS §7.6: the cost of many videos is compositor layers, not paint). Cards
 * arrive in server row order (z ascending), so the LAST portrait is the visual
 * focus and keeps the clip; every other portrait is forced still.
 *
 * Pure and DOM-free so it is unit-testable, and so the rule lives in one place
 * rather than being re-derived per caller.
 */
export function portraitPlayStateOf(cards: { path: string; kind: string }[]): {
  playing: string | null;
  still: Set<string>;
} {
  const portraits = cards.filter((c) => c.kind === 'portrait');
  const playing = portraits.length ? portraits[portraits.length - 1].path : null;
  const still = new Set(portraits.filter((p) => p.path !== playing).map((p) => p.path));
  return { playing, still };
}

/**
 * Live `prefers-reduced-motion: reduce` probe (nook 03 §③-6 L3 / §③-4).
 * Probed once at mount; no `change` subscription this batch (03 §⑫-7).
 */
export function useStill(): boolean {
  const [still, setStill] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    setStill(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);
  return still;
}
