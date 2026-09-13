/**
 * PerformanceLayer — the one front-end entry for `show_frame` (docs/perform/05).
 *
 * `show_frame` is a transient performance frame: the server relays the `show`
 * tool's `ShowFrame` verbatim and this layer dispatches it to one of 7 one-shot
 * performances. None of them writes a file, appends an event, or touches canvas
 * state (show.ts:64-71) — they are animations, not world changes, so they have
 * no "real data" to project and must remove their own DOM when the frame's
 * `durationMs` elapses.
 *
 * Shape decisions, all deliberate:
 * - Module store, not React state. A performance is momentary and single-
 *   consumer, so a frame must not re-render the whole canvas subtree
 *   (AGENTS §7.6-2). The component only renders the mounting box.
 * - Timers live in the module store and compare an id, so a React re-render
 *   never resets or prematurely cancels a running show (docs/perform/05 §3.6).
 * - Overlap is resolved per RESOURCE KEY: the two dimming shows share one
 *   veil, so the newest takes over; every other show runs alongside (§3.5).
 */
import React, { useEffect, useReducer, useRef } from 'react';
import type { ShowFrame } from '@airp/shared';
import {
  clampBursts,
  clampStagger,
  evidenceLinks,
  inkToneOf,
  lightsOutDim,
  resolveShowKind,
  ruleKeyOf,
  spotlightDim,
  zoomOf,
} from '../../lib/show-geometry.js';
import { cardGeometry, handDrawnPath } from '../canvas/LinkLayer.js';
import { playBurst } from '../canvas/ParticleLayer.js';
import { hashInt, worldTransform } from '../../lib/camera.js';
import { useCamera, type CameraApi } from '../../state/useCamera.js';
import { useStill } from '../../lib/motion.js';
import { audioDebugState, playFoley, setAmbient } from '../../lib/audio.js';

/* ============================ module store ============================ */

/** One running performance. `id` is what the removal timer matches against. */
interface ActiveShow {
  id: number;
  component: string;
  resourceKey: string;
  startedAt: number;
  durationMs: number;
  cleanup: () => void;
}

/** Rendering environment the dispatcher hands to every renderer. */
interface ShowCtx {
  /** Mount box (`<PerformanceLayer />`'s root div); dim/beam/threads go here. */
  root: HTMLElement;
  /** Shared camera. `camera_focus` calls `flyTo`; threads subscribe for the
   *  world transform so they stay aligned while the camera flies (§12.2). */
  camera: CameraApi;
  /** `prefers-reduced-motion` probe (§3.7); decorators degrade when true. */
  still: boolean;
}

let active: ActiveShow[] = [];
const listeners = new Set<() => void>();
let seq = 0;
let liveCtx: ShowCtx | null = null;

function notify(): void {
  for (const fn of listeners) fn();
}

