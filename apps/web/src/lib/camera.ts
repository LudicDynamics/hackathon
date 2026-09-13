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
