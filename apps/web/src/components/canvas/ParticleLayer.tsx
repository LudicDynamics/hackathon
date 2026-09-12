import React, { useEffect, useRef } from 'react';
import { getParallax } from '../../lib/parallax.js';

export interface ParticleLayerProps {
  tone?: string;
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

export const ParticleLayer: React.FC<ParticleLayerProps> = ({ tone = 'warm' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toneRef = useRef(tone);
  toneRef.current = tone;

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
