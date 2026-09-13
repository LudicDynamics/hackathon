import React, { useEffect, useRef } from 'react';
import { getParallax } from '../../lib/parallax.js';

export interface ParticleLayerProps {
  tone?: string;
  /**
   * Ambient dust/rain (pure decoration). Show bursts (`playBurst`) draw on this
   * same canvas and MUST keep working when ambient is off (docs/perform/05
   * §4.4), so this only gates the mote field — never the canvas itself.
   */
  ambient?: boolean;
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  pulseSpeed: number;
  pulseOffset: number;
  wobbleSpeed: number;
  wobbleRadius: number;
}

/** Glow sprite edge in device px. The mote is drawn as this pre-rendered
 *  bitmap instead of a fresh radial gradient every frame. */
const GLOW_SPRITE_PX = 64;

/**
 * Pre-render the warm mote glow ONCE. The old loop called
 * `createRadialGradient` + `addColorStop` ×3 for every mote every frame
 * (48 × 60fps ≈ 2880 gradient allocations/s), which the drag profile showed up
 * as steady GC pressure. One sprite + `drawImage` removes that entirely.
 */
function makeGlowSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = GLOW_SPRITE_PX;
  const g = c.getContext('2d')!;
  const r = GLOW_SPRITE_PX / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(235, 205, 140, 1)');
  grad.addColorStop(0.5, 'rgba(215, 160, 90, 0.5)');
  grad.addColorStop(1, 'rgba(215, 160, 90, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SPRITE_PX, GLOW_SPRITE_PX);
  return c;
}

let glowSprite: HTMLCanvasElement | null = null;
/* ---- Show fireworks: a short-lived burst channel on the SAME canvas ----
   docs/perform/05 §4.4. Opening a second full-screen canvas costs half a
   frame budget (AGENTS §7.6-1: an empty full-screen canvas alone drops
   57→34fps). This canvas already pays that cost, so a burst is just N extra
   `drawImage` calls through the loop's existing 30fps cap and parallax read.
   Particles are drawn from a per-color pre-rendered sprite, exactly like the
   ambient motes, so no gradient is allocated per frame. */

/** One burst group: `bursts × 12` particles (≤ 96, docs/perform/05 §4.4). */
interface BurstGroup {
  particles: BurstParticle[];
  sprite: HTMLCanvasElement;
  startedAt: number;
  durationMs: number;
  /** Ratios expand to pixels on the first draw, once the canvas size is known. */
  seeded: boolean;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
}

export interface BurstSpec {
  color?: string; // CSS color; default warm gold (matches the ambient sprite)
  bursts?: number; // burst clusters (show-geometry clamps to 8)
  origin?: string; // screen ratio "<0..1>,<0..1>"; default "0.5,0.2"
  durationMs: number; // frame value, never clamped here
}

/** Particles per cluster — 8 clusters × 12 = the frozen 96-particle ceiling. */
const BURST_PER_CLUSTER = 12;

const burstSpriteCache = new Map<string, HTMLCanvasElement>();

/** Pre-render one burst sprite per color (same rationale as `makeGlowSprite`). */
function makeBurstSprite(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = GLOW_SPRITE_PX;
  const g = c.getContext('2d')!;
  const r = GLOW_SPRITE_PX / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_SPRITE_PX, GLOW_SPRITE_PX);
  return c;
}

function burstSpriteFor(color: string): HTMLCanvasElement {
  let s = burstSpriteCache.get(color);
  if (!s) {
    s = makeBurstSprite(color);
    burstSpriteCache.set(color, s);
  }
  return s;
}

/** Parse the frozen `origin` format: two ratios in [0,1], else the default. */
function parseOrigin(origin?: string): { x: number; y: number } {
  const m = (origin ?? '').split(',');
  if (m.length !== 2) return { x: 0.5, y: 0.2 };
  const x = Number(m[0]);
  const y = Number(m[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return { x: 0.5, y: 0.2 };
  }
  return { x, y };
}

let burstGroups: BurstGroup[] = [];

/**
 * Play one fireworks burst (docs/perform/05 §4.4). Returns a cancel that drops
 * this group immediately. A later call replaces any running burst — the show
 * resource key is a single `'fireworks'` lane, so the newest intent wins.
 */
export function playBurst(spec: BurstSpec): () => void {
  const color = typeof spec.color === 'string' && spec.color ? spec.color : 'rgb(235, 205, 140)';
  const clusters = Math.max(1, Math.min(8, Math.floor(spec.bursts ?? 5)));
  const durationMs = Number.isFinite(spec.durationMs) ? spec.durationMs : 3000;
  const sprite = burstSpriteFor(color);
  const particles: BurstParticle[] = [];

  // Ratios expand to pixels on the first draw (the canvas size is known in the
  // render loop, not here). Each cluster gets a small random offset so the
  // bursts read as separate blooms rather than one ring.
  const origin = parseOrigin(spec.origin);
  for (let c = 0; c < clusters; c++) {
    const ox = origin.x + (Math.random() - 0.5) * 0.18;
    const oy = origin.y + (Math.random() - 0.5) * 0.12;
    for (let i = 0; i < BURST_PER_CLUSTER; i++) {
      const angle = (i / BURST_PER_CLUSTER) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.4 + Math.random() * 3.6;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        maxLife: durationMs,
      });
    }
  }
  const group: BurstGroup = { particles, sprite, startedAt: performance.now(), durationMs, seeded: false };
  burstGroups = [group]; // latest intent takes the lane
  return () => {
    burstGroups = burstGroups.filter((g) => g !== group);
  };
}

