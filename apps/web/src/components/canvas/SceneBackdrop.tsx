import React, { useEffect, useRef, useState } from 'react';
import { subscribeParallax } from '../../lib/parallax.js';
import { materialSkinOf } from '@airp/shared/forms';
import { airpGateway } from '../../lib/airp-gateway.js';

/** The layer backdrop payload from `GET /api/layer` (see LayerState.bg). */
export interface SceneBackdropBg {
  /** World-relative asset path (`assets/scenes/<layer>/<file>.png`), or null. */
  src: string | null;
  /** Optional animated companion; src remains the static fallback. */
  video?: string;
  /** Material tone — a CSS hook (`data-tone`), NOT an audio selector (see docs/audio/03 §3.2). */
  tone: string;
  /** Material skin key — `parchment` | `warm` | `stub` | `kraft`. */
  grain: string;
}

export interface SceneBackdropProps {
  bg: SceneBackdropBg;
  effectsEnabled?: boolean;
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
export const SceneBackdrop: React.FC<SceneBackdropProps> = ({ bg, effectsEnabled = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const motionUrl = bg.video ? airpGateway.assetUrl(bg.video) : null;
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const useMotion = effectsEnabled && !!motionUrl && failedVideo !== motionUrl;
  const src = useMotion ? motionUrl : bg.src ? airpGateway.assetUrl(bg.src) : null;
  const isAvailable = !!src && failedSrc !== src;
  const isVideo = useMotion || (!!bg.src && /\.(mp4|webm)$/i.test(bg.src));

  // Parallax drift is written straight to the DOM from the module store: a
  // pointermove used to arrive here as a React prop and re-render the whole
  // canvas subtree. 0.25x background shift, scaled up so <br>edges never bleed.
  useEffect(
    () =>
      subscribeParallax((p) => {
        const el = rootRef.current;
        if (!el || !effectsEnabled || isVideo) return;
        el.style.transform = `translate3d(${p.x * 16}px, ${p.y * 16}px, 0) scale(1.06)`;
      }),
    [effectsEnabled, isVideo]
  );

  useEffect(() => {
    if ((!effectsEnabled || isVideo) && rootRef.current) rootRef.current.style.transform = 'translate3d(0, 0, 0) scale(1.06)';
    const video = videoRef.current;
    if (!video) return;
    const sync = () => {
      if (!effectsEnabled || document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { video.pause(); document.removeEventListener('visibilitychange', sync); };
  }, [effectsEnabled, src, isAvailable]);

  return (
    <div
      ref={rootRef}
      className={`scene-backdrop ${materialSkinOf(bg.grain)}`}
      data-tone={bg.tone}
      style={{ transform: 'translate3d(0, 0, 0) scale(1.06)', transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {isAvailable && (
        isVideo ? (
          <video
            key={src}
            ref={videoRef}
            className="scene-backdrop__img object-cover"
            loop
            muted
            playsInline
            preload="metadata"
            poster={bg.video && bg.src ? airpGateway.assetUrl(bg.src) : undefined}
            src={src}
            onError={() => useMotion ? setFailedVideo(src) : setFailedSrc(src)}
          />
        ) : (
          <img
            key={src}
            className="scene-backdrop__img"
            src={src}
            alt=""
            onError={() => setFailedSrc(src)}
          />
        )
      )}
      <div className="scene-backdrop__vignette" />
    </div>
  );
};
