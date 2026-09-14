import React, { useEffect, useRef } from 'react';
import { getParallax } from '../../lib/parallax.js';

export interface ParticleLayerProps {
  tone?: string;
  /** Keep the existing ambient switch compatible with Canvas callers. */
  ambient?: boolean;
  /** Shared lifecycle gate for both particle surfaces. */
  effectsEnabled?: boolean;
  hidden?: boolean;
  reducedMotion?: boolean;
}

export interface ParticleLifecycle {
  effectsEnabled: boolean;
  hidden: boolean;
  reducedMotion: boolean;
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

/**
 * Ambient and burst are separate observable surfaces in one module. Bursts
 * use bounded DOM sprites rather than another full-screen canvas, while the
 * ambient canvas keeps the existing low-frequency drawing budget.
 */
interface BurstGroup {
  particles: BurstParticle[];
  color: string;
  startedAt: number;
  durationMs: number;
  seeded: boolean;
  nodes: HTMLSpanElement[];
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface BurstSpec {
  color?: string;
  bursts?: number;
  origin?: string;
  durationMs: number;
}

/** Particles per cluster — 8 clusters × 12 = the frozen 96-particle ceiling. */
const BURST_PER_CLUSTER = 12;

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
let burstHost: HTMLElement | null = null;
let burstLifecycle: ParticleLifecycle = {
  effectsEnabled: true,
  hidden: false,
  reducedMotion: false,
};
let wakeParticleLoop: (() => void) | null = null;

function removeBurstNodes(group: BurstGroup): void {
  for (const node of group.nodes) node.remove();
  group.nodes = [];
}

function mountBurstNodes(group: BurstGroup, host: HTMLElement): void {
  if (group.nodes.length || typeof document === 'undefined') return;
  for (const particle of group.particles) {
    const node = document.createElement('span');
    node.setAttribute('aria-hidden', 'true');
    node.style.position = 'absolute';
    node.style.borderRadius = '50%';
    node.style.pointerEvents = 'none';
    node.style.background = `radial-gradient(circle, ${group.color} 0 35%, transparent 72%)`;
    node.style.willChange = 'transform, opacity';
    host.appendChild(node);
    group.nodes.push(node);
    // The bounded surface owns the origin; animation supplies pixel transforms.
    node.style.left = '0px';
    node.style.top = '0px';
  }
}

/**
 * Play one fireworks burst. The optional host keeps existing callers working;
 * a mounted ParticleLayer registers its bounded burst surface automatically.
 */
export function playBurst(spec: BurstSpec, host?: HTMLElement): () => void {
  if (
    burstLifecycle.hidden ||
    !burstLifecycle.effectsEnabled ||
    burstLifecycle.reducedMotion
  ) {
    return () => {};
  }

  const color = typeof spec.color === 'string' && spec.color ? spec.color : 'rgb(235, 205, 140)';
  const clusters = Math.max(1, Math.min(8, Math.floor(spec.bursts ?? 5)));
  const durationMs = Number.isFinite(spec.durationMs) ? Math.max(0, spec.durationMs) : 3000;
  const origin = parseOrigin(spec.origin);
  const particles: BurstParticle[] = [];

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
      });
    }
  }

  const group: BurstGroup = {
    particles,
    color,
    startedAt: performance.now(),
    durationMs,
    seeded: false,
    nodes: [],
  };
  burstGroups = [group]; // latest intent takes the fireworks resource lane
  const surface = host ?? burstHost;
  if (surface) mountBurstNodes(group, surface);
  wakeParticleLoop?.();

  return () => {
    removeBurstNodes(group);
    burstGroups = burstGroups.filter((g) => g !== group);
  };
}

