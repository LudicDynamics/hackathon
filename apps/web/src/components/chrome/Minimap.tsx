/**
 * Minimap.tsx — navigation control, not a second view (prototype #minimapWrap /
 * drawMinimap, canvas-stack-mingyue.html L344-378 + L1153-1175).
 *
 * The map shows the union of every item box and the current viewport, scaled
 * into a fixed 176x132 box, and draws the viewport as a rust rectangle. Clicking
 * anywhere maps the pixel back to world space and calls onJump — the parent
 * decides how to fly there (usually center on that point).
 *
 * Drawing goes to a <canvas> rather than absolute-positioned divs: a layer can
 * hold hundreds of items and this repaints on every camera tick.
 */
import React, { useEffect, useRef } from 'react';
import type { LayerItem } from '../../state/useWorld.js';

/** Logical minimap box — the contract's 176x132 (CSS sizes the canvas to match). */
export const MINIMAP_W = 176;
export const MINIMAP_H = 132;
/** Inset so item edges never touch the frame. */
const PAD = 8;
/** Smallest painted item, so a tiny card is still a visible mark. */
const MIN_MARK = 3;

export interface MinimapProps {
  /** Cards to plot (x/y/w/h are world units). */
  items: LayerItem[];
  /** Displayed camera; z converts viewport px to world units. */
  cam: { x: number; y: number; z: number };
  /** Viewport size in screen px. */
  viewport: { w: number; h: number };
  /** Click-to-navigate; receives world coordinates. */
  onJump: (worldX: number, worldY: number) => void;
}

/** Geometry produced by one draw pass and reused by the click handler. */
interface MapGeometry {
  x0: number;
  y0: number;
  k: number;
  ox: number;
  oy: number;
}

/** Read a :root token with a documented fallback (canvas can't use var()). */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export const Minimap: React.FC<MinimapProps> = ({ items, cam, viewport, onJump }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoRef = useRef<MapGeometry | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== MINIMAP_W * dpr || canvas.height !== MINIMAP_H * dpr) {
      canvas.width = MINIMAP_W * dpr;
      canvas.height = MINIMAP_H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // World-space viewport rect (screen offset from cam is (world - cam) * z).
    const vpw = viewport.w / cam.z || 1;
    const vph = viewport.h / cam.z || 1;
    const vx = cam.x - vpw / 2;
    const vy = cam.y - vph / 2;

    // Union of all item boxes and the viewport, padded, so the map always
    // contains something even on an empty layer.
    let bx0 = vx;
    let by0 = vy;
    let bx1 = vx + vpw;
    let by1 = vy + vph;
    for (const it of items) {
      bx0 = Math.min(bx0, it.x);
      by0 = Math.min(by0, it.y);
      bx1 = Math.max(bx1, it.x + Math.max(it.w, 1));
      by1 = Math.max(by1, it.y + Math.max(it.h, 1));
    }
    const spanX = Math.max(bx1 - bx0, 1e-3);
    const spanY = Math.max(by1 - by0, 1e-3);
    const k = Math.min((MINIMAP_W - PAD * 2) / spanX, (MINIMAP_H - PAD * 2) / spanY);
    // Letterbox the scaled world bbox inside the box (equal insets on the long
    // axis). `k` already reserves PAD on the limiting axis, so centering keeps
    // >= PAD on every side. The bbox min IS the map's world origin.
    const ox = (MINIMAP_W - spanX * k) / 2;
    const oy = (MINIMAP_H - spanY * k) / 2;
    const x0 = bx0;
    const y0 = by0;
    geoRef.current = { x0, y0, k, ox, oy };

    const px = (wx: number): number => (wx - x0) * k + ox;
    const py = (wy: number): number => (wy - y0) * k + oy;

    // Items: warm ink, a hairline outline on scene gates.
    const inkFill = token('--ink', 'rgba(41, 40, 32, 1)');
    for (const it of items) {
      const x = px(it.x);
      const y = py(it.y);
      const w = Math.max(MIN_MARK, Math.max(it.w, 1) * k);
      const h = Math.max(MIN_MARK, Math.max(it.h, 1) * k);
      ctx.fillStyle = it.kind === 'gate' ? 'rgba(41, 40, 32, 0.10)' : 'rgba(41, 40, 32, 0.14)';
      ctx.fillRect(x, y, w, h);
      if (it.kind === 'gate') {
        ctx.strokeStyle = inkFill;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(w - 1, 1), Math.max(h - 1, 1));
        ctx.globalAlpha = 1;
      }
    }

    // Viewport rect in rust.
    ctx.strokeStyle = token('--rust', '#c96f4c');
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(px(vx), py(vy), vpw * k, vph * k);
    ctx.globalAlpha = 1;
  }, [items, cam.x, cam.y, cam.z, viewport.w, viewport.h]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const geo = geoRef.current;
    const canvas = canvasRef.current;
    if (!geo || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Client px → logical map px (the canvas box is the contract's 176x132).
    const mx = ((e.clientX - rect.left) / rect.width) * MINIMAP_W;
    const my = ((e.clientY - rect.top) / rect.height) * MINIMAP_H;
    onJump((mx - geo.ox) / geo.k + geo.x0, (my - geo.oy) / geo.k + geo.y0);
  };

  return (
    <div className="minimap-wrap" onClick={handleClick}>
      <div className="minimap__title">MINIMAP</div>
      <canvas
        ref={canvasRef}
        className="minimap__canvas"
        style={{ width: `${MINIMAP_W}px`, height: `${MINIMAP_H}px` }}
      />
    </div>
  );
};
