import React, { useEffect, useRef, useState } from 'react';
import { subscribeParallax } from '../../lib/parallax.js';
import { materialSkinOf } from '@airp/shared/forms';
import { airpGateway } from '../../lib/airp-gateway.js';
import { useStill } from '../../lib/motion.js';

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
  const still = useStill();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const [readySrc, setReadySrc] = useState<string | null>(null);

  const bgIsVideo = !!bg.src && /\.(mp4|webm)$/i.test(bg.src);
  const motionUrl = bg.video ? airpGateway.assetUrl(bg.video, undefined, 'video') : null;
  const directVideoUrl = bgIsVideo
    ? airpGateway.assetUrl(bg.src!, undefined, 'video')
    : null;
  const motionAllowed = effectsEnabled && !still;
  const videoSrc = motionAllowed ? motionUrl ?? directVideoUrl : null;
  // A companion `video` always uses `bg.src` as its static poster. A video
  // src without a declared poster intentionally falls back to paper.
  const posterSrc = bg.src && !bgIsVideo
    ? airpGateway.assetUrl(bg.src, undefined, 'image')
    : null;
  const isVideo = !!videoSrc && failedVideo !== videoSrc;
  const src = isVideo ? videoSrc : posterSrc;
  const sourceRef = useRef<string | null>(src);
  sourceRef.current = src;
  const sourceFailed = isVideo ? failedVideo === src : failedSrc === src;
  const mediaState = (videoSrc && failedVideo === videoSrc) || sourceFailed
    ? 'failed'
    : src && readySrc === src
      ? 'ready'
      : src
        ? 'loading'
        : 'paper';

  // Parallax is optional decoration. Effects off and reduced motion both
  // restore the paper to its neutral position without touching the scene fact.
  useEffect(
    () =>
      subscribeParallax((p) => {
        const el = rootRef.current;
        if (!el || !motionAllowed || isVideo) return;
        el.style.transform = `translate3d(${p.x * 16}px, ${p.y * 16}px, 0) scale(1.06)`;
      }),
    [motionAllowed, isVideo]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (root && (!motionAllowed || isVideo)) {
      root.style.transform = 'translate3d(0, 0, 0) scale(1.06)';
    }
    const video = videoRef.current;
    if (!video || !isVideo || !src) return;
    let disposed = false;
    const sync = () => {
      if (disposed || !motionAllowed || (typeof document !== 'undefined' && document.hidden) || readySrc !== src) {
        video.pause();
        return;
      }
      void video.play().catch(() => {
        // Autoplay rejection is not an asset failure; keep the poster visible.
      });
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      disposed = true;
      video.pause();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [motionAllowed, isVideo, src, readySrc]);

  const markReady = (asset: string): void => {
    if (sourceRef.current === asset) setReadySrc(asset);
  };
  const markFailed = (asset: string, video: boolean): void => {
    if (sourceRef.current !== asset) return;
    if (video) setFailedVideo(asset);
    else setFailedSrc(asset);
  };

  return (
    <div
      ref={rootRef}
      className={`scene-backdrop ${materialSkinOf(bg.grain)}`}
      data-tone={bg.tone}
      data-media-state={mediaState}
      style={{ transform: 'translate3d(0, 0, 0) scale(1.06)', transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {isVideo && src ? (
        <video
          key={src}
          ref={videoRef}
          className="scene-backdrop__img object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterSrc ?? undefined}
          src={src}
          onLoadedMetadata={() => markReady(src!)}
          onCanPlay={() => markReady(src!)}
          onError={() => markFailed(src!, true)}
        />
      ) : posterSrc && failedSrc !== posterSrc ? (
        <img
          key={posterSrc}
          className="scene-backdrop__img"
          src={posterSrc}
          alt=""
          onLoad={() => markReady(posterSrc)}
          onError={() => markFailed(posterSrc, false)}
        />
      ) : null}
      <div className="scene-backdrop__vignette" />
    </div>
  );
};
