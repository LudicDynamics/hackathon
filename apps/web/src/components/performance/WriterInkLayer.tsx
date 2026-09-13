/**
 * WriterInkLayer.tsx — the chalk lane's wet-ink shell (docs/perform/01 §6.6).
 *
 * `ChalkMark` renders ONE `kind:'chalk'` phantom's CONTENT. It is NOT
 * self-mounting: the single `usePhantoms()` renderer is
 * `canvas/PhantomLayer.tsx` (owner 03), which owns the world-space shell
 * (absolute seat position, z-index) and dispatches here. A chalk phantom lives
 * OUTSIDE `items` on purpose — at `chalk_writing` no file exists yet
 * (docs/perform/00 §6b-1).
 *
 * The reveal clock is local (`lib/chalk-reveal.ts`): the server replays the
 * whole body at `toolcall_end`, so per-character timing comes from here, not
 * from frame arrival (docs/perform/01 §3.1, §6.3).
 */
import React, { useEffect, useRef, useState } from 'react';
import { drop, type PhantomEntry } from '../../lib/phantom.js';
import { MarkdownText } from '../../lib/md.js';
import { revealChars, REVEAL_STEP_MS } from '../../lib/chalk-reveal.js';

/** Fade-out budget after a failed chalk: ~320ms then the node is gone
 * (docs/perform/01 §7, 不留半成品). */
const EVICT_FADE_MS = 320;

/**
 * Count up to `target` one reveal step at a time, restarting from 0 whenever
 * `restartKey` changes (a fresh phantom). Settled phases (`landed`/`evicted`)
 * skip the clock and show the text whole.
 */
function useReveal(target: number, restartKey: string, frozen: boolean): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    shownRef.current = 0;
    setShown(0);
  }, [restartKey]);

  useEffect(() => {
    if (frozen || shownRef.current >= target) return;
    let last = performance.now();
    const iv = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const next = revealChars(target, dt, shownRef.current, REVEAL_STEP_MS);
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
      }
      if (next >= target) window.clearInterval(iv);
    }, REVEAL_STEP_MS);
    return () => window.clearInterval(iv);
  }, [target, frozen, restartKey]);

  return frozen ? target : Math.min(target, shown);
}

export interface ChalkMarkProps {
  entry: PhantomEntry;
}

/**
 * Wet-ink content: a `.chalk .chalk--bare .chalk--ghost` shell with an ink-tip
 * while the paper is still blank and a `.ink-spread` dry-down once landed.
 * Rendered translucent — it is a promise, not a card (docs/perform/01 §6.6).
 * Positioning is the caller's job (`PhantomLayer`).
 */
export const ChalkMark: React.FC<ChalkMarkProps> = ({ entry }) => {
  const { phase } = entry;
  const text = entry.text ?? '';
  const evicted = phase === 'evicted';
  const landed = phase === 'landed';
  const ink = phase === 'pending' || phase === 'writing';
  const shown = useReveal(text.length, entry.toolCallId, !ink);

  // A failed chalk must leave no half-written ghost on the canvas: hold the
  // faded node for the exit animation, then retire it from the registry.
  useEffect(() => {
    if (!evicted) return;
    const t = window.setTimeout(() => drop(entry.toolCallId), EVICT_FADE_MS);
    return () => window.clearTimeout(t);
  }, [evicted, entry.toolCallId]);

  const classes = ['chalk', 'chalk--bare', 'chalk--ghost'];
  if (landed) classes.push('ink-spread');
  if (evicted) classes.push('ghost--evicting');

  return (
    <div className={classes.join(' ')} data-phase={phase} aria-hidden>
      {shown > 0 ? (
        <MarkdownText text={text.slice(0, shown)} className="whitespace-pre-wrap" />
      ) : null}
      {ink && shown === 0 ? <span className="ink-tip" /> : null}
    </div>
  );
};
