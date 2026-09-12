import React, { useEffect, useRef } from 'react';
import { createFrameLoop } from '../../lib/effects-clock.mjs';

export interface ParticleLayerProps {
  tone?: string;
  /** Normalized mouse parallax coordinates [-1, 1] */
  parallaxRef: React.RefObject<{ x: number; y: number }>;
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

export const ParticleLayer: React.FC<ParticleLayerProps> = ({
  tone = 'warm',
  parallaxRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toneRef = useRef(tone);
  toneRef.current = tone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      const scale = Math.min(1, 1600 / width, 1000 / height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    window.addEventListener('resize', onResize);
    onResize();

    // Cache one soft light texture instead of allocating gradients per particle/frame.
    const mote = document.createElement('canvas');
    mote.width = mote.height = 32;
    const paint = mote.getContext('2d')!;
    const glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, 'rgba(235, 205, 140, 1)');
    glow.addColorStop(.5, 'rgba(215, 160, 90, .5)');
    glow.addColorStop(1, 'rgba(215, 160, 90, 0)');
    paint.fillStyle = glow;
    paint.fillRect(0, 0, 32, 32);

    const count = width < 700 ? 16 : 32;
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

    let time = 0;
    const render = (delta: number) => {
      const step = delta / (1000 / 60);
      time += step;
      ctx.clearRect(0, 0, width, height);

      const isCurrentRain = toneRef.current.includes('rain');
      // Parallax foreground shift factor 1.35x
      const shiftX = -parallaxRef.current.x * 24;
      const shiftY = -parallaxRef.current.y * 24;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (isCurrentRain) {
          // Rain streaks
          p.x += p.vx * step;
          p.y += p.vy * step;
          if (p.y > height) {
            p.y = -20;
            p.x = Math.random() * (width + 100);
          }
          if (p.x < -20) p.x = width + 20;

          const drawX = p.x + shiftX;
          const drawY = p.y + shiftY;

          ctx.beginPath();
          ctx.strokeStyle = `rgba(180, 205, 225, ${p.alpha * 0.4})`;
          ctx.lineWidth = 1.2;
          ctx.moveTo(drawX, drawY);
          ctx.lineTo(drawX + p.vx * 3, drawY + p.vy * 3);
          ctx.stroke();
        } else {
          // Warm floating motes / dust
          p.baseY += p.vy * step;
          if (p.baseY < -20) {
            p.baseY = height + 20;
            p.baseX = Math.random() * width;
          }

          const wobble = Math.sin(time * p.wobbleSpeed + p.pulseOffset) * p.wobbleRadius;
          const currentAlpha =
            (Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.5 + 0.5) * p.maxAlpha;

          const drawX = p.baseX + wobble + shiftX;
          const drawY = p.baseY + shiftY;

          const radius = p.size * 2.2;
          ctx.globalAlpha = currentAlpha;
          ctx.drawImage(mote, drawX - radius, drawY - radius, radius * 2, radius * 2);
          ctx.globalAlpha = 1;
        }
      }

    };
    const loop = createFrameLoop(render);
    const syncVisibility = () => { if (document.hidden) loop.stop(); else loop.start(); };
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();

    return () => {
      loop.stop();
      document.removeEventListener('visibilitychange', syncVisibility);
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
