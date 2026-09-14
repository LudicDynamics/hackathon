import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStill } from '../../lib/motion.js';

/**
 * Shared character media projection for dialogue and Nook. It owns the single
 * video/image fallback state machine; callers only provide already-resolved
 * asset URLs and their presentation fallback.
 */
export interface CharacterMediaProps {
  video?: string;
  poster?: string;
  enabled: boolean;
  name: string;
  className?: string;
  fallback?: ReactNode;
  onPosterError?: () => void;
}

export function CharacterMedia({
  video,
  poster,
  enabled,
  name,
  className,
  fallback = null,
  onPosterError,
}: CharacterMediaProps) {
  const still = useStill();
  const ref = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef<string | undefined>(video);
  const [failedVideo, setFailedVideo] = useState(false);
  const [failedPoster, setFailedPoster] = useState(false);
  const [ready, setReady] = useState<string | null>(null);
  sourceRef.current = video;

  useEffect(() => {
    setFailedVideo(false);
    setFailedPoster(false);
    setReady(null);
  }, [video, poster]);

  const playing = enabled && !still && !!video && !failedVideo;

  useEffect(() => {
    const element = ref.current;
    if (!element || !playing || !video) return;
    let visible = true;
    let disposed = false;
    const sync = () => {
      if (disposed || document.hidden || !visible || ready !== video) element.pause();
      else void element.play().catch(() => {
        // Autoplay policy is not an asset failure; keep the visible still frame.
      });
    };
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
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

  const markReady = (asset: string) => {
    if (sourceRef.current === asset) setReady(asset);
  };
  const markVideoFailed = (asset: string) => {
    if (sourceRef.current === asset) setFailedVideo(true);
  };

  if (playing) {
    return (
      <video
        ref={ref}
        key={video}
        className={className}
        src={video}
        poster={poster}
        aria-label={name}
        data-media-state={ready === video ? 'ready' : 'loading'}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={() => markReady(video!)}
        onCanPlay={() => markReady(video!)}
        onError={() => markVideoFailed(video!)}
      />
    );
  }

  if (poster && !failedPoster) {
    return (
      <img
        className={className}
        src={poster}
        alt={name}
        data-media-state={failedVideo ? 'failed' : 'static'}
        onError={() => {
          setFailedPoster(true);
          onPosterError?.();
        }}
      />
    );
  }

  return <>{fallback}</>;
}
