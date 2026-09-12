import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playStinger, type Emotion } from '../../lib/audio.js';

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
  avatar?: string;
  bio?: string;
  onClose: () => void;
  /** character_prompt protocol — the app wraps this in the message type; unchanged. */
  onSendMessage?: (msg: string) => void;
}

/** T3.2 emotion-tag protocol. Moods are pure CSS diffs until sprite sheets land.
 *  The union lives in `lib/audio.ts` (single source of truth — it also types
 *  `playStinger`); this file imports it rather than re-declaring it. */

const EMO_TAGS: readonly Emotion[] = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

/**
 * Local fallback reply bank — T3.1 STOPGAP until the backend character agent
 * streams real responses through the character_prompt channel. The channel
 * (onSendMessage) is intentionally preserved; this bank only covers the
 * offline gap. Replies carry T3.2 [emo: tag] prefixes to exercise the parser.
 */
const FALLBACK_REPLIES: ReadonlyArray<{ text: string; emo: Emotion }> = [
  { text: '[emo: thinking] Let me think... this is more complicated than it looks.', emo: 'thinking' },
  { text: '[emo: smile] I am glad we can speak of this. Please, do be careful.', emo: 'smile' },
  { text: '[emo: shock] What?! Where did you find that thing?!', emo: 'shock' },
  { text: '[emo: sad] There are things I cannot change about last winter...', emo: 'sad' },
  { text: '[emo: angry] That is a dangerous path. I will not help you walk it.', emo: 'angry' },
  { text: 'The fire keeps its own time here. So do we.', emo: 'normal' },
];

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
  avatar = '/assets/characters/portraits/lady_1.png',
  bio,
  onClose,
  onSendMessage,
}) => {
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

  /**
   * Stream a line char by char. Rhythm = personality: watson reads at a steady
   * 45ms/char, pauses 300ms after a comma, 150ms after sentence punctuation.
   * The portrait shows `thinking` during the 100–400ms ponder, then switches
   * to the reply's parsed [emo:] mood as the stream begins (tags sit at line
   * start, so they lead the mood of the whole reply).
   */
  const streamLine = useCallback(
    (fullText: string, mood: Emotion) => {
      clearTimers();
      setLine(fullText);
      setShown('');
      setPhase('thinking');
      setEmo('thinking');

      const thinkMs = 100 + Math.random() * 300; // 100–400ms "陷入沉思"
      streamTimer.current = window.setTimeout(() => {
        setPhase('streaming');
        setEmo(mood);
        // T3.2 — the [emo:] tag does double duty: it swaps the sprite AND fires a
        // short one-shot stinger. It MUST NOT touch the BGM main track (galgame
        // convention: emotion is a transient accent, not a score change); see
        // docs/audio/02 §3.8 and docs/audio/04 §3.2. No-op when the stinger
        // asset is missing (assets/audio/stinger/ is a known gap).
        playStinger(mood);
        let i = 0;
        const step = () => {
          if (streamTimer.current === null) return; // cancelled/unmounted
          i += 1;
          setShown(fullText.slice(0, i));
          if (i >= fullText.length) {
            setPhase('done');
            streamTimer.current = null;
            return;
          }
          const prev = fullText[i - 1];
          let delay = 45;
          if (prev === ',' || prev === '，') delay = 300;
          else if ('.;!?。！？…'.includes(prev)) delay = 150;
          streamTimer.current = window.setTimeout(step, delay);
        };
        streamTimer.current = window.setTimeout(step, 45);
      }, thinkMs);
    },
    [clearTimers],
  );

  // Opening line, streamed shortly after the overlay settles.
  useEffect(() => {
    const t = window.setTimeout(
      () => streamLine('(Watching you) Is there something you would like to know?', 'normal'),
      420,
    );
    return () => window.clearTimeout(t);
  }, [streamLine]);

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
    onSendMessage?.(msg); // character_prompt protocol — App wires the message type
    const pick = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    const { text, emo: mood } = parseEmoTag(pick.text);
    streamLine(text, mood);
  };

  const busy = phase === 'thinking' || phase === 'streaming';
  const showAvatar = !avatarError && !!avatar;
  const monogram = characterId.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`character-modal-layer${closing ? ' modal-closing' : ''}`}
      role="dialog"
      aria-label={`Dialogue with ${characterId}`}
    >
      <button type="button" className="modal-close" onClick={handleClose} aria-label="Close dialog">
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
                <img src={avatar} alt={characterId} onError={() => setAvatarError(true)} />
              ) : (
                <div className="portrait-fallback" role="img" aria-label={`${characterId} portrait`}>
                  {monogram}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tilted paper dialog: name plate, narration, streaming line, input. */}
      <div className={`speech-paper${closing ? ' speech-paper-closing' : ''}`}>
        <div className="name-plate">{characterId}</div>
        <p className="narr-line">{bio ? bio : '(necessary description)'}</p>

        <div className="line-stage">
          {playerEcho && <span className="player-echo">“{playerEcho}”</span>}
          {phase === 'thinking' && (
            <span className="thinking-hint">{characterId} is thinking…</span>
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
            if (e.key === 'Enter') handleSend();
          }}
          placeholder={`Say something to ${characterId}… (Enter to send)`}
          aria-label={`Message to ${characterId}`}
          disabled={busy}
          className="speech-input"
        />
      </div>
    </div>
  );
};
