import React, { useState } from 'react';
import { materialSkinOf } from '@airp/shared/forms';

/** The layer backdrop payload from `GET /api/layer` (see LayerState.bg). */
export interface SceneBackdropBg {
  /** World-relative asset path (`assets/scenes/<layer>/<file>.png`), or null. */
  src: string | null;
  /** Material tone — a CSS hook (`data-tone`), NOT an audio selector (see docs/audio/03 §3.2). */
  tone: string;
  /** Material skin key — `parchment` | `warm` | `stub` | `kraft`. */
  grain: string;
}

export interface SceneBackdropProps {
  bg: SceneBackdropBg;
  /** Normalized mouse parallax coordinates [-1, 1] */
  parallax?: { x: number; y: number };
}

/**
 * The layer's "paper" fills the viewport: a material skin (always present) →
 * optional painted scene image or video → warm-ink edge vignette. It sits behind the
 * camera viewport (`absolute inset 0`, `z-0`, `pointer-events: none`), so it
 * never intercepts canvas clicks.
 *
 * Parallax depth: 0.25x slow drift with camera & pointer.
 * Video support: if src ends with .mp4 or .webm, renders an autoplaying loop video.
 */
export const SceneBackdrop: React.FC<SceneBackdropProps> = ({ bg, parallax = { x: 0, y: 0 } }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = bg.src;
  const isAvailable = !!src && failedSrc !== src;
  const isVideo = !!src && /\.(mp4|webm)$/i.test(src);

  // Parallax transform: 0.25x background drift (scaled up slightly so edges never bleed)
  const shiftX = parallax.x * 16;
  const shiftY = parallax.y * 16;
  const parallaxStyle: React.CSSProperties = {
    transform: `translate3d(${shiftX}px, ${shiftY}px, 0) scale(1.06)`,
    transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div
      className={`scene-backdrop ${materialSkinOf(bg.grain)}`}
      data-tone={bg.tone}
      style={parallaxStyle}
    >
      {isAvailable && (
        isVideo ? (
          <video
            className="scene-backdrop__img object-cover"
            autoPlay
            loop
            muted
            playsInline
            src={`/api/asset?path=${encodeURIComponent(src)}`}
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <img
            className="scene-backdrop__img"
            src={`/api/asset?path=${encodeURIComponent(src)}`}
            alt=""
            onError={() => setFailedSrc(src)}
          />
        )
      )}
      <div className="scene-backdrop__vignette" />
    </div>
  );
};

