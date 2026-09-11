import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 *   `cam` is only a 12-tick UI echo.
 * - StrictMode-safe: the effect cleanup cancels the loop on the simulated
 *   unmount, so the dev double-mount does not double the easing rate.
 */

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
  /** UI echo of the current (displayed) camera, synced every 12 ticks. */
  cam: Cam;
  /** Live snapshot of the displayed camera — for pointer→world math. */
  getCam(): Cam;
  /** Live snapshot of the commanded target — wheel zoom anchors off this so
   *  chunked wheel events compose without drift. */
  getTarget(): Cam;
  /** Live viewport size (ResizeObserver-maintained). */
  getViewport(): { w: number; h: number };
  /** Attach to the viewport div (wheel/pinch math + size observation). */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the single transform layer; rAF writes its transform. */
  worldRef: React.RefObject<HTMLDivElement | null>;
}

export function useCamera(): CameraApi {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const [cam, setCam] = useState<Cam>({ ...sharedCurrent });
  const sizeRef = useRef({ w: 1200, h: 800 });

  /* ---------- viewport size ---------- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
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
    const loop = () => {
      const c = sharedCurrent;
      lerpCam(c, sharedTarget);
      const { w, h } = sizeRef.current;
      world.style.transform = worldTransform(w, h, c);
      tick++;
      if (tick % 12 === 0) setCam({ x: c.x, y: c.y, z: c.z });
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
  const getViewport = useCallback(() => ({ ...sizeRef.current }), []);

  return useMemo(
    () => ({
      flyTo,
      save,
      restore,
      cam,
      getCam,
      getTarget,
      getViewport,
      viewportRef,
      worldRef,
    }),
    [cam, flyTo, save, restore, getCam, getTarget, getViewport]
  );
}
