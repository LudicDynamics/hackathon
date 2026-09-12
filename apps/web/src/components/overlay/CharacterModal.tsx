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
 *
 * A3 (docs/wiring/03): the line now comes from the real character agent. App
 * routes raw WS frames to this modal via the `incoming` prop; the local reply
 * banks are gone (silence fallback only), and `[emo: tag]` is folded per line.
 */

interface CharacterModalProps {
  characterId: string;
  avatar?: string;
  bio?: string;
  onClose: () => void;
  /** character_prompt protocol — the app wraps this in the message type; unchanged. */
  onSendMessage?: (msg: string) => void;
  locale?: 'en' | 'ja';
  /** 最近一条属于本角色的真实帧；App 已按 activeModalCharId 过滤。null = 无。 */
  incoming?: CharacterFrame | null;
}

/** Raw character-lane frame as forwarded by useWorld (`detail: msg` verbatim). */
export type CharacterFrame =
  | { type: 'character_delta'; characterId?: string; delta: string; timestamp?: string }
  | { type: 'character_message'; characterId?: string; text: string; timestamp?: string }
  | { type: 'character_idle'; characterId?: string; timestamp?: string }
  | { type: 'error'; source?: string; characterId?: string; message: string; timestamp?: string };

/** T3.2 emotion-tag protocol. Moods are pure CSS diffs until sprite sheets land.
 *  The union lives in `lib/audio.ts` (single source of truth — it also types
 *  `playStinger`); this file imports it rather than re-declaring it. */
const EMO_TAGS: readonly Emotion[] = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

/**
 * 真实流缺席时的沉默兜底——一句诚实的"舞台指示"，绝不是伪造的角色台词。
 * 仅在发了 prompt 却整轮没有任何 delta/message（watchdog 超时）时用一次。
 */
const SILENCE_LINE: Record<'en' | 'ja', { text: string; emo: Emotion }> = {
  en: { text: '[emo: sad] (She does not answer right now.)', emo: 'sad' },
  ja: { text: '[emo: sad] （今は、答えが返ってこない。）', emo: 'sad' },
};

/** 服务端 turn 超时 90s（lifecycle） + 5s 余量：watchdog 只作最后兜底。 */
const TURN_WATCHDOG_MS = 95000;

/** 前沿未闭合 `[emo` 前缀的保险阀：超过这么多字符就当成普通正文。 */
const EMO_PREFIX_GUARD = 24;

/** Current on-stage performance: idle → thinking → streaming → done. */
type Phase = 'idle' | 'thinking' | 'streaming' | 'done';

/** Strip a leading "[emo: tag]" (T3.2); returns display text + parsed mood. */
function parseEmoTag(raw: string): { text: string; emo: Emotion } {
  const match = /^\[emo:\s*([a-z]+)\]\s*/.exec(raw);
  if (!match) return { text: raw, emo: 'normal' };
  const tag = match[1] as Emotion;
  return { text: raw.slice(match[0].length), emo: EMO_TAGS.includes(tag) ? tag : 'normal' };
}

/**
 * Fold per-line `[emo:]` tags over a (possibly partial) reply: returns the
 * tag-free display text, the mood of the LAST tagged line, and whether the
 * frontier line is an unterminated tag prefix (frozen, not shown yet).
 *
 * The preset tags every line whose mood differs from the previous one, so a
 * single-line parser would leak `[emo: …]` from line 2 onward.
 */
function parseEmoLines(
  raw: string,
  opts?: { final?: boolean }
): { text: string; emo: Emotion; tailOpen: boolean } {
  const lines = raw.split('\n');
  let emo: Emotion = 'normal';
  let tailOpen = false;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const tagged = /^\[emo:\s*[a-z]+\]/.test(line);
    const parsed = parseEmoTag(line);
    if (tagged) emo = parsed.emo;
    // Freeze an unterminated tag prefix, but only while more chars may arrive.
    // The guard keeps a wild `[emo…` from hanging the paper; plain bracketed
    // prose (`[System] …`) never matches because the prefix must be `[emo`.
    if (
      isLast &&
      !opts?.final &&
      !tagged &&
      /^\[emo[\s:]*[a-z]*$/.test(line) &&
      line.length <= EMO_PREFIX_GUARD
    ) {
      tailOpen = true;
      out.push('');
      continue;
    }
    out.push(parsed.text);
  }
  return { text: out.join('\n'), emo, tailOpen };
}