/** Subscribe to the running-show list (the component's private re-render feed). */
export function subscribeActiveShow(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Read-only snapshot of the running shows (tests / DevTools). */
export function activeShow(): Readonly<ActiveShow[]> {
  return active;
}

/**
 * Tear down every running show immediately (layer change / world freeze, §7 S6).
 * Not a per-show cancel — no performance survives a layer change.
 */
export function cancelShow(_reason?: string): void {
  for (const s of active) s.cleanup();
  active = [];
  notify();
}

/* ============================ DOM helpers ============================ */


function numParam(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strParam(params: Record<string, unknown>, key: string): string | undefined {
  const v = params[key];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function makeDiv(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/** World box centre → viewport-relative screen px (root shares the viewport box). */
function worldToScreen(
  ctx: ShowCtx,
  wx: number,
  wy: number
): { x: number; y: number } {
  const cam = ctx.camera.getCam();
  const { w, h } = ctx.camera.getViewport();
  return { x: w / 2 + (wx - cam.x) * cam.z, y: h / 2 + (wy - cam.y) * cam.z };
}

/** One-shot card centre in screen px — null when the card is not on this layer. */
function cardCenter(
  ctx: ShowCtx,
  path: string | undefined
): { x: number; y: number; w: number; h: number } | null {
  const box = path ? cardGeometry(path) : null;
  if (!box) return null;
  const c = worldToScreen(ctx, box.x + box.w / 2, box.y + box.h / 2);
  return { x: c.x, y: c.y, w: box.w, h: box.h };
}

/* ============================ renderers ============================ */
/* Every renderer: (frame, ctx) → cleanup | null. `null` = not performed
   (target card off-layer, or a decorator skipped under reduced motion). */

/** Warm beam tints accepted for `spotlight.tone`; anything else → default. */
const BEAM_TONES: Record<string, string> = {
  warm: 'rgba(235, 205, 140, 0.55)',
  gold: 'rgba(235, 205, 140, 0.55)',
  amber: 'rgba(214, 150, 74, 0.55)',
  cold: 'rgba(180, 205, 225, 0.5)',
  blue: 'rgba(120, 147, 162, 0.5)',
};
const BEAM_DEFAULT = 'rgba(235, 205, 140, 0.55)';

/**
 * `spotlight` — full-canvas dim plus a warm beam over `target` (§3.3).
 * `--show-dim` is the resulting brightness (docs/tools/10 §14.3 "dim def .15"),
 * so the veil paints a dark sheet at `opacity: 1 - dim`; two veils stack the
 * way §3.5 describes (near-black) — which is exactly why the engine keeps
 * only one `'dim'` show alive.
 */
function showSpotlight(frame: ShowFrame, ctx: ShowCtx): (() => void) | null {
  const params = frame.params ?? {};
  const target = cardCenter(ctx, frame.target);
  if (!target) {
    console.warn('[show_frame] spotlight target not on this layer', frame.target);
    return null;
  }

  const veil = makeDiv('show-dim');
  veil.style.setProperty('--show-dim', String(spotlightDim(numParam(params, 'dim'))));
  ctx.root.appendChild(veil);

  const beam = makeDiv('show-beam');
  const spread = numParam(params, 'spread') ?? 260;
  const tone = strParam(params, 'tone');
  beam.style.left = `${target.x}px`;
  beam.style.top = `${target.y}px`;
  beam.style.setProperty('--show-beam-spread', `${spread * 2}px`);
  beam.style.setProperty('--show-beam-tone', (tone && BEAM_TONES[tone]) || BEAM_DEFAULT);
  ctx.root.appendChild(beam);

  return () => {
    veil.remove();
    beam.remove();
  };
}

/**
 * `lights_out` — the scene darkens, one card (or none) stays faintly lit (§3.3).
 * The lifted card is a root-level halo rather than a class on the card element:
 * the card's `className` is React-owned, so a foreign class would be wiped by
 * the next card re-render, and injected children corrupt reconciliation.
 */
function showLightsOut(frame: ShowFrame, ctx: ShowCtx): () => void {
  const params = frame.params ?? {};
  const veil = makeDiv('show-dim');
  veil.style.setProperty('--show-dim', String(lightsOutDim(numParam(params, 'dim'))));
  ctx.root.appendChild(veil);

  // `params.focus` is the only lit card — top-level `target` has no meaning for
  // this show (§11 conflict 3, `requiresTarget: false`).
  const focus = cardCenter(ctx, strParam(params, 'focus'));
  let lift: HTMLElement | null = null;
  if (focus) {
    lift = makeDiv('show-focus-lift');
    lift.style.left = `${focus.x}px`;
    lift.style.top = `${focus.y}px`;
    lift.style.width = `${focus.w + 36}px`;
    lift.style.height = `${focus.h + 36}px`;
    ctx.root.appendChild(lift);
  }

  // Cut the ambient bed low; restore what was declared before (§4.5). BGM is
  // owned by App's layer mood — never touched here.
  const prevAmbient = audioDebugState().ambient;
  setAmbient(null);

  return () => {
    veil.remove();
    lift?.remove();
    setAmbient(prevAmbient);
  };
}

/**
 * `fireworks` — bursts on the EXISTING ParticleLayer canvas, never a second
 * full-screen canvas (§4.4: a second full-screen canvas costs half a frame).
 * Purely decorative, so it is skipped entirely under reduced motion (§3.7).
 */
function showFireworks(frame: ShowFrame, ctx: ShowCtx): (() => void) | null {
  if (ctx.still) return null;
  const params = frame.params ?? {};
  const cancel = playBurst({
    color: strParam(params, 'color'),
    bursts: clampBursts(numParam(params, 'bursts')),
    origin: strParam(params, 'origin'),
    durationMs: frame.durationMs,
  });
  // No boom in `FoleyName`; `crit-chime` is the frozen stand-in (contract §8b).
  playFoley('crit-chime');
  return cancel;
}

/**
 * `evidence_burst` — a temporary thread from each link card to `target`.
 *
 * The threads live in this layer's own SVG, never in `LinkLayer.registry`
 * (registry is rebuilt from `[links]` and would erase them), and nothing is
 * written to `canvas.db` — they are performed, not stored (§5, §12.2).
 */
function showEvidenceBurst(frame: ShowFrame, ctx: ShowCtx): (() => void) | null {
  const params = frame.params ?? {};
  // Threads are drawn inside the world transform layer, so their endpoints must
  // be WORLD coords (`cardGeometry`), not the screen px the veil/beam use.
  const targetBox = frame.target ? cardGeometry(frame.target) : null;
  const paths = evidenceLinks(frame);
  if (!targetBox || paths.length === 0) {
    if (!targetBox) {
      console.warn('[show_frame] evidence_burst target not on this layer', frame.target);
    }
    return null;
  }
  const tx = targetBox.x + targetBox.w / 2;
  const ty = targetBox.y + targetBox.h / 2;

  const color = strParam(params, 'color') ?? 'var(--rust)';
  const stagger = clampStagger(numParam(params, 'staggerMs'));

  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.setAttribute('class', 'show-thread-layer');
  layer.setAttribute('width', '0');
  layer.setAttribute('height', '0');

  // World-space coordinate layer: the same transform `useCamera` writes to the
  // world layer, so the threads stay glued to their cards while the camera
  // flies (evidence_burst often shares a turn with camera_focus, §12.2).
  const unsub = ctx.camera.subscribe((view) => {
    layer.style.transform = worldTransform(view.vw, view.vh, {
      x: view.x,
      y: view.y,
      z: view.z,
    });
  });

  paths.forEach((path, i) => {
    const box = cardGeometry(path);
    if (!box) return; // one missing link: skip it, keep the rest (§3.4)
    const ax = box.x + box.w / 2;
    const ay = box.y + box.h / 2;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute(
      'd',
      handDrawnPath(ax, ay, tx, ty, hashInt(`${frame.timestamp ?? ''}|${path}`))
    );
    p.setAttribute('class', 'show-thread');
    p.style.stroke = color;
    p.style.animationDelay = `${i * stagger}ms`;
    layer.appendChild(p);
  });

  ctx.root.appendChild(layer);

  return () => {
    unsub();
    layer.remove();
  };
}

/**
 * `camera_focus` — the camera flies to `target`. No dimming, no DOM (§3.3).
 * `durationMs` only decides when the show ends and can be taken over; the fly
 * speed is the shared camera's `LERP_K`, which this layer must not touch.
 */
function showCameraFocus(frame: ShowFrame, ctx: ShowCtx): (() => void) | null {
  // Reduced motion skips the whole show: a camera flight is a motion stimulus
  // and `useCamera` has no instant entry (§3.7).
  if (ctx.still) return null;
  // flyTo takes WORLD coords (the card's own space), not screen px.
  const target = frame.target ? cardGeometry(frame.target) : null;
  if (!target) {
    console.warn('[show_frame] camera_focus target not on this layer', frame.target);
    return null;
  }
  // zoomOf returns undefined when absent → flyTo keeps the current z (§3.3);
  // passing 1 or 0 here would snap the camera to an extreme.
  ctx.camera.flyTo(
    target.x + target.w / 2,
    target.y + target.h / 2,
    zoomOf(frame.params ?? {})
  );
  return () => {};
}

/**
 * `ink_burst` — one splash of ink over `target` (§3.3). Rendered as a
 * root-level splash at the card's screen position (same React-ownership reason
 * as `lights_out`'s lift).
 */
function showInkBurst(frame: ShowFrame, ctx: ShowCtx): (() => void) | null {
  const target = cardCenter(ctx, frame.target);
  if (!target) {
    console.warn('[show_frame] ink_burst target not on this layer', frame.target);
    return null;
  }
  const params = frame.params ?? {};
  const splash = makeDiv('show-ink');
  const scale = numParam(params, 'scale') ?? 1;
  splash.style.left = `${target.x}px`;
  splash.style.top = `${target.y}px`;
  splash.style.setProperty('--show-ms', `${frame.durationMs}ms`);
  splash.style.setProperty('--show-scale', String(scale));
  const tone = inkToneOf(params);
  if (tone) splash.setAttribute('data-tone', tone);
  ctx.root.appendChild(splash);

  playFoley('pen-scratch');

  return () => {
    splash.remove();
  };
}

/**
 * `roll_ceremony` — the die's entrance tumble ONLY. No faces, no result, no
 * crit/fumble judgement, no settle sound: the outcome belongs to `02`
 * (`dice_result`), and this show's schema carries no result (§3.3).
 */
function showRollCeremony(frame: ShowFrame, ctx: ShowCtx): () => void {
  const params = frame.params ?? {};
  const anticipation = numParam(params, 'anticipation') ?? 0;
  const wrap = makeDiv('show-ceremony');
  wrap.style.setProperty('--show-ms', `${frame.durationMs}ms`);
  wrap.style.setProperty('--show-anticipation', `${anticipation}ms`);

  const scene = makeDiv('show-ceremony-scene');
  const cube = makeDiv('show-ceremony-cube');
  for (let i = 1; i <= 6; i++) {
    const face = makeDiv(`dice-face face-${i}`);
    cube.appendChild(face);
  }
  scene.appendChild(cube);
  wrap.appendChild(scene);
  ctx.root.appendChild(wrap);

  return () => {
    wrap.remove();
  };
}

const SHOW_RENDERERS: Record<string, (f: ShowFrame, ctx: ShowCtx) => (() => void) | null> = {
  spotlight: showSpotlight,
  lights_out: showLightsOut,
  fireworks: showFireworks,
  evidence_burst: showEvidenceBurst,
  camera_focus: showCameraFocus,
  ink_burst: showInkBurst,
  roll_ceremony: showRollCeremony,
};

/* ============================ dispatcher ============================ */

/**
 * The single `show_frame` entry (the `airp:show-frame` listener calls it).
 *
 * A malformed frame or an unknown component is never performed and never
 * throws — a bad frame must not take down the WS handler or the canvas. A
 * non-empty but UNKNOWN component id is a version-mismatch signal, so it warns
 * once for developers; a missing / non-string component is fully silent
 * (§3.2, §7 S2/S2b).
 */
export function performShowFrame(frame: unknown): boolean {
  if (!frame || typeof frame !== 'object') return false;
  const f = frame as Partial<ShowFrame>;
  if (f.type !== 'show_frame') return false;

  const kind = resolveShowKind(f.component);
  if (!kind) {
    if (typeof f.component === 'string' && f.component !== '') {
      console.warn('[show_frame] unknown component', f.component);
    }
    return false;
  }
  if (!liveCtx) {
    console.warn('[show_frame] PerformanceLayer is not mounted; skipping', kind);
    return false;
  }

  const full = f as ShowFrame;
  const key = ruleKeyOf(kind);

  // Same resource: the newest intent takes over the shared DOM/veil. Different
  // resources keep running side by side (§3.5).
  for (const s of active) {
    if (s.resourceKey === key) s.cleanup();
  }
  active = active.filter((s) => s.resourceKey !== key);

  const cleanup = SHOW_RENDERERS[kind](full, liveCtx);
  if (!cleanup) return false;

  // `caption` is a shared frame field (docs/perform/05 §4.3): one faint line
  // for every show. Owned here so no renderer has to duplicate it.
  const caption = typeof full.caption === 'string' && full.caption !== '' ? full.caption : null;
  let captionEl: HTMLDivElement | null = null;
  if (caption) {
    captionEl = makeDiv('show-caption');
    captionEl.textContent = caption;
    liveCtx.root.appendChild(captionEl);
  }

  const id = ++seq;
  active = [
    ...active,
    {
      id,
      component: kind,
      resourceKey: key,
      startedAt: performance.now(),
      durationMs: full.durationMs,
      cleanup: () => {
        cleanup();
        captionEl?.remove();
      },
    },
  ];
  notify();

  // The timer is held here, in the module store, so a React re-render can
  // neither reset nor cancel it; removal matches on `id` (docs/perform/05 §3.6-1).
  const delay = Number.isFinite(full.durationMs) ? full.durationMs : 0;
  setTimeout(() => {
    const mine = active.find((s) => s.id === id);
    if (!mine) return;
    mine.cleanup();
    active = active.filter((s) => s.id !== id);
    notify();
  }, Math.max(0, delay));

  return true;
}

/* ============================ component ============================ */

export interface PerformanceLayerProps {
  /** Current layer id — a layer change cancels every running show (§7 S6). */
  layer?: string;
  /** World frozen — a freeze cancels every running show (§7 S6). */
  frozen?: boolean;
}

/**
 * The mounting box. It renders nothing but an empty overlay: the 7 renderers
 * build their own DOM and are called directly by `performShowFrame`, not from
 * React render (docs/perform/05 §6.3). This component exists to own the box,
 * feed the render context, and cancel shows on a layer change / freeze.
 */
export const PerformanceLayer: React.FC<PerformanceLayerProps> = ({ layer, frozen }) => {
  const camera = useCamera();
  const still = useStill();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [, force] = useReducer((n: number) => n + 1, 0);

  // Private re-render feed so `activeShow()` is observable in DevTools/tests.
  useEffect(() => subscribeActiveShow(force), []);

  // Publish the render context for the dispatcher; a show arriving before the
  // component mounts sees `liveCtx === null` and is skipped, not crashed.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    liveCtx = { root, camera, still };
    return () => {
      liveCtx = null;
    };
  }, [camera, still]);

  // z-20: below the dice ceremony's z-50 / fumble crack z-55 (contract §8b).
  useEffect(() => {
    const onShowFrame = (e: Event) => {
      performShowFrame((e as CustomEvent).detail);
    };
    window.addEventListener('airp:show-frame', onShowFrame);
    return () => {
      window.removeEventListener('airp:show-frame', onShowFrame);
      cancelShow();
    };
  }, []);

  // A layer change or a freeze invalidates every running show (§7 S6).
  useEffect(() => () => cancelShow(), [layer, frozen]);

  return <div ref={rootRef} className="show-root" aria-hidden="true" />;
};
