/**
 * MuteButton.tsx — self-contained 36px round sound toggle for the header
 * (Main inserts it next to the God Mode controls). Ink-reverse hover per v2.
 */
import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '../../state/useAudio.js';

export const MuteButton: React.FC<{ muteLabel?: string; unmuteLabel?: string }> = ({
  muteLabel = 'Mute sound',
  unmuteLabel = 'Unmute sound',
}) => {
  const { muted, toggleMuted } = useAudio();

  return (
    <button
      onClick={toggleMuted}
      title={muted ? unmuteLabel : muteLabel}
      aria-label={muted ? unmuteLabel : muteLabel}
      className="w-9 h-9 rounded-full flex items-center justify-center bg-paper-card/80 border border-ink/10 text-ink/70 hover:bg-ink hover:text-white shadow-soft transition-colors"
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
};
