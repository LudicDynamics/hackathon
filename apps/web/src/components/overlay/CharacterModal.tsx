import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionPortrait } from './MotionPortrait.js';
import { guardImeKey } from '../../lib/ime.js';
import { canRequestTts, invalidateTts, ttsEnabled } from '../../lib/tts-readiness.js';
import { useLocale } from '../../lib/i18n.js';
import { playStinger, playVoice, stopVoice, unlock, type Emotion } from '../../lib/audio.js';
import {
  clampPageIndex,
  charDelay,
  GREETING_LINE,
  parseEmoPages,
  type DialoguePage,
} from './dialogue-pages.js';

/**
 * CharacterModal — galgame dialogue overlay (wave 2 Task D T3.3; TTS pagination T1/03).
 *
 * Full rewrite from the v1 IM/bubble-transcript layout:
 *  - the canvas itself is dimmed + blurred behind a warm-ink tint (no black sheet)
 *  - a bottom-pinned split portrait stage (lit speaker / dimmed counterpart)
 *  - a slightly tilted paper dialog at the bottom: name plate, quadrille
 *    narration line, the current dialogue page, and a bottom input row that
 *    stays hidden until the pages are exhausted.
 *
 * No chat bubbles, no scrollable history, no HUD. The character's reply is
 * paginated one non-empty line per page (contract §6); each page types itself
 * out and speaks its own TTS line; the player clicks the stage to fast-forward
 * or advance, and the input only fades in once the last page has been reached.
 *
 * A3 (docs/wiring/03): the text comes from the real character agent. App routes
 * raw WS frames to this modal via the `incoming` prop. T1 (docs/tts/00): the
 * page split, per-page voice, click/keyboard advance and the mock greeting are
 * frozen in `docs/tts/00`; the pure helpers live in `./dialogue-pages.js`.
 */

interface CharacterModalProps {
  characterId: string;
  displayName?: string;
  avatarVideo?: string;
  effectsEnabled?: boolean;
  avatar?: string;
  bio?: string;
  onClose: () => void;
  onOpenNook?: () => void;
  /** character_prompt protocol — the app wraps this in the message type; unchanged. */
  onSendMessage?: (msg: string) => void;
  locale?: 'en' | 'ja';
  /** 最近一条属于本角色的真实帧；App 已按 activeModalCharId 过滤。null = 无。 */
  incoming?: CharacterFrame | null;
  /** NEW: current world manifest.id — the `airp:greeted:<worldId>:<charId>` key segment. */
  worldId?: string;
  /** NEW: the character's DashScope voice (README frontmatter `voice`, via /api/characters). undefined → server default. */
  voice?: string;
  /** NEW: TTS request-body `language` — the world content language. Defaults to 'en'. */
  language?: string;
  /**
   * NEW: per-emotion portrait URLs (docs/assets/00 §5.2). Present only when the
   * world ships all six; when set, the stage shows the matching still per
   * `[emo: tag]` instead of the single MotionPortrait clip.
   */
  emotions?: Record<string, string>;
}

/** Raw character-lane frame as forwarded by useWorld (`detail: msg` verbatim). */
export type CharacterFrame =
  | { type: 'character_delta'; characterId?: string; delta: string; timestamp?: string }
  | { type: 'character_message'; characterId?: string; text: string; timestamp?: string }
  | { type: 'character_idle'; characterId?: string; timestamp?: string }
  | { type: 'error'; source?: string; characterId?: string; message: string; timestamp?: string };

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

/** Current on-stage performance: idle → thinking → streaming → done. */
type Phase = 'idle' | 'thinking' | 'streaming' | 'done';

/** Per-page TTS request lifecycle (contract §6.5 / §15.15 — `ready` is the
 *  observable proxy for "this page actually spoke"). */
type VoiceState = 'idle' | 'pending' | 'ready' | 'failed';

/** A dialogue page (contract §6.1) plus its voice request state. */
type StagePage = DialoguePage & { voiceUrl?: string; voiceState: VoiceState };


/** Grace window while a page's voice prefetch is still in flight, before the
 *  fallback stinger fires (contract §6.5; value is an inferred initial). */
const STINGER_VOICE_GRACE_MS = 1200;

