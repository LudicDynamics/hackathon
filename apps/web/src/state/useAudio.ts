/**
 * useAudio.ts — React binding over the audio engine singleton.
 *
 * Module-level mutable state + a listener set; each `useAudio()` mount
 * subscribes and re-reads on notification, so toggling mute or switching the
 * ambient tone from anywhere (header button, App layer effect) refreshes every
 * subscriber without context plumbing.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  initAudio,
  setAmbient as engineSetAmbient,
  setMuted as engineSetMuted,
  isMuted,
} from '../lib/audio.js';

let muted = isMuted();
let ambient: string = 'rain';
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function useAudio(): {
  muted: boolean;
  toggleMuted: () => void;
  ambient: string;
  setAmbient: (tone: string) => void;
} {
  const [, force] = useState(0);

  useEffect(() => {
    initAudio(); // engine exists from mount; stays suspended until first gesture
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    muted = !muted;
    engineSetMuted(muted);
    notify();
  }, []);

  const setAmbient = useCallback((tone: string) => {
    ambient = tone;
    engineSetAmbient(tone);
    notify();
  }, []);

  return { muted, toggleMuted, ambient, setAmbient };
}