export const ParticleLayer: React.FC<ParticleLayerProps> = ({
  tone = 'warm',
  ambient = true,
  effectsEnabled = true,
  hidden = false,
  reducedMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstRef = useRef<HTMLDivElement | null>(null);

  const toneRef = useRef(tone);
  toneRef.current = tone;
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;
  const lifecycleRef = useRef<ParticleLifecycle>({ effectsEnabled, hidden, reducedMotion });
  lifecycleRef.current = { effectsEnabled, hidden, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    const burstSurface = burstRef.current;
    if (!canvas || !burstSurface) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!glowSprite) glowSprite = makeGlowSprite();

    burstHost = burstSurface;
    burstLifecycle = lifecycleRef.current;
    for (const group of burstGroups) mountBurstNodes(group, burstSurface);

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const count = 48;
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

    const FRAME_MS = 1000 / 30;
    let time = 0;
    let lastDraw = 0;
    const isPaused = () => {
      const state = lifecycleRef.current;
      return document.hidden || state.hidden || !state.effectsEnabled || state.reducedMotion;
    };
    const hasWork = () => ambientRef.current || burstGroups.length > 0;
    const schedule = () => {
      if (!animId && !isPaused() && hasWork()) animId = requestAnimationFrame(render);
    };
    const stop = () => {
      if (animId) cancelAnimationFrame(animId);
      animId = 0;
    };
    const render = (now: number) => {
      animId = 0;
      // Do not keep a RAF chain alive in hidden/reduced/effects-off states.
      if (isPaused() || !hasWork()) return;
      if (now - lastDraw < FRAME_MS) {
        schedule();
        return;
      }
      lastDraw = now;
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const isCurrentRain = toneRef.current.includes('rain');
      const p = getParallax();
      const shiftX = -p.x * 24;
      const shiftY = -p.y * 24;

      if (ambientRef.current) {
        for (const part of particles) {
          if (isCurrentRain) {
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
            part.baseY += part.vy;
            if (part.baseY < -20) {
              part.baseY = height + 20;
              part.baseX = Math.random() * width;
            }
            const wobble =
              Math.sin(time * part.wobbleSpeed + part.pulseOffset) * part.wobbleRadius;
            const currentAlpha =
              (Math.sin(time * part.pulseSpeed + part.pulseOffset) * 0.5 + 0.5) * part.maxAlpha;
            const d = part.size * 4.4;
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

      for (const group of burstGroups) {
        mountBurstNodes(group, burstSurface);
        const age = now - group.startedAt;
        const fade = Math.max(0, 1 - age / Math.max(1, group.durationMs));
        for (let i = 0; i < group.particles.length; i++) {
          const bp = group.particles[i];
          if (!group.seeded) {
            bp.x *= width;
            bp.y *= height;
          }
          bp.x += bp.vx;
          bp.y += bp.vy + 0.06;
          const d = bp.size * 3;
          const node = group.nodes[i];
          node.style.width = `${d}px`;
          node.style.height = `${d}px`;
          node.style.opacity = String(fade);
          node.style.transform = `translate3d(${bp.x + shiftX - d / 2}px, ${bp.y + shiftY - d / 2}px, 0)`;
        }
        group.seeded = true;
        if (age >= group.durationMs) removeBurstNodes(group);
      }
      burstGroups = burstGroups.filter((group) => now - group.startedAt < group.durationMs);
      ctx.globalAlpha = 1;
      schedule();
    };
    const onVisibility = () => {
      if (isPaused()) stop();
      else schedule();
    };
    wakeParticleLoop = schedule;
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      if (wakeParticleLoop === schedule) wakeParticleLoop = null;
      if (burstHost === burstSurface) burstHost = null;
      for (const group of burstGroups) removeBurstNodes(group);
      burstGroups = [];
    };
  }, []);

  useEffect(() => {
    burstLifecycle = lifecycleRef.current;
    if (!burstLifecycle.effectsEnabled || burstLifecycle.hidden || burstLifecycle.reducedMotion) {
      for (const group of burstGroups) removeBurstNodes(group);
      burstGroups = [];
    }
    wakeParticleLoop?.();
  }, [effectsEnabled, hidden, reducedMotion, ambient]);

  return (
    <div className="absolute inset-0 pointer-events-none" data-particle-module="true">
      <canvas
        className="particle-surface particle-surface--ambient absolute inset-0 pointer-events-none z-10 w-full h-full"
        data-particle-surface="ambient"
        data-depth="background"
        aria-hidden="true"
      />
      <div
        ref={burstRef}
        className="particle-surface particle-surface--burst absolute inset-0 pointer-events-none overflow-hidden z-20"
        data-particle-surface="burst"
        data-depth="performance"
      />
    </div>
  );
};
