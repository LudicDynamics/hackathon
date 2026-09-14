import { useEffect, useRef, useState } from 'react';
import { useStill } from '../../lib/motion.js';

/** One visible conversation portrait, never a video decoder per small avatar. */
export function MotionPortrait({ video, poster, enabled, name, onPosterError }: {
  video?: string; poster?: string; enabled: boolean; name: string; onPosterError: () => void;
}) {
  const still = useStill();
  const ref = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef<string | undefined>(video);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const playing = enabled && !still && !!video && failed !== video;
  sourceRef.current = video;

  useEffect(() => {
    const element = ref.current;
    if (!element || !playing || !video) return;
    let visible = true;
    let disposed = false;
    const sync = () => {
      if (disposed || document.hidden || !visible || ready !== video) element.pause();
      else void element.play().catch(() => {
        // A policy rejection is not proof that the portrait asset failed.
      });
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? false;
        sync();
      })
      : null;
    observer?.observe(element);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      element.pause();
    };
  }, [playing, video, ready]);

  const markReady = (asset: string): void => {
    if (sourceRef.current === asset) setReady(asset);
  };
  const markFailed = (asset: string): void => {
    if (sourceRef.current === asset) setFailed(asset);
  };

  return playing
    ? <video
      ref={ref}
      key={video}
      src={video}
      poster={poster}
      aria-label={name}
      data-media-state={ready === video ? 'ready' : 'loading'}
      muted
      loop
      playsInline
      onLoadedMetadata={() => markReady(video!)}
      onCanPlay={() => markReady(video!)}
      onError={() => markFailed(video!)}
    />
    : <img src={poster} alt={name} data-media-state={failed === video ? 'failed' : 'static'} onError={onPosterError} />;
}