export const CharacterModal: React.FC<CharacterModalProps> = ({
  characterId,
  displayName,
  avatarVideo,
  effectsEnabled = false,
  avatar,
  bio,
  onClose,
  onOpenNook,
  onSendMessage,
  locale = 'en',
  incoming: suppliedFrame = null,
  worldId,
  voice,
  language = 'en',
  emotions,
}) => {
  const { locale: uiLocale, t } = useLocale();
  locale = uiLocale === 'ja' ? 'ja' : locale;
  const [receivedFrame, setReceivedFrame] = useState<CharacterFrame | null>(null);
  const incoming = suppliedFrame ?? receivedFrame;
  useEffect(() => {
    const receive = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame.characterId !== characterId) return;
      if (['character_delta', 'character_message', 'character_idle'].includes(frame.type)) setReceivedFrame(frame);
      if (['error', 'turn_aborted'].includes(frame.type)) setReceivedFrame({ ...frame, type: 'error' });
    };
    window.addEventListener('airp:agent-frame', receive);
    return () => window.removeEventListener('airp:agent-frame', receive);
  }, [characterId]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [emo, setEmo] = useState<Emotion>('normal');
  const [pages, setPages] = useState<DialoguePage[]>([]); // read-only projection of pagesRef
  const [pageIndex, setPageIndex] = useState(0); // render mirror of pageIndexRef
  const [pageShown, setPageShown] = useState(''); // prefix of the CURRENT page shown so far
  const [playerEcho, setPlayerEcho] = useState(''); // last player line, echoed without history
  const [inputText, setInputText] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [closing, setClosing] = useState(false);

  const streamTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 流式驱动器的唯一状态（全是 ref：帧回调读 state 会拿到闭包旧值）。
  const lineRef = useRef(''); // 已收到的原始全文（含标签、增量累积）
  const pagesRef = useRef<StagePage[]>([]); // 页数组（命令式真相源）
  const pageIndexRef = useRef(0); // 当前页下标，恒在 [0, max(0,len-1)]
  const pageShownRef = useRef(0); // 页内已显示字符数（取代旧的全局游标 shownRef）
  const voiceTurnRef = useRef(0); // turn 令牌：fetch 回来令牌变了就丢弃
  const mockRef = useRef(false); // 当前纸上是否为 mock 引导语页
  const mockSeededRef = useRef(false); // StrictMode 单实例只 seed 一次
  const stingerGraceRef = useRef<number | null>(null); // pending 语音的 stinger 宽限定时器
  const streamingRef = useRef(false);
  const messageEndedRef = useRef(false); // 收到过 character_message
  const channelIdleRef = useRef(false); // 收到过 character_idle
  const finalRef = useRef(false); // true → 末行可封口
  const phaseRef = useRef<Phase>('idle');
  const phaseBeforeTurnRef = useRef<Phase>('idle');
  const lastEmoRef = useRef<Emotion>('normal');
  const stingerFiredRef = useRef(false); // 当前页情绪音是否已了结（由语音取代或已响）
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

  const clearStingerGrace = useCallback(() => {
    if (stingerGraceRef.current !== null) window.clearTimeout(stingerGraceRef.current);
    stingerGraceRef.current = null;
  }, []);

  /** mood 变化时切立绘。stinger 不再由这里决定——它归 enterPage /
   *  onVoiceResolved / armStingerGrace 唯一裁定（contract §6.5）。 */
  const applyMood = useCallback((mood: Emotion) => {
    if (mood === 'thinking') return; // 揭幕期暂态，不发音、不换立绘
    if (mood !== lastEmoRef.current) {
      lastEmoRef.current = mood;
      setEmo(mood);
    }
  }, []);

  /** 末页封口 + 追平 + turn 终结 → 收工（contract §6.6。`pageIndex === last`
   *  是「页翻尽才放输入框」的机械落点）。 */
  const settleIfDrained = useCallback(() => {
    if (!(messageEndedRef.current || channelIdleRef.current)) return;
    if (streamTimer.current !== null) return; // 还在逐字
    const last = pagesRef.current.length - 1;
    const drained =
      last >= 0 &&
      pageIndexRef.current === last &&
      pagesRef.current[last].sealed &&
      pageShownRef.current >= pagesRef.current[last].text.length;
    if (!drained) return;
    streamingRef.current = false;
    clearWatchdog();
    setPhase('done');
  }, [clearWatchdog]);

  /** 泵：只读当前页，页内逐字推进（contract §6.3）。页数组由 syncPages 维护。 */
  const pump = useCallback(() => {
    if (streamTimer.current !== null) return; // 已有一步在排程
    const step = () => {
      if (streamTimer.current === null) return; // cancelled/unmounted
      const page = pagesRef.current[pageIndexRef.current];
      if (!page) {
        streamTimer.current = null;
        settleIfDrained();
        return;
      }
      applyMood(page.emo);
      if (pageShownRef.current >= page.text.length) {
        streamTimer.current = null;
        settleIfDrained();
        return;
      }
      const prev = page.text[pageShownRef.current];
      pageShownRef.current += 1;
      setPageShown(page.text.slice(0, pageShownRef.current));
      if (pageShownRef.current >= page.text.length) {
        streamTimer.current = null;
        settleIfDrained();
        return;
      }
      streamTimer.current = window.setTimeout(step, charDelay(prev)); // 韵律表原样复用
    };
    streamTimer.current = window.setTimeout(step, charDelay(''));
  }, [applyMood, settleIfDrained]);

  /** 语音结果落定：若正是当前页 → 播语音（有语音不响 stinger）；否则只预热。 */
  const onVoiceResolved = useCallback(
    (page: StagePage, i: number) => {
      if (pageIndexRef.current !== i) return; // 玩家已翻走 → 只预热，不播
      clearStingerGrace();
      if (page.voiceState === 'ready' && page.voiceUrl) {
        stopVoice();
        playVoice(page.voiceUrl); // 有语音 → 不响 stinger
        stingerFiredRef.current = true;
      } else if (!stingerFiredRef.current) {
        // 无语音（failed）→ 保留 stinger 作为情绪提示；mock 页不响
        stingerFiredRef.current = true;
        if (page.emo !== 'thinking' && !mockRef.current) playStinger(page.emo);
      }
    },
    [clearStingerGrace]
  );

  /** 页封口即预取（contract §6.5）：同页只发一次（voiceState 门）。
   *  ⚠️ 门禁硬约束：`fetch('/api/tts'` 与 route 同行、body 为内联对象字面量、
   *  键集恰为 text / voice / language（tools/check-request-bodies.mjs）。 */
  const prefetchVoice = useCallback(
    async (page: StagePage, i: number): Promise<void> => {
      if (page.voiceState !== 'idle') return; // 已 pending/ready/failed → 不重发
      if (page.text.trim() === '') return; // 空页不发（服务端 400）
      page.voiceState = 'pending';
      const token = voiceTurnRef.current;
      try {
        const ready = await canRequestTts();
        if (token !== voiceTurnRef.current) return;
        if (!ready || !ttsEnabled()) { page.voiceState = 'failed'; onVoiceResolved(page, i); return; }
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: page.text, voice, language }),
        });
        if (token !== voiceTurnRef.current) return; // 已换轮 → 丢弃结果（不写、不播）
        const data = (await res.json()) as { ok?: boolean; url?: string; code?: string };
        if (!res.ok || !data.ok || typeof data.url !== 'string' || data.url === '') {
          page.voiceState = 'failed';
          invalidateTts(data.code === 'tts_unconfigured');
          onVoiceResolved(page, i);
          return;
        }
        page.voiceUrl = data.url;
        page.voiceState = 'ready';
        onVoiceResolved(page, i); // 若正是当前页 → playVoice（truncated 不重试）
      } catch {
        if (token !== voiceTurnRef.current) return;
        invalidateTts();
        page.voiceState = 'failed';
        onVoiceResolved(page, i);
      }
    },
    [voice, language, onVoiceResolved]
  );

  /** 语音在途 → 挂起 stinger，到点仍 pending 则响（contract §5.4）。 */
  const armStingerGrace = useCallback(
    (page: StagePage, i: number) => {
      clearStingerGrace();
      stingerGraceRef.current = window.setTimeout(() => {
        stingerGraceRef.current = null;
        if (pageIndexRef.current !== i || stingerFiredRef.current) return; // 已翻走或已了结
        stingerFiredRef.current = true;
        if (!mockRef.current && page.emo !== 'thinking') playStinger(page.emo);
      }, STINGER_VOICE_GRACE_MS);
    },
    [clearStingerGrace]
  );

  /** 「一页成为当前页」的唯一动作点（contract §3.2）：翻页先打断上一句，
   *  再按该页语音状态发声，最后起逐字泵。 */
  const enterPage = useCallback(
    (i: number, opts: { announce: boolean }) => {
      const idx = clampPageIndex(i, pagesRef.current.length);
      pageIndexRef.current = idx;
      setPageIndex(idx);
      pageShownRef.current = 0;
      setPageShown('');
      const page = pagesRef.current[idx];
      stopVoice(); // 翻页先打断上一句（contract §6.5）
      if (!page) return;
      applyMood(page.emo);
      if (opts.announce) {
        if (page.voiceState === 'ready' && page.voiceUrl) {
          // 就绪 → 播语音、抑制 stinger。真实页与 mock 页走同一分支（§15.18）
          playVoice(page.voiceUrl);
          stingerFiredRef.current = true;
        } else if (page.voiceState === 'pending') {
          armStingerGrace(page, idx); // 在途 → 挂起；mock 页不因 mockRef 被排除
        } else if (!stingerFiredRef.current && page.emo !== 'thinking' && !mockRef.current) {
          // idle / failed 且非 mock 页 → 保留 stinger（§7.3：mock 页不响情绪音）
          stingerFiredRef.current = true;
          playStinger(page.emo);
        }
      }
      pump();
    },
    [applyMood, armStingerGrace, pump]
  );

  /** 分页与封口（唯一入口）：每次 lineRef 变化都调它。 */
  const syncPages = useCallback(
    (raw: string, opts: { final?: boolean; reset?: boolean }) => {
      const next = parseEmoPages(raw, { final: opts.final ?? false }).pages;
      if (opts.reset) {
        pagesRef.current = [];
        pageIndexRef.current = 0;
        pageShownRef.current = 0;
      }
      const list = pagesRef.current;
      const hadPages = list.length > 0; // capture before mutation: announce only on empty→non-empty
      if (list.length > next.length) list.length = next.length; // 权威文本可能让页数变少
      for (let i = 0; i < next.length; i++) {
        const np = next[i];
        const prev = list[i];
        if (!prev) {
          const fresh: StagePage = { text: np.text, emo: np.emo, sealed: np.sealed, voiceState: 'idle' };
          list.push(fresh);
          if (fresh.sealed) void prefetchVoice(fresh, i); // 页封口即预取
          continue;
        }
        if (np.text !== prev.text) {
          prev.text = np.text;
          prev.emo = np.emo;
          if (prev.sealed) {
            // 权威文本覆盖了已封口行（唯一允许路径，§3.5）→ 重取 TTS
            prev.voiceUrl = undefined;
            prev.voiceState = 'idle';
            void prefetchVoice(prev, i);
            if (pageIndexRef.current === i) enterPage(i, { announce: false }); // 重驱当前页
          }
        }
        if (prev.sealed !== np.sealed) {
          prev.sealed = np.sealed;
          if (np.sealed && prev.voiceState === 'idle') void prefetchVoice(prev, i);
        }
      }
      const snapshot: DialoguePage[] = list.map((p) => ({ text: p.text, emo: p.emo, sealed: p.sealed }));
      setPages(snapshot);
      // 页从空变非空且本 turn 在演 → 落在第 0 页（reset 路径自带显式 enterPage）。
      // 只在真正的「空→非空」跃迁时 announce，避免 delta 连发时重复 stopVoice/重播。
      if (!opts.reset && !hadPages && list.length > 0 && streamingRef.current) {
        enterPage(0, { announce: true });
      }
    },
    [enterPage, prefetchVoice]
  );

  /** 揭幕：清缓冲、进 thinking、起 100–400ms 沉思窗，然后开始泵。 */
  const beginStream = useCallback(() => {
    streamingRef.current = true;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = false;
    stingerFiredRef.current = false;
    lineRef.current = '';
    pageShownRef.current = 0;
    voiceTurnRef.current += 1; // 新 turn：作废在途的语音结果
    setPageShown('');
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

  /** 点击/空格推进（contract §6.4）：未出完 → 快进；已完整 → 下一页；末页 → 钳制。 */
  const advance = useCallback(() => {
    if (closing || phaseRef.current === 'thinking') return; // 沉思期无页可推
    const page = pagesRef.current[pageIndexRef.current];
    if (!page) return;
    if (pageShownRef.current < page.text.length) {
      cancelStreamTimer();
      pageShownRef.current = page.text.length;
      setPageShown(page.text);
      settleIfDrained();
      return;
    }
    if (pageIndexRef.current < pagesRef.current.length - 1) {
      enterPage(pageIndexRef.current + 1, { announce: true });
    }
    // 末页且完整 → 不推进（等待玩家输入）
  }, [closing, enterPage, settleIfDrained, cancelStreamTimer]);

  const armTurnWatchdog = useCallback(() => {
    clearWatchdog();
    turnWatchdog.current = window.setTimeout(() => {
      turnWatchdog.current = null;
      const silence = SILENCE_LINE[language === 'ja' ? 'ja' : 'en'];
      lineRef.current = silence.text;
      streamingRef.current = false;
      syncPages(silence.text, { final: true, reset: true });
      enterPage(0, { announce: false });
      const page = pagesRef.current[0];
      if (page) {
        cancelStreamTimer(); // 舞台指示一次落定，不逐字
        pageShownRef.current = page.text.length;
        setPageShown(page.text);
      }
      lastEmoRef.current = silence.emo;
      setEmo(silence.emo);
      setPhase('done');
    }, TURN_WATCHDOG_MS);
  }, [clearWatchdog, language, syncPages, enterPage, cancelStreamTimer]);

  /** 彻底收尾（卸载 / 切角色）：清所有定时器并复位流状态。 */
  const streamTurn = useCallback(() => {
    cancelStreamTimer();
    clearWatchdog();
    clearStingerGrace();
    voiceTurnRef.current += 1; // 作废在途 fetch
    stopVoice();
    streamingRef.current = false;
  }, [cancelStreamTimer, clearWatchdog, clearStingerGrace]);

  /** Widget-free audio: opening the overlay does not go through Canvas, so the
   *  first pointerdown inside the modal also unlocks the AudioContext. */
  const handleUnlock = useCallback(() => {
    void unlock();
  }, []);

  // Close: brief paper-descend + fade (220ms), then unmount.
  const handleClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onClose(), 220);
  }, [onClose]);

  // 挂载时复位（幂等）+ seed mock 引导语（contract §6.1 / §7）。
  useEffect(() => {
    if (mockSeededRef.current) {
      // StrictMode remount: the unmount cleanup just cancelled the greeting's
      // timers and invalidated its voice fetch. Re-arm it (nothing else to do)
      // so the opening page still types out and speaks.
      if (!mockRef.current || pagesRef.current.length === 0) return;
      for (const p of pagesRef.current) {
        p.voiceState = 'idle';
        p.voiceUrl = undefined;
      }
      streamingRef.current = true;
      messageEndedRef.current = true;
      setPhase('streaming');
      void prefetchVoice(pagesRef.current[0], 0);
      enterPage(0, { announce: true });
      return;
    }
    mockSeededRef.current = true;
    setEmo('normal');
    setPhase('idle');
    setPlayerEcho('');
    lineRef.current = '';
    pagesRef.current = [];
    pageIndexRef.current = 0;
    pageShownRef.current = 0;
    setPages([]);
    setPageIndex(0);
    setPageShown('');
    streamingRef.current = false;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = false;
    lastEmoRef.current = 'normal';
    stingerFiredRef.current = false;
    phaseRef.current = 'idle';
    phaseBeforeTurnRef.current = 'idle';

    const contentLanguage = language === 'ja' ? 'ja' : 'en';
    const key = worldId === undefined ? null : `airp:greeted:v2:${worldId}:${characterId}:${contentLanguage}`;
    let greeted: string | null = null;
    if (key !== null) {
      try {
        greeted = localStorage.getItem(key);
      } catch {
        /* private mode → always show (degrade) */
      }
    }
    if (greeted !== null) return;

    const g = GREETING_LINE[contentLanguage];
    const mockPage: StagePage = { text: g.text, emo: g.emo, sealed: true, voiceState: 'idle' };
    pagesRef.current = [mockPage];
    mockRef.current = true;
    setPages([{ text: mockPage.text, emo: mockPage.emo, sealed: mockPage.sealed }]);
    if (key !== null) {
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    }
    // Treat the greeting as a completed single-page turn: it types itself out
    // with the input hidden and the ▼ hint showing, then reveals the input —
    // exactly like a real page, so the opening never looks like a chatbox.
    streamingRef.current = true;
    messageEndedRef.current = true;
    setPhase('streaming');
    void prefetchVoice(mockPage, 0); // §15.18 B1：mock 页必须走同一语音路径
    enterPage(0, { announce: true }); // 逐字 + 朗读，不响 stinger
  }, [characterId, language, worldId, prefetchVoice, enterPage]);

  // 帧消费：App 已按 activeModalCharId 过滤；所有推进读 ref，consumedFrameRef
  // 保证同一帧对象只消费一次（StrictMode 双跑可重入）。
  useEffect(() => {
    if (closing || !incoming) return;
    if (incoming === consumedFrameRef.current) return;
    consumedFrameRef.current = incoming;

    /** 真实帧到达 → mock 引导语整块退场（不是插在真页前面，contract §7.2）。 */
    const dropMock = () => {
      if (!mockRef.current) return;
      mockRef.current = false;
      cancelStreamTimer(); // the greeting's typewriter timer
      pagesRef.current = [];
      pageIndexRef.current = 0;
      pageShownRef.current = 0;
      voiceTurnRef.current += 1; // mock 页的预取结果作废
      // The greeting was seeded as a closed turn; re-open it so the real
      // frame path re-enters beginStream() instead of inheriting mock state.
      streamingRef.current = false;
      messageEndedRef.current = false;
      channelIdleRef.current = false;
      finalRef.current = false;
      setPages([]);
      setPageIndex(0);
      setPageShown('');
      clearStingerGrace();
    };

    if (incoming.type === 'character_delta') {
      dropMock();
      if (!streamingRef.current) beginStream();
      lineRef.current += incoming.delta;
      syncPages(lineRef.current, { final: false });
      pump();
      return;
    }

    if (incoming.type === 'character_message') {
      dropMock();
      const lostAll = lineRef.current === '';
      if (!streamingRef.current) beginStream(); // 会复位终结标志，故先建流
      messageEndedRef.current = true;
      finalRef.current = true;
      if (lostAll) {
        // delta 全丢（断线 / 非流式）：直接落定权威文本。
        lineRef.current = incoming.text;
        cancelStreamTimer(); // 取消沉思窗——权威文本无需揭幕延迟
        streamingRef.current = true;
        syncPages(lineRef.current, { final: true, reset: true });
        enterPage(0, { announce: false });
        settleIfDrained();
      } else {
        if (lineRef.current !== incoming.text) lineRef.current = incoming.text; // 丢帧 → 以权威文本为准
        syncPages(lineRef.current, { final: true });
        pump();
        settleIfDrained();
      }
      return;
    }

    if (incoming.type === 'character_idle') {
      channelIdleRef.current = true;
      finalRef.current = true;
      if (lineRef.current === '') {
        // 纯工具轮：整轮无文本 → 归还 phase，纸上页数组不动（保留刚说完的页）。
        cancelStreamTimer();
        streamingRef.current = false;
        clearWatchdog();
        setPhase(phaseBeforeTurnRef.current);
      } else {
        syncPages(lineRef.current, { final: true });
        pump();
        settleIfDrained();
      }
      return;
    }

    // error：服务端已给英文文案，一次落定；复位并解除 busy。
    dropMock();
    cancelStreamTimer();
    clearWatchdog();
    streamingRef.current = false;
    messageEndedRef.current = false;
    channelIdleRef.current = false;
    finalRef.current = true;
    lineRef.current = incoming.message;
    syncPages(incoming.message, { final: true, reset: true });
    enterPage(0, { announce: false });
    const errPage = pagesRef.current[0];
    if (errPage) {
      pageShownRef.current = errPage.text.length; // 错误文案不该被逐字演出
      setPageShown(errPage.text);
    }
    setEmo('normal');
    lastEmoRef.current = 'normal';
    setPhase('done');
  }, [incoming, closing, beginStream, pump, syncPages, enterPage, settleIfDrained, cancelStreamTimer, clearWatchdog, clearStingerGrace]);

  // Unmount: cancel every pending timer + stop the voice channel.
  useEffect(() => streamTurn, [streamTurn]);

  // Esc closes the overlay (kept from v1); Space advances (Enter stays for send).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (e.target instanceof HTMLInputElement) return; // never steal typing
      if (document.activeElement === inputRef.current) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, advance]);

  // Reset the monogram fallback if the avatar path changes.
  useEffect(() => setAvatarError(false), [avatar, emo]);

  // Focus the input only once it is actually revealed (it is hidden before that).
  const busy = phase === 'thinking' || phase === 'streaming' || (pages.length > 0 && pageIndex < pages.length - 1);
  const inputReady = !busy;
  useEffect(() => {
    if (inputReady) inputRef.current?.focus();
  }, [inputReady]);

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
    // 清页队列（contract §6.6）：否则新回复的页接在旧页后面。
    voiceTurnRef.current += 1;
    pagesRef.current = [];
    pageIndexRef.current = 0;
    pageShownRef.current = 0;
    setPages([]);
    setPageIndex(0);
    setPageShown('');
    clearStingerGrace();
    stopVoice();
    setPhase('thinking');
    setEmo('thinking');
    lastEmoRef.current = 'thinking';
    stingerFiredRef.current = false;
    onSendMessage?.(msg); // character_prompt protocol — App wires the message type
    armTurnWatchdog();
  };

  busyRef.current = busy;
  phaseRef.current = phase;
  const showAvatar = !avatarError && !!avatar;
  const monogram = characterId.trim().charAt(0).toUpperCase() || '?';
  // The still for the current mood, when the world ships the six-emotion set.
  // Undefined keeps the legacy single-portrait path, so nothing changes for
  // worlds without differentials.
  const emotionStill = emotions?.[emo];
  const currentPage = pages[pageIndex];
  // ▼ 提示仅在「有页可推、非沉思、且还没到该玩家输入」时出现（contract §16.2）。
  const canAdvance = phase !== 'thinking' && pages.length > 0 && !inputReady;

  return (
    <div
      className={`character-modal-layer${closing ? ' modal-closing' : ''}`}
      role="dialog"
      aria-label={locale === 'ja' ? `${characterId}との会話` : `Dialogue with ${characterId}`}
      onPointerDown={handleUnlock}
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
              {/* Six-emotion world (docs/assets/00 §5.2): the still for the
                  current `[emo: tag]` wins over the single clip, so the face
                  actually changes. A missing/failed still falls through to
                  MotionPortrait, never a blank stage. */}
              {emotionStill && !avatarError ? (
                <img
                  className="portrait-still"
                  src={emotionStill}
                  alt={displayName || characterId}
                  onError={() => setAvatarError(true)}
                />
              ) : showAvatar ? (
                <MotionPortrait video={avatarVideo} poster={avatar} enabled={effectsEnabled} name={displayName || characterId} onPosterError={() => setAvatarError(true)} />
              ) : (
                <div className="portrait-fallback" role="img" aria-label={`${characterId} portrait`}>
                  {monogram}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tilted paper dialog: name plate, narration, the current page, input. */}
      <div className={`speech-paper${closing ? ' speech-paper-closing' : ''}`}>
        <div className="name-plate">{displayName || characterId}</div>
        {onOpenNook && <button type="button" onClick={onOpenNook}>{t('Visit private space')}</button>}
        <p className="narr-line">{bio ? bio : '(necessary description)'}</p>

        <div
          className={`line-stage${canAdvance ? ' is-advanceable' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={locale === 'ja' ? '続ける' : 'Continue'}
          onClick={advance}
        >
          {playerEcho && <span className="player-echo">“{playerEcho}”</span>}
          {phase === 'thinking' && (
            <span className="thinking-hint">{locale === 'ja' ? `${characterId}は考えている…` : `${characterId} is thinking…`}</span>
          )}
          {currentPage && currentPage.text !== '' && (
            <span className="speech-line">
              {pageShown}
              {phase === 'streaming' && pageShown.length < currentPage.text.length && (
                <span className="type-caret" aria-hidden="true" />
              )}
            </span>
          )}
        </div>

        <span className={`advance-indicator${canAdvance ? '' : ' is-hidden'}`} aria-hidden="true">
          ▼
        </span>

        <div className={`speech-input-row${inputReady ? ' is-ready' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (guardImeKey(e)) return;
              if (e.key === 'Enter') handleSend();
            }}
            placeholder={locale === 'ja' ? `${characterId}に話す…（Enterで送信）` : `Say something to ${characterId}… (Enter to send)`}
            aria-label={`Message to ${characterId}`}
            disabled={busy}
            className="speech-input"
          />
        </div>
      </div>
    </div>
  );
};
