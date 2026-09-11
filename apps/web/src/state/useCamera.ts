import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  clampZ,
  lerpCam,
  worldTransform,
  type Cam,
} from '../lib/camera.js';

/**
 * Camera driver for the infinite canvas (v3 prototype semantics).
 *
 * Design notes:
 * - The target/current pair and the CAMS memory live at MODULE scope so that
 *   every hook instance (Canvas renders/drives the world layer; App only calls
 *   save/restore around the character modal) operates on ONE camera.
 * - The rAF loop only starts on the instance whose worldRef is attached, so an
 *   App-level useCamera() never spawns a second loop (no double-speed easing).
 * - transform is written straight to the DOM every frame — never via setState.
 *   Consumers that draw from the camera (the minimap) subscribe with
 *   `subscribe`; nothing about camera motion re-renders React.
 * - StrictMode-safe: the effect cleanup cancels the loop on the simulated
 *   unmount, so the dev double-mount does not double the easing rate.
 */

/** A camera view snapshot handed to subscribers (displayed camera + viewport). */
export interface CamView {
  x: number;
  y: number;
  z: number;
  vw: number;
  vh: number;
}

/** Default view used when a layer has no memory (matches server seat anchor). */
const DEFAULT_VIEW: Cam = { x: 960, y: 540, z: 0.95 };

/** Per-layer/named camera memory (refresh-lost by design, see plan §6.5). */
const CAM_MEMORY: Record<string, Cam> = {};

/** Shared camera state across hook instances. */
let sharedTarget: Cam = { ...DEFAULT_VIEW };
let sharedCurrent: Cam = { ...DEFAULT_VIEW };

function applyTarget(t: Cam): void {
  sharedTarget.x = t.x;
  sharedTarget.y = t.y;
  sharedTarget.z = t.z;
}

export interface CameraApi {
  /** Command a new camera destination; z clamps and defaults to the current one. */
  flyTo(x: number, y: number, z?: number): void;
  /** Remember the current target under `name` (layer id or named slot). */
  save(name: string): void;
  /** Return to the remembered target, or the default view when absent. */
  restore(name: string): void;
  /** Live snapshot of the displayed camera — for pointer→world math. */
  getCam(): Cam;
  /** Live snapshot of the commanded target — wheel zoom anchors off this so
   *  chunked wheel events compose without drift. */
  getTarget(): Cam;
  /** Live viewport size (ResizeObserver-maintained). */
  getViewport(): { w: number; h: number };
  /** Push a view on every camera tick; returns an unsubscribe. Used by the
   *  minimap so following the camera costs no React render. */
  subscribe(fn: (view: CamView) => void): () => void;
  /** Attach to the viewport div (wheel/pinch math + size observation). */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the single transform layer; rAF writes its transform. */
  worldRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Shared camera view state. The rAF loop and the viewport element live in
 * Canvas, while the minimap is drawn in App — so the observed size and the
 * tick feed MUST be module-scope, or an App-side consumer would read a
 * snapshot frozen at mount (stale while dragging, blind to zoom).
 */
let sharedSize = { w: 1200, h: 800 };
const viewListeners = new Set<(view: CamView) => void>();

function currentView(): CamView {
  return {
    x: sharedCurrent.x,
    y: sharedCurrent.y,
    z: sharedCurrent.z,
    vw: sharedSize.w,
    vh: sharedSize.h,
  };
}

function publishView(): void {
  const view = currentView();
  for (const fn of viewListeners) fn(view);
}

export function useCamera(): CameraApi {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  /* ---------- viewport size (observed on the instance owning the div) ---------- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return; // App-level instance: Canvas publishes the size
    const update = () => {
      sharedSize = { w: el.clientWidth, h: el.clientHeight };
      publishView();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- render loop (only on the instance owning the world layer) ---------- */
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return; // App-level instance: nothing to drive
    let raf = 0;
    let tick = 0;
    let wasRest = true;
    const loop = () => {
      const c = sharedCurrent;
      lerpCam(c, sharedTarget);
      world.style.transform = worldTransform(sharedSize.w, sharedSize.h, c);
      tick++;
      const atRest =
        c.x === sharedTarget.x && c.y === sharedTarget.y && c.z === sharedTarget.z;
      // Publish on a ~20fps cadence while animating — the minimap's viewport
      // rect must follow a pan/zoom smoothly — plus one final tick when the
      // camera settles, so the rect lands exactly on the resting view. Idle
      // frames publish nothing.
      if (atRest ? !wasRest : tick % 3 === 0) publishView();
      wasRest = atRest;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- command API ---------- */
  const flyTo = useCallback((x: number, y: number, z?: number) => {
    applyTarget({
      x,
      y,
      z: z !== undefined ? clampZ(z) : sharedTarget.z,
    });
  }, []);

  const save = useCallback((name: string) => {
    CAM_MEMORY[name] = { ...sharedTarget };
  }, []);

  const restore = useCallback((name: string) => {
    const remembered = CAM_MEMORY[name];
    applyTarget(remembered ? { ...remembered } : { ...DEFAULT_VIEW });
  }, []);

  const getCam = useCallback(() => ({ ...sharedCurrent }), []);
  const getTarget = useCallback(() => ({ ...sharedTarget }), []);
  const getViewport = useCallback(() => ({ ...sharedSize }), []);
  const subscribe = useCallback((fn: (view: CamView) => void) => {
    viewListeners.add(fn);
    fn(currentView()); // paint immediately with the current view
    return () => {
      viewListeners.delete(fn);
    };
  }, []);

  return useMemo(
    () => ({
      flyTo,
      save,
      restore,
      getCam,
      getTarget,
      getViewport,
      subscribe,
      viewportRef,
      worldRef,
    }),
    [flyTo, save, restore, getCam, getTarget, getViewport, subscribe]
  );
}
