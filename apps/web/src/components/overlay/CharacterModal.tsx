import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playStinger, type Emotion } from '../../lib/audio.js';
import { useLocale } from '../../lib/i18n.js';
import { MotionPortrait } from './MotionPortrait.js';

/**
 * CharacterModal — galgame dialogue overlay (wave 2, Task D, T3.3).
 *
 * Full rewrite from the v1 IM/bubble-transcript layout:
 *  - the canvas itself is dimmed + blurred behind a warm-ink tint (no black sheet)
 *  - a bottom-pinned split portrait stage (lit speaker / dimmed counterpart)
 *  - a slightly tilted paper dialog at the bottom: name plate, quadrille
 *    narration line, a fixed-height streaming line, and the player's single
 *    input row inside the paper.
 *
 * No chat bubbles, no scrollable history, no HUD. The character's latest line
 * streams in word by word; the player's last line is echoed once above it.
 */

interface CharacterModalProps {
  characterId: string;
  displayName?: string;
  avatar?: string;
  avatarVideo?: string;
  effectsEnabled?: boolean;
  bio?: string;
  onClose: () => void;
  /** character_prompt protocol — the app wraps this in the message type; unchanged. */
  onSendMessage?: (msg: string) => void;
}

/** T3.2 emotion-tag protocol. Moods are pure CSS diffs until sprite sheets land.
 *  The union lives in `lib/audio.ts` (single source of truth — it also types
 *  `playStinger`); this file imports it rather than re-declaring it. */

const EMO_TAGS: readonly Emotion[] = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];


/** Current on-stage performance: idle → thinking → streaming → done. */
type Phase = 'idle' | 'thinking' | 'streaming' | 'done';

/** Strip a leading "[emo: tag]" (T3.2); returns display text + parsed mood. */
function parseEmoTag(raw: string): { text: string; emo: Emotion } {
  const match = /^\[emo:\s*([a-z]+)\]\s*/.exec(raw);
  if (!match) return { text: raw, emo: 'normal' };
  const tag = match[1] as Emotion;
  return { text: raw.slice(match[0].length), emo: EMO_TAGS.includes(tag) ? tag : 'normal' };
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  characterId,
  displayName = characterId,
  avatar,
  avatarVideo,
  effectsEnabled = false,
  bio,
  onClose,
  onSendMessage,
}) => {
  const { locale, t } = useLocale();
  const ja = locale === 'ja';
  const [phase, setPhase] = useState<Phase>('idle');
  const [emo, setEmo] = useState<Emotion>('normal');
  const [line, setLine] = useState(''); // full current line (shown once streaming)
  const [shown, setShown] = useState(''); // streamed prefix of line
  const [playerEcho, setPlayerEcho] = useState(''); // last player line, echoed without history
  const [inputText, setInputText] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [closing, setClosing] = useState(false);

  const streamTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const streamed = useRef('');

  const clearTimers = useCallback(() => {
    if (streamTimer.current !== null) window.clearTimeout(streamTimer.current);
    streamTimer.current = null;
  }, []);

  // Close: brief paper-descend + fade (220ms), then unmount.
  const handleClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onClose(), 220);
  }, [onClose]);

  // Real agent frames own the reply; an opening UI hint is not character speech.
  useEffect(() => {
    const receive = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame.source !== 'character' || frame.characterId !== characterId) return;
      if (frame.type === 'character_delta') {
        streamed.current += String(frame.delta || '');
        const parsed = parseEmoTag(streamed.current);
        setLine(parsed.text); setShown(parsed.text); setEmo(parsed.emo); setPhase('streaming');
      } else if (frame.type === 'character_message') {
        streamed.current = '';
        const parsed = parseEmoTag(String(frame.text || ''));
        setLine(parsed.text); setShown(parsed.text); setEmo(parsed.emo);
      } else if (frame.type === 'character_idle') {
        setPhase('done');
      } else if (frame.type === 'error' || frame.type === 'turn_aborted') {
        const notice = String(frame.message || t('The agent could not finish. Please try again.'));
        setLine(notice); setShown(notice); setPhase('done');
      }
    };
    window.addEventListener('airp:agent-frame', receive);
    return () => window.removeEventListener('airp:agent-frame', receive);
  }, [characterId, t]);

  // Unmount: cancel every pending timer.
  useEffect(() => clearTimers, [clearTimers]);

  // Esc closes the overlay (kept from v1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // Reset the monogram fallback if the avatar path changes.
  useEffect(() => setAvatarError(false), [avatar]);

  const handleSend = () => {
    const msg = inputText.trim();
    if (!msg || phase === 'thinking' || phase === 'streaming') return; // one performance at a time
    setInputText('');
    setPlayerEcho(msg); // kept on the paper, not a history list
    clearTimers(); streamed.current = '';
    setLine(''); setShown(''); setPhase('thinking'); setEmo('thinking');
    onSendMessage?.(msg);
  };

  const busy = phase === 'thinking' || phase === 'streaming';
  const showAvatar = !avatarError && !!avatar;
  const monogram = characterId.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`character-modal-layer${closing ? ' modal-closing' : ''}`}
      role="dialog"
      aria-label={ja ? `${displayName}との会話` : `Dialogue with ${displayName}`}
    >
      <button type="button" className="modal-close" onClick={handleClose} aria-label={t('Close dialog')}>
        ×
      </button>

      {/* Split portrait stage. Single-character world: watson owns the right
          slot, closest to the paper's input side; the left slot stays empty
          per spec (silhouette placeholder unnecessary without a 2nd portrait). */}
      <div className="portrait-stage">
        <div className="portrait-slot" aria-hidden="true" />
        <div className="portrait-slot lit">
          <div className="portrait-breathe">
            <div className={`portrait-emo emo-${emo}${emo === 'shock' ? ' emo-shock-shake' : ''}`}>
              {showAvatar ? (
                <MotionPortrait video={avatarVideo} poster={avatar} enabled={effectsEnabled} name={displayName} onPosterError={() => setAvatarError(true)} />
              ) : (
                <div className="portrait-fallback" role="img" aria-label={displayName}>
                  {monogram}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tilted paper dialog: name plate, narration, streaming line, input. */}
      <div className={`speech-paper${closing ? ' speech-paper-closing' : ''}`}>
        <div className="name-plate">{displayName}</div>
        <p className="narr-line">{bio || ''}</p>

        <div className="line-stage">
          {playerEcho && <span className="player-echo">“{playerEcho}”</span>}
          {phase === 'thinking' && (
            <span className="thinking-hint">{ja ? '応答を待っています…' : `${displayName} is thinking…`}</span>
          )}
          {(phase === 'streaming' || phase === 'done') && line !== '' && (
            <span className="speech-line">
              {shown}
              {phase === 'streaming' && <span className="type-caret" aria-hidden="true" />}
            </span>
          )}
        </div>

        <input
          type="text"
          autoFocus
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
          }}
          placeholder={ja ? `${displayName}に話しかける…（Enterで送信）` : `Say something to ${displayName}… (Enter to send)`}
          aria-label={ja ? `${displayName}へのメッセージ` : `Message to ${displayName}`}
          disabled={busy}
          className="speech-input"
        />
      </div>
    </div>
  );
};
