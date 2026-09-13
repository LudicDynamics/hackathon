import { useEffect, useRef, useState } from 'react';

/** One visible conversation portrait, never a video decoder per small avatar. */
export function MotionPortrait({ video, poster, enabled, name, onPosterError }: {
  video?: string; poster?: string; enabled: boolean; name: string; onPosterError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const playing = enabled && !!video && failed !== video;
  useEffect(() => {
    const element = ref.current;
    if (!element || !playing) return;
    let visible = true;
    const sync = () => {
      if (document.hidden || !visible) element.pause();
      else void element.play().catch(() => {});
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; sync(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); element.pause(); };
  }, [playing, video]);
  return playing
    ? <video ref={ref} key={video} src={video} poster={poster} aria-label={name} muted loop playsInline preload="metadata" onError={() => setFailed(video!)} />
    : <img src={poster} alt={name} onError={onPosterError} />;
}