export const ParticleLayer: React.FC<ParticleLayerProps> = ({ tone = 'warm', ambient = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toneRef = useRef(tone);
  toneRef.current = tone;
  // Read imperatively in the render loop so toggling ambient never re-runs the
  // effect (which would reset the particle field and drop live bursts).
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!glowSprite) glowSprite = makeGlowSprite();

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const count = 48; // Lightweight particle budget (< 1% CPU)
    const particles: Particle[] = [];

    const isRain = toneRef.current.includes('rain');

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
        vx: isRain ? -1.5 - Math.random() * 2 : (Math.random() - 0.5) * 0.4,
        vy: isRain ? 9 + Math.random() * 8 : -0.2 - Math.random() * 0.4,
        size: isRain ? 12 + Math.random() * 14 : 1.2 + Math.random() * 2.4,
        alpha: Math.random() * 0.5 + 0.1,
        maxAlpha: isRain ? 0.35 : 0.55 + Math.random() * 0.3,
        pulseSpeed: 0.015 + Math.random() * 0.02,
        pulseOffset: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
        wobbleRadius: 8 + Math.random() * 16,
      });
    }

    // Ambient drift is slow (wobble ~0.01–0.03, rain vy ~9–17px/frame); drawing
    // it at 30fps is visually indistinguishable from 60fps but halves the
    // cost of the full-screen layer this canvas forces the compositor to
    // re-raster every frame — the measured dominant cost on this app.
    const FRAME_MS = 1000 / 30;
    let time = 0;
    let lastDraw = 0;
    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      // Ambient motion is pure decoration: also skip work while the tab is
      // hidden (the old loop kept compositing a full-screen canvas in
      // background tabs).
      if (document.hidden || now - lastDraw < FRAME_MS) return;
      lastDraw = now;

      time += 1;
      ctx.clearRect(0, 0, width, height);

      const isCurrentRain = toneRef.current.includes('rain');
      // Parallax foreground shift factor 1.35x — read imperatively from the
      // module store, so pointer motion never re-renders this component.
      const p = getParallax();
      const shiftX = -p.x * 24;
      const shiftY = -p.y * 24;

      // Ambient motes are decoration and gated; show bursts below are not.
      if (ambientRef.current) {
        for (let i = 0; i < particles.length; i++) {
          const part = particles[i];

          if (isCurrentRain) {
            // Rain streaks
            part.x += part.vx;
            part.y += part.vy;
            if (part.y > height) {
              part.y = -20;
              part.x = Math.random() * (width + 100);
            }
            if (part.x < -20) part.x = width + 20;

            const drawX = part.x + shiftX;
            const drawY = part.y + shiftY;

            ctx.beginPath();
            ctx.strokeStyle = `rgba(180, 205, 225, ${part.alpha * 0.4})`;
            ctx.lineWidth = 1.2;
            ctx.moveTo(drawX, drawY);
            ctx.lineTo(drawX + part.vx * 3, drawY + part.vy * 3);
            ctx.stroke();
          } else {
            // Warm floating motes / dust
            part.baseY += part.vy;
            if (part.baseY < -20) {
              part.baseY = height + 20;
              part.baseX = Math.random() * width;
            }

            const wobble =
              Math.sin(time * part.wobbleSpeed + part.pulseOffset) * part.wobbleRadius;
            const currentAlpha =
              (Math.sin(time * part.pulseSpeed + part.pulseOffset) * 0.5 + 0.5) * part.maxAlpha;

            // Glowing dust mote — one pre-rendered sprite, scaled and faded.
            const d = part.size * 4.4; // sprite diameter in CSS px
            ctx.globalAlpha = currentAlpha;
            ctx.drawImage(
              glowSprite!,
              part.baseX + wobble + shiftX - d / 2,
              part.baseY + shiftY - d / 2,
              d,
              d
            );
          }
        }
      }

      // ---- Show fireworks bursts (docs/perform/05 §4.4) ----
      // Drawn on the SAME canvas/loop: N `drawImage` calls, no second
      // full-screen composite. `now` drives aging so a burst expires even if
      // its cancel timer fires late.
      if (burstGroups.length) {
        for (const group of burstGroups) {
          const age = now - group.startedAt;
          const fade = Math.max(0, 1 - age / group.durationMs);
          for (const bp of group.particles) {
            if (!group.seeded) {
              bp.x *= width;
              bp.y *= height;
            }
            bp.x += bp.vx;
            bp.y += bp.vy + 0.06; // gravity
            const d = bp.size * 3;
            ctx.globalAlpha = fade;
            ctx.drawImage(group.sprite, bp.x - d / 2, bp.y - d / 2 + shiftY, d, d);
          }
          group.seeded = true;
        }
        // Reap finished groups so the array never grows unbounded.
        burstGroups = burstGroups.filter((g) => now - g.startedAt < g.durationMs);
      }
      ctx.globalAlpha = 1;
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
