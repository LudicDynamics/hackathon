/**
 * Camera math — pure functions, no React, no DOM.
 * Constants/formulas mirror the v3 prototype (角色-世界v3.html/src/App.tsx §1.2)
 * and stay isomorphic with the server-side hashInt used for deterministic rot.
 */

export interface Cam {
  x: number;
  y: number;
  z: number;
}

/** Zoom clamp range (v3 L18). */
export const Z_MIN = 0.28;
export const Z_MAX = 2.2;
/** Above this zoom, large text shadows are disproportionately expensive to repaint. */
export const HIGH_ZOOM_RENDER_THRESHOLD = 1.5;

/** Whether the canvas should use its compact high-zoom paint profile. */
export function isHighZoom(z: number): boolean {
  return Number.isFinite(z) && z >= HIGH_ZOOM_RENDER_THRESHOLD;
}
/** Interpolation coefficient per frame (v3 L80). */
export const LERP_K = 0.13;
/** Snap thresholds when close enough to target (v3 L81-83). */
export const SNAP_XY = 0.1;
export const SNAP_Z = 0.001;

/** Clamp zoom to [Z_MIN, Z_MAX]. */
export function clampZ(z: number): number {
  return Math.min(Z_MAX, Math.max(Z_MIN, z));
}

/** One easing step of c toward t, in place; snaps axes that are close enough (v3 L80-85). */
export function lerpCam(c: Cam, t: Cam): void {
  c.x += (t.x - c.x) * LERP_K;
  c.y += (t.y - c.y) * LERP_K;
  c.z += (t.z - c.z) * LERP_K;
  if (Math.abs(t.x - c.x) < SNAP_XY) c.x = t.x;
  if (Math.abs(t.y - c.y) < SNAP_XY) c.y = t.y;
  if (Math.abs(t.z - c.z) < SNAP_Z) c.z = t.z;
}

/**
 * Wheel zoom anchored at the cursor (v3 L120-124). `cam` is the anchor basis:
 * pass the commanded target so chunked wheel events compose without drift
 * (identical to current at rest). The returned Cam is the next target.
 */
export function zoomAt(
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  cam: Cam,
  deltaY: number
): Cam {
  const factor = Math.pow(1.0016, -deltaY);
  const nz = clampZ(cam.z * factor);
  const wx = (sx - vw / 2) / cam.z + cam.x;
  const wy = (sy - vh / 2) / cam.z + cam.y;
  return { x: wx - (sx - vw / 2) / nz, y: wy - (sy - vh / 2) / nz, z: nz };
}

/**
 * Screen (viewport-relative px) → world coordinates. The single entry point for
 * pointer→world conversions (drag math must go through here, never hand-rolled).
 */
export function screenToWorld(
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  cam: Cam
): { x: number; y: number } {
  return { x: (sx - vw / 2) / cam.z + cam.x, y: (sy - vh / 2) / cam.z + cam.y };
}

/** Single-transform-layer CSS (v3 L89). */
export function worldTransform(vw: number, vh: number, cam: Cam): string {
  return `translate(${vw / 2}px, ${vh / 2}px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`;
}

/** Deterministic 32-bit-ish hash — isomorphic with the server's rot derivation. */
export function hashInt(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
export type Projection = 'layer' | 'nook' | 'dialogue';

/** Camera memory keys shared with Canvas' currentLayer save/restore calls. */
export function cameraSlot(projection: Projection, identity: string, callerSlot?: string): string {
  if (projection === 'layer') return identity;
  if (projection === 'nook') return identity.startsWith('characters/') ? identity : `characters/${identity}`;
  return `dialogue:${identity}:${callerSlot ?? 'root'}`;
}

export interface ProjectionTarget {
  projection: Projection;
  identity: string;
  slot: string;
}

export function projectionTarget(
  projection: Projection,
  identity: string,
  callerSlot?: string,
): ProjectionTarget {
  return { projection, identity, slot: cameraSlot(projection, identity, callerSlot) };
}

export interface CameraMemoryFrame {
  caller: ProjectionTarget;
  target: ProjectionTarget;
  slot: string;
  targetSnapshot: Cam;
  savedAt: number;
}

export interface CameraMemoryDriver {
  save(name: string): void;
  restore(name: string): void;
  /** Optional hard delete; useCamera's flat driver predates this seam. */
  clear?(name?: string): void;
  getTarget(): Cam;
}

export interface CameraMemoryStack {
  pushTransition(target: ProjectionTarget): CameraMemoryFrame;
  popTransition(expectedCaller: ProjectionTarget): CameraMemoryFrame | null;
  restoreProjection(frame: CameraMemoryFrame): void;
  restoreTarget(target: ProjectionTarget): void;
  setCurrent(target: ProjectionTarget): void;
  current(): ProjectionTarget;
  clear(): void;
}

/**
 * App-owned projection transaction seam. `useCamera` remains the shared,
 * flat driver; this adapter gives layer, nook, and dialogue nested caller
 * snapshots without introducing another camera owner.
 */
export function createCameraMemoryStack(
  camera: CameraMemoryDriver,
  initial: ProjectionTarget,
): CameraMemoryStack {
  let currentTarget = { ...initial };
  const frames: CameraMemoryFrame[] = [];
  const knownSlots = new Set<string>([initial.slot]);
  const remember = (target: ProjectionTarget) => { knownSlots.add(target.slot); };
  const clearSlot = (slot: string) => {
    if (camera.clear) {
      camera.clear(slot);
      return;
    }
    // Compatibility with the existing flat useCamera driver: restoring a
    // never-used sentinel yields its default, which is then written over the
    // old slot so a new world cannot inherit the previous world's view.
    camera.restore('__airp_camera_empty__');
    camera.save(slot);
  };

  return {
    pushTransition(target) {
      remember(target);
      const frame: CameraMemoryFrame = {
        caller: { ...currentTarget },
        target: { ...target },
        slot: currentTarget.slot,
        targetSnapshot: camera.getTarget(),
        savedAt: Date.now(),
      };
      remember(frame.caller);
      camera.save(frame.slot);
      frames.push(frame);
      currentTarget = { ...target };
      return frame;
    },
    popTransition(expectedCaller) {
      const frame = frames.at(-1);
      if (!frame) return null;
      if (
        frame.caller.projection !== expectedCaller.projection ||
        frame.caller.identity !== expectedCaller.identity ||
        frame.caller.slot !== expectedCaller.slot
      ) {
        return null;
      }
      frames.pop();
      camera.save(frame.target.slot);
      currentTarget = { ...frame.caller };
      return frame;
    },
    restoreProjection(frame) {
      camera.restore(frame.caller.slot);
      currentTarget = { ...frame.caller };
    },
    restoreTarget(target) {
      remember(target);
      camera.restore(target.slot);
      currentTarget = { ...target };
    },
    setCurrent(target) {
      remember(target);
      currentTarget = { ...target };
    },
    current() {
      return { ...currentTarget };
    },
    clear() {
      for (const slot of knownSlots) clearSlot(slot);
      frames.length = 0;
    },
  };
}