/** Personality rhythm: 45ms/char, 300ms after a comma, 150ms at sentence end. */
function charDelay(prev: string): number {
  if (prev === ',' || prev === '，') return 300;
  if ('.;!?。！？…'.includes(prev)) return 150;
  return 45;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  characterId,
  avatar = '/assets/characters/portraits/lady_1.png',
  bio,
  onClose,
  onSendMessage,
  locale = 'en',
  incoming = null,
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [emo, setEmo] = useState<Emotion>('normal');
  const [line, setLine] = useState(''); // 去标签后的完整台词（纸面可显示文本）
  const [shown, setShown] = useState(''); // line 的已显示前缀
  const [playerEcho, setPlayerEcho] = useState(''); // last player line, echoed without history
  const [inputText, setInputText] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [closing, setClosing] = useState(false);

  const streamTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  // 流式驱动器的唯一状态（全是 ref：帧回调读 state 会拿到闭包旧值）。
  const lineRef = useRef(''); // 已收到的原始全文（含标签、增量累积）
  const shownRef = useRef(0); // 已显示的字符数（在去标签文本上的唯一游标）
  const streamingRef = useRef(false);
  const messageEndedRef = useRef(false); // 收到过 character_message
  const channelIdleRef = useRef(false); // 收到过 character_idle
  const finalRef = useRef(false); // true → parseEmoLines 不再冻结未闭合前缀
  const phaseRef = useRef<Phase>('idle');
  const phaseBeforeTurnRef = useRef<Phase>('idle');
  const lastEmoRef = useRef<Emotion>('normal');
  const stingerFiredRef = useRef(false); // 当前 mood 是否已响过（防每 delta 重放）
  const turnWatchdog = useRef<number | null>(null);
  const busyRef = useRef(false);
  const consumedFrameRef = useRef<CharacterFrame | null>(null); // StrictMode 重入守卫

  const cancelStreamTimer = useCallback(() => {
    if (streamTimer.current !== null) window.clearTimeout(streamTimer.current);
    streamTimer.current = null;
  }, []);

  const clearWatchdog = useCallback(() => {
    if (turnWatchdog.current !== null) window.clearTimeout(turnWatchdog.current);
    turnWatchdog.current = null;
  }, []);

  /** mood 变化时切立绘；揭幕之后每个新 mood 只响一次 stinger（不碰 BGM 主轨）。 */
  const applyMood = useCallback((mood: Emotion, revealed: boolean) => {
    if (mood === 'thinking') return; // 揭幕期暂态，不发音
    if (mood !== lastEmoRef.current) {
      lastEmoRef.current = mood;
      setEmo(mood);
      stingerFiredRef.current = false; // 新 mood 待（若尚未揭幕）揭幕时一响
    }
    if (revealed && streamingRef.current && !stingerFiredRef.current) {
      stingerFiredRef.current = true;
      // T3.2 — the [emo:] tag does double duty: it swaps the sprite AND fires a
      // short one-shot stinger. It MUST NOT touch the BGM main track (galgame
      // convention: emotion is a transient accent, not a score change); see
      // docs/audio/02 §3.8 and docs/audio/04 §3.2. No-op when the stinger
      // asset is missing (assets/audio/stinger/ is a known gap).
      playStinger(mood);
    }
  }, []);

  /** 缓冲区追平且本 turn 已终结（message 或 idle）→ 收工。 */
  const settleIfDrained = useCallback(() => {
    if (!(messageEndedRef.current || channelIdleRef.current)) return;
    if (streamTimer.current !== null) return; // 还在逐字
    const { text } = parseEmoLines(lineRef.current, { final: true });
    if (shownRef.current < text.length) return; // 前沿未追平
    streamingRef.current = false;
    clearWatchdog();
    setPhase('done');
  }, [clearWatchdog]);

  /** 泵：从 lineRef 重算前沿并逐字推进，直到追平或本 turn 终结。 */
  const pump = useCallback(() => {
    if (streamTimer.current !== null) return; // 已有一步在排程
    const step = () => {
      if (streamTimer.current === null) return; // cancelled/unmounted
      // 每步重算：缓冲在这期间可能又长了（tailOpen 行暂不出屏）。
      const { text, emo: mood } = parseEmoLines(lineRef.current, { final: finalRef.current });
      applyMood(mood, true);
      setLine(text);
      if (shownRef.current >= text.length) {
        streamTimer.current = null;
        settleIfDrained();
        return;
      }
      const prev = text[shownRef.current];
      shownRef.current += 1;
      setShown(text.slice(0, shownRef.current));
      if (shownRef.current >= text.length) {
        streamTimer.current = null;
        settleIfDrained();
        return;
      }
      streamTimer.current = window.setTimeout(step, charDelay(prev));
    };
    const { text } = parseEmoLines(lineRef.current, { final: finalRef.current });
    streamTimer.current = window.setTimeout(step, charDelay(text[shownRef.current] ?? ''));
  }, [applyMood, settleIfDrained]);

  /** 揭幕：清缓冲、进 thinking、起 100–400ms 沉思窗，然后开始泵。 */
  const beginStream = useCallback(() => {
    streamingRef.current = true;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = false;
    stingerFiredRef.current = false;
    lineRef.current = '';
    shownRef.current = 0;
    setLine('');
    setShown('');
    setPhase('thinking');
    setEmo('thinking');
    lastEmoRef.current = 'thinking';
    const thinkMs = 100 + Math.random() * 300; // 100–400ms "陷入沉思"
    streamTimer.current = window.setTimeout(() => {
      streamTimer.current = null;
      setPhase('streaming');
      pump();
    }, thinkMs);
  }, [pump]);

  const armTurnWatchdog = useCallback(() => {
    clearWatchdog();
    turnWatchdog.current = window.setTimeout(() => {
      turnWatchdog.current = null;
      streamingRef.current = false;
      const silence = SILENCE_LINE[locale];
      const { text, emo: mood } = parseEmoLines(silence.text, { final: true });
      lineRef.current = text;
      shownRef.current = text.length;
      setLine(text);
      setShown(text);
      setEmo(mood);
      lastEmoRef.current = mood;
      setPhase('done');
    }, TURN_WATCHDOG_MS);
  }, [clearWatchdog, locale]);

  /** 彻底收尾（卸载 / 切角色）：清所有定时器并复位流状态。 */
  const streamTurn = useCallback(() => {
    cancelStreamTimer();
    clearWatchdog();
    streamingRef.current = false;
  }, [cancelStreamTimer, clearWatchdog]);

  // Close: brief paper-descend + fade (220ms), then unmount.
  const handleClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onClose(), 220);
  }, [onClose]);

  // 挂载时复位（幂等）：不主动说话，第一句台词来自角色的首个 turn。
  useEffect(() => {
    setLine('');
    setShown('');
    setEmo('normal');
    setPhase('idle');
    setPlayerEcho('');
    lineRef.current = '';
    shownRef.current = 0;
    streamingRef.current = false;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = false;
    lastEmoRef.current = 'normal';
    stingerFiredRef.current = false;
    phaseRef.current = 'idle';
    phaseBeforeTurnRef.current = 'idle';
  }, []);

  // 帧消费：App 已按 activeModalCharId 过滤；这里只负责把帧推进缓冲/泵。
  // 所有推进都读 ref → StrictMode 双跑可重入；consumedFrameRef 保证同一帧对象只消费一次。
  useEffect(() => {
    if (closing || !incoming) return;
    if (incoming === consumedFrameRef.current) return;
    consumedFrameRef.current = incoming;

    if (incoming.type === 'character_delta') {
      if (!streamingRef.current) beginStream();
      lineRef.current += incoming.delta;
      pump();
      return;
    }

    if (incoming.type === 'character_message') {
      const lostAll = lineRef.current === '';
      if (!streamingRef.current) beginStream(); // 会复位终结标志，故先建流
      messageEndedRef.current = true;
      finalRef.current = true;
      if (lostAll) {
        // delta 全丢（断线 / 非流式）：直接落定权威文本，不再逐字等待。
        lineRef.current = incoming.text;
        cancelStreamTimer(); // 取消沉思窗——权威文本无需揭幕延迟
        const { text, emo: mood } = parseEmoLines(lineRef.current, { final: true });
        applyMood(mood, false);
        setLine(text);
        shownRef.current = text.length;
        setShown(text);
        settleIfDrained();
      } else {
        if (lineRef.current !== incoming.text) lineRef.current = incoming.text; // 丢帧 → 以权威文本为准
        pump();
        settleIfDrained();
      }
      return;
    }

    if (incoming.type === 'character_idle') {
      channelIdleRef.current = true;
      finalRef.current = true;
      if (lineRef.current === '') {
        // 纯工具轮：整轮无文本 → 归还 phase，纸上内容不动。
        cancelStreamTimer();
        streamingRef.current = false;
        clearWatchdog();
        setPhase(phaseBeforeTurnRef.current);
      } else {
        pump();
        settleIfDrained();
      }
      return;
    }

    // error：服务端已给英文文案，直接显示；复位并解除 busy。
    cancelStreamTimer();
    clearWatchdog();
    streamingRef.current = false;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = true;
    lineRef.current = incoming.message;
    shownRef.current = incoming.message.length;
    setLine(incoming.message);
    setShown(incoming.message);
    setEmo('normal');
    lastEmoRef.current = 'normal';
    setPhase('done');
  }, [incoming, closing, beginStream, pump, settleIfDrained, applyMood, cancelStreamTimer, clearWatchdog]);

  // Unmount: cancel every pending timer.
  useEffect(() => streamTurn, [streamTurn]);

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
    if (!msg || busyRef.current) return; // one performance at a time
    setInputText('');
    setPlayerEcho(msg); // kept on the paper, not a history list
    // 乐观占位：真实首帧要等 agent 启动 + 首个 token，期间不能露出"可再发一条"的窗口。
    phaseBeforeTurnRef.current = phaseRef.current;
    streamingRef.current = false;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = false;
    setPhase('thinking');
    setEmo('thinking');
    lastEmoRef.current = 'thinking';
    stingerFiredRef.current = false;
    onSendMessage?.(msg); // character_prompt protocol — App wires the message type
    armTurnWatchdog();
  };

  const busy = phase === 'thinking' || phase === 'streaming';
  busyRef.current = busy;
  phaseRef.current = phase;
  const showAvatar = !avatarError && !!avatar;
  const monogram = characterId.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`character-modal-layer${closing ? ' modal-closing' : ''}`}
      role="dialog"
      aria-label={locale === 'ja' ? `${characterId}との会話` : `Dialogue with ${characterId}`}
    >
      <button type="button" className="modal-close" onClick={handleClose} aria-label={locale === 'ja' ? '会話を閉じる' : 'Close dialog'}>
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
            <span className="thinking-hint">{locale === 'ja' ? `${characterId}は考えている…` : `${characterId} is thinking…`}</span>
          )}
          {line !== '' && (
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
          placeholder={locale === 'ja' ? `${characterId}に話す…（Enterで送信）` : `Say something to ${characterId}… (Enter to send)`}
          aria-label={`Message to ${characterId}`}
          disabled={busy}
          className="speech-input"
        />
      </div>
    </div>
  );
};
