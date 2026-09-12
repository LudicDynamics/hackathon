import { useEffect, useRef } from 'react';
import type { CameraApi } from '../../state/useCamera.js';

/** Grid cell in world px (matches the old 80px hairline pitch). */
const CELL = 80;

/**
 * World-anchored 80px hairline grid.
 *
 * The old `.canvas-grid` was a 6000×6000 div parked in the world transform
 * layer — the compositor kept a 5707×5700 texture for it, and panning/zooming
 * forced a re-raster of that giant sheet every frame. Here the sheet is one
 * viewport plus a CELL of slack, rewritten as the camera moves: the lines stay
 * locked to the world (the background origin is snapped to the world grid, so
 * the pattern never shifts) while the painted surface stays a screenful.
 */
export const CanvasGrid: React.FC<{ camera: CameraApi }> = ({ camera }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = (view: { x: number; y: number; z: number; vw: number; vh: number }) => {
      const z = view.z || 1;
      // Top-left of the visible world rect, then pulled back to the enclosing
      // grid line: left/top always land on a multiple of CELL, so the hairlines
      // stay pinned to the world (no sub-pixel crawl while panning).
      const left = Math.floor((view.x - view.vw / (2 * z)) / CELL) * CELL;
      const top = Math.floor((view.y - view.vh / (2 * z)) / CELL) * CELL;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      // One CELL of slack on each axis: the camera's publish cadence can trail
      // the final resting position by a hair, and the sheet must still cover
      // the whole viewport then.
      el.style.width = `${(view.vw / z) + CELL * 2}px`;
      el.style.height = `${(view.vh / z) + CELL * 2}px`;
      el.style.backgroundSize = `${CELL}px ${CELL}px`;
    };
    return camera.subscribe(paint);
  }, [camera]);

  return <div ref={ref} className="canvas-grid" />;
};
