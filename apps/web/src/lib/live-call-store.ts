/**
 * live-call-store.ts — the module-level owner of the one realtime call
 * (docs/live-voice/10 §2.2, docs/live-voice/11 §2–§4).
 *
 * The nook projection and the character dialogue are two doors onto the same
 * call. Ownership cannot live in a component: two components would each keep
 * their own `useRef` resources and their own idea of "is a call up". So the
 * state machine, the WebRTC resources, the frame listener and the throttled
 * snapshots live here, and `live-call.ts` is a zero-side-effect React binding.
 *
 * Hard rules this file keeps (docs/live-voice/10 §8):
 *   - At most ONE call, cross-character (§2.1). `start()` adopts a call for the
 *     same character and closes a different one first (§2.2 freeze 1).
 *   - `stop(owner)` is a lifecycle guard: it does nothing for a non-matching
 *     owner, so unmounting one entry never kills another entry's call (§5.1).
 *   - The store NEVER opens a WebSocket or invents a frame name (§2.3): it
 *     listens to the `airp:character-frame` relay `useWorld` already dispatches.
 *   - `getSnapshot()` / `getLines()` are pure reads returning a reference that
 *     only changes when the content really changed — what
 *     `useSyncExternalStore`'s `Object.is` check needs, and what keeps the
 *     250ms tick from re-rendering an idle rail (same discipline as
 *     `agent-activity-store.ts`).
 *   - No React import: the binding is a separate export (§2.2 freeze 3).
 */

import { AirpRequestError } from './airp-gateway.js';
import { isCharacterFrame } from './character-frame-queue.js';
import { UI_COPY, type Locale } from './legacy-ui-copy.js';

/** The global snapshot. Idle means `characterId === null` and `phase === 'idle'`. */
export interface LiveCallState {
  phase: 'idle' | 'connecting' | 'live' | 'error';
  /** Human-readable, mapped from the server `code` (`errorText`). */
  error?: string;
  /** The character on the call; null when there is none. */
  characterId: string | null;
  /** The entry that opened the call (`nook:<id>` / `dialogue:<id>`). */
  owner: string | null;
  inputText: string;
  outputText: string;
}

/** The character's real lines — a projection of the existing frames. */
export interface LiveCallLines {
  streaming: string;
  lines: string[];
}

export interface StartCallOptions {
  characterId: string;
  locale: 'en' | 'ja';
  /** Origin entry; `stop(owner)` only hangs up when it matches. */
  owner: string;
}

export interface LiveCallStore {
  subscribe(listener: () => void): () => void;
  /** Reference-stable: the same object until the content changes. */
  getSnapshot(): LiveCallState;
  /** Reference-stable: same rule as `getSnapshot`. */
  getLines(): LiveCallLines;
  /** Readiness gate (`GET /api/live/config`). False until that resolves. */
  isAvailable(): boolean;
  /** Idempotent readiness probe; triggered on first subscription. */
  ensureConfig(): void;
  /** MUST run inside a user action (getUserMedia). Closes any other call first. */
  start(opts: StartCallOptions): Promise<void>;
  /**
   * Hang up. Idempotent.
   * - no `owner`: close whatever is up (explicit user hangup).
   * - with `owner`: only when it matches, otherwise nothing happens (no error,
   *   no request) — docs/live-voice/10 §5.1.
   */
  stop(owner?: string): Promise<void>;
  /** World gone: local self-clear, NO network request (§3.5). */
  clearAll(reason: 'world-unavailable'): void;
  /** Lazy clock (`TICK_MS`); production arms a timer, tests call it directly. */
  tick(now?: number): void;
}

/** Test seam (mirrors `createAgentActivityStore`). Every field is optional. */
export interface LiveCallDeps {
  now?: () => number;
  fetch?: typeof fetch;
  createPeerConnection?: () => RTCPeerConnection;
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  createAudio?: () => HTMLAudioElement;
  /** Event bus; defaults to `window`. Tests inject an in-memory one. */
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

interface LiveConfig {
  ok: boolean;
  available: boolean;
  reason?: string;
  model: string;
  voices: string[];
}

interface LiveSessionResponse {
  ok: boolean;
  sessionId: string;
  sdp: string;
  character: string;
  voice: string;
}

/** How long to wait for ICE gathering before sending the offer as-is. */
const ICE_GATHERING_TIMEOUT_MS = 10_000;
/** How long to wait for the data channel's `session.started` after the answer. */
const SESSION_START_TIMEOUT_MS = 20_000;
/** Hangup wait for `session.closed` before we close the peer locally anyway. */
const SESSION_CLOSE_TIMEOUT_MS = 15_000;
/** Subtitle commit cadence (docs/live-voice/10 §2.3, same precedent as the rail). */
const TICK_MS = 250;

/** Server `code` → the copy key that names the human-readable reason. */
const ERROR_COPY_KEYS: Record<string, keyof (typeof UI_COPY)['en']> = {
  unsupported: 'liveErrorUnconfigured',
  no_active_world: 'liveErrorWorld',
  not_found: 'liveErrorCharacter',
  invalid_argument: 'liveErrorRequest',
  forbidden: 'liveErrorVoice',
  invalid_offer: 'liveErrorOffer',
  internal: 'liveErrorGeneric',
};

/** A client-side failure that never reached the server, so it has no HTTP code. */
class LiveClientError extends Error {
  readonly code: 'mic_denied' | 'mic_unsupported' | 'connection' | 'unavailable';
  constructor(code: 'mic_denied' | 'mic_unsupported' | 'connection' | 'unavailable') {
    super(code);
    this.name = 'LiveClientError';
    this.code = code;
  }
}

/** One-shot gate for the two data-channel handshakes. */
interface Gate<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function makeGate<T>(): Gate<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** No-op bus so the store can be imported where there is no DOM (tests, SSR). */
const NOOP_EVENTS: Pick<Window, 'addEventListener' | 'removeEventListener'> = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

/** Module constants, reused so "no call" never allocates a fresh object. */
const IDLE: LiveCallState = {
  phase: 'idle',
  characterId: null,
  owner: null,
  inputText: '',
  outputText: '',
};
const EMPTY_LINES: LiveCallLines = { streaming: '', lines: [] };

/**
 * Read a `/api/live/*` JSON response while preserving the gateway's
 * cross-cutting 409 handling: a `no_active_world` answer means the world
 * vanished under the app, and the existing `airp:world-unavailable` forward
 * must still run (the store is itself a subscriber of that event, §3.5).
 */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const code = typeof payload?.code === 'string' ? payload.code : null;
    if (code === 'no_active_world' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('airp:world-unavailable'));
    }
    throw new AirpRequestError(String(response.status), response.status, payload);
  }
  return (payload ?? {}) as T;
}

/**
 * Wait until ICE gathering finishes so the offer carries its candidates in one
 * shot: we have no trickle channel, the SDP travels over a single HTTP POST.
 * The timeout is a ceiling, not a promise — on expiry we send what we have and
 * let the server's `invalid_offer` be the visible verdict.
 */
function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.removeEventListener('icecandidate', onCandidate);
      resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
  });
}

/** Resolve when `promise` settles OR after `ms`, whichever comes first. It
 * NEVER rejects: this is the best-effort `session.closed` wait on hangup, where
 * a dead channel must not stall cleanup. */
function waitOrTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/** Resolve to `true` when `promise` settles first, `false` on timeout. Never
 * rejects — used to gate `phase:'live'` on `session.started`. */
function waitForSignalOrTimeout(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/** Map any failure to the copy the player reads. Never a raw status or code. */
function errorText(error: unknown, locale: Locale): string {
  const copy = UI_COPY[locale];
  if (error instanceof LiveClientError) {
    if (error.code === 'mic_denied') return copy.liveErrorMicDenied;
    if (error.code === 'mic_unsupported') return copy.liveErrorMicUnsupported;
    if (error.code === 'unavailable') return copy.liveErrorUnconfigured;
    return copy.liveErrorConnection;
  }
  if (error instanceof AirpRequestError) {
    const code = typeof error.payload?.code === 'string' ? error.payload.code : null;
    const key = code ? ERROR_COPY_KEYS[code] : undefined;
    return key ? copy[key] : copy.liveErrorGeneric;
  }
  return copy.liveErrorGeneric;
}

/** Shallow equality over the six frozen fields — the "really changed" test. */
function isSameState(a: LiveCallState, b: LiveCallState): boolean {
  return (
    a.phase === b.phase &&
    a.error === b.error &&
    a.characterId === b.characterId &&
    a.owner === b.owner &&
    a.inputText === b.inputText &&
    a.outputText === b.outputText
  );
}

export function createLiveCallStore(deps: LiveCallDeps = {}): LiveCallStore {
  const now = deps.now ?? (() => Date.now());
  // Named `fetch` on purpose: `tools/check-request-bodies.mjs` pins each body by
  // finding `fetch('<route>', …)` in the file named by its `BODIES.file`.
  const fetch: typeof globalThis.fetch = deps.fetch ?? globalThis.fetch?.bind(globalThis);
  const events = deps.events ?? (typeof window !== 'undefined' ? window : NOOP_EVENTS);
  const openPeer = deps.createPeerConnection ?? (() => new RTCPeerConnection());
  const openAudio = deps.createAudio ?? (() => new Audio());

  const listeners = new Set<() => void>();

  // The immutable snapshot. `committed` is only ever replaced whole; the
  // `pending*` buffers are what a tick folds into it (§4.2).
  let committed: LiveCallState = IDLE;
  let committedLines: LiveCallLines = EMPTY_LINES;
  let pendingInput = '';
  let pendingOutput = '';
  let pendingStreaming = '';
  let pendingLines: string[] = [];
  let linesDirty = false;

  // Resources — the whole reason this store exists (§5.1).
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let stream: MediaStream | null = null;
  let audio: HTMLAudioElement | null = null;

  let startedGate: Gate<boolean> | null = null;
  let closedGate: Gate<void> | null = null;
  /** Bumped by `start()`, `stop()` and `clearAll()`; the stale-failure guard. */
  let generation = 0;
  let activeLocale: Locale = 'en';
  let available = false;
  let configRequested = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function notify(): void {
    for (const cb of listeners) cb();
  }

  /** Reference-stable commit: a new object only when a field really changed,
   * and always the `IDLE` constant for an idle snapshot (§4.2). */
  function commitState(patch: Partial<LiveCallState>): void {
    const next = { ...committed, ...patch };
    if (isSameState(next, committed)) return;
    committed = isSameState(next, IDLE) ? IDLE : next;
    notify();
  }

  function commitLines(): void {
    if (!linesDirty) return;
    committedLines = { streaming: pendingStreaming, lines: pendingLines.slice() };
    linesDirty = false;
    notify();
  }

  /** Drop every transcript buffer and the committed subtitle snapshot. */
  function clearBooks(): void {
    pendingInput = '';
    pendingOutput = '';
    pendingStreaming = '';
    pendingLines = [];
    linesDirty = false;
    if (committedLines !== EMPTY_LINES) {
      committedLines = EMPTY_LINES;
      notify();
    }
  }

  function hasClockWork(): boolean {
    return (
      pendingInput !== committed.inputText ||
      pendingOutput !== committed.outputText ||
      linesDirty
    );
  }

  function armClock(): void {
    if (timer !== null) return;
    timer = setInterval(() => tick(), TICK_MS);
  }

  function disarmClock(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  /** The lazy clock (§4.4): production arms it, tests call `tick()` directly. */
  function tick(_now: number = now()): void {
    if (pendingInput !== committed.inputText || pendingOutput !== committed.outputText) {
      commitState({ inputText: pendingInput, outputText: pendingOutput });
    }
    commitLines();
    if (!hasClockWork()) disarmClock();
  }

  /** Release every local resource. Never touches the network — `stop()` owns that. */
  function releaseLocal(): void {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    try {
      dc?.close();
    } catch {
      /* already closing */
    }
    dc = null;
    try {
      pc?.close();
    } catch {
      /* already closing */
    }
    pc = null;
    if (audio) {
      audio.srcObject = null;
      audio = null;
    }
  }

  function setAvailable(next: boolean): void {
    if (next === available) return;
    available = next;
    notify();
  }

  function fail(error: unknown): void {
    commitState({ phase: 'error', error: errorText(error, activeLocale) });
  }

  /** Append one raw transcript fragment. The display text is the exact
   * concatenation of the deltas — no separator, no trimming (§4.6). */
  function applyTranscriptDelta(channel: 'input' | 'output', message: Record<string, unknown>): void {
    const delta = typeof message.delta === 'string' ? message.delta : '';
    if (delta === '') return;
    if (channel === 'input') pendingInput += delta;
    else pendingOutput += delta;
    armClock();
  }

  /** The data channel is the only place transcript events arrive; audio itself
   * is on the media track (`session.output_audio.delta` MUST NOT be expected). */
  function onDataChannelMessage(event: MessageEvent): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return; // A non-JSON frame is not ours to guess at.
    }
    // Read `type` through a local so the frame-name scanner
    // (tools/check-ws-contract.mjs) does not read the `'string'` typeof guard
    // as a frame. The dotted cases stay dotted so the same scanner does not
    // read `'started'` as a frame name.
    const raw = message.type;
    const type = typeof raw === 'string' ? raw : '';
    switch (type) {
      case 'session.started':
        startedGate?.resolve(true);
        break;
      case 'session.closed':
        closedGate?.resolve();
        break;
      case 'session.input_transcript.delta':
        applyTranscriptDelta('input', message);
        break;
      case 'session.output_transcript.delta':
        applyTranscriptDelta('output', message);
        break;
      default:
        break;
    }
  }

  /**
   * Character speech reuses the frames `useWorld` already dispatches (§3.4).
   * One listener per store, mounted once — never a second socket, never a new
   * frame name. Subtitle frames only fill the buffers; `tick()` commits them.
   */
  function onCharacterFrame(event: Event): void {
    const detail = (event as CustomEvent).detail;
    if (!isCharacterFrame(detail)) return;
    if (detail.characterId !== committed.characterId) return;
    if (detail.type === 'character_delta') pendingStreaming += detail.delta;
    else if (detail.type === 'character_message') {
      pendingLines.push(detail.text);
      pendingStreaming = '';
    } else if (detail.type === 'character_idle') pendingStreaming = '';
    else if (detail.type === 'error') {
      // §3.4 step 6: the server already wrote the sentence, and the player
      // must see it in the same event loop — so this one commits synchronously.
      if (committed.phase === 'connecting' || committed.phase === 'live') {
        commitState({ phase: 'error', error: detail.message });
      }
      return;
    } else return;
    linesDirty = true;
    armClock();
  }

  /** World gone: the backend already closed its handles, so a `close` POST
   * would only 409. Clear locally and let the guards drop stale failures. */
  function onWorldUnavailable(): void {
    clearAll('world-unavailable');
  }

  function ensureConfig(): void {
    if (configRequested) return;
    configRequested = true;
    void (async () => {
      try {
        const config = await readJson<LiveConfig>(await fetch('/api/live/config'));
        setAvailable(config.ok === true && config.available === true);
      } catch {
        setAvailable(false);
      }
    })();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Readiness is probed lazily: with no subscriber nobody can render the
    // entry, so nobody needs the answer (§2.1 `ensureConfig`).
    ensureConfig();
    return () => listeners.delete(listener);
  }

  async function start(opts: StartCallOptions): Promise<void> {
    activeLocale = opts.locale;

    // Same character already talking? Adopt: keep the transport, move the owner.
    // This is what makes "the two entries share one call" observable (§3.1-3).
    if (committed.phase === 'connecting' || committed.phase === 'live') {
      if (committed.characterId === opts.characterId) {
        commitState({ owner: opts.owner });
        return;
      }
    }

    // A different character, or a call left in `error` → close it first (§3.2-4).
    // The cast re-widens `phase`: TS narrowed it to the non-idle branch above,
    // but `stop()` reassigns `committed` where flow analysis cannot follow.
    if ((committed.phase as LiveCallState['phase']) !== 'idle') {
      await stop();
      if ((committed.phase as LiveCallState['phase']) !== 'idle') return;
    }

    generation += 1;
    const gen = generation;

    // Readiness gate: never open a microphone on a server that cannot host the
    // call — the 503 would arrive only after the permission prompt (§3.2-2).
    if (!available) {
      fail(new LiveClientError('unavailable'));
      return;
    }

    startedGate = makeGate<boolean>();
    const gate = startedGate;
    closedGate = null;
    clearBooks();
    commitState({
      phase: 'connecting',
      characterId: opts.characterId,
      owner: opts.owner,
      inputText: '',
      outputText: '',
      error: undefined,
    });

    try {
      // 1. Microphone — inside the user's click, never on mount (§2.9).
      const getUserMedia =
        deps.getUserMedia ??
        (typeof navigator !== 'undefined'
          ? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
          : undefined);
      if (!getUserMedia) throw new LiveClientError('mic_unsupported');
      let media: MediaStream;
      try {
        media = await getUserMedia({ audio: true });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          throw new LiveClientError('mic_denied');
        }
        throw new LiveClientError('mic_unsupported');
      }
      stream = media;

      // 2. Peer connection; the synthesized voice arrives as a remote track.
      const peer = openPeer();
      pc = peer;
      const player = openAudio();
      player.autoplay = true;
      audio = player;
      peer.addEventListener('track', (event) => {
        const [remote] = event.streams;
        if (remote && audio) audio.srcObject = remote;
      });
      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'failed' && committed.phase === 'live') {
          fail(new LiveClientError('connection'));
        }
      });
      for (const track of media.getTracks()) peer.addTrack(track, media);

      // 3. Data channel FIRST, so no early event is missed. We never send
      //    `session.start` here — the HTTP call already starts the session.
      const channel = peer.createDataChannel('oai-events');
      dc = channel;
      channel.addEventListener('message', onDataChannelMessage);

      // 4. Offer with ICE already gathered (single-shot SDP, no trickle).
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer, ICE_GATHERING_TIMEOUT_MS);
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new LiveClientError('connection');

      // 5. Our server creates the Live session and attaches the sideband.
      const result = await readJson<LiveSessionResponse>(
        await fetch('/api/live/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: opts.characterId, sdp, language: opts.locale }),
        }),
      );

      // 6. Answer from OpenAI, relayed by our server.
      await peer.setRemoteDescription({ type: 'answer', sdp: result.sdp });

      // 7. Only `session.started` promotes the call to `live`; the HTTP 200 is
      //    the server's word, not the session's. Committed synchronously so the
      //    TTS gate in the dialogue reads `live` in this same event loop.
      const started = await waitForSignalOrTimeout(gate.promise, SESSION_START_TIMEOUT_MS);
      if (gen !== generation || (committed.phase as LiveCallState['phase']) !== 'connecting') return;
      if (!started) throw new LiveClientError('connection');
      commitState({ phase: 'live' });
      await audio.play().catch(() => {
        /* Autoplay blocked: the subtitle still tells the player what was said. */
      });
    } catch (err) {
      // A world that vanished mid-flight owns the snapshot now — reporting the
      // old world's error on top of the cleared state would misattribute it (§3.5-4).
      releaseLocal();
      if (gen !== generation) return;
      fail(err);
    }
  }

  async function stop(owner?: string): Promise<void> {
    // The lifecycle guard (§3.1-2): an entry only hangs up the call IT opened.
    if (owner !== undefined && committed.owner !== owner) return;
    if (committed.phase === 'idle') return;

    generation += 1;
    const gen = generation;
    const wasActive = committed.phase === 'connecting' || committed.phase === 'live';
    const characterId = committed.characterId;

    // Ask the session to close and give it the frozen window for
    // `session.closed`. A silent session MUST NOT stall the hangup.
    let closed: Promise<void> | null = null;
    if (dc?.readyState === 'open') {
      closedGate = makeGate<void>();
      closed = closedGate.promise;
      try {
        dc.send(JSON.stringify({ type: 'session.close' }));
      } catch {
        closed = null; // The channel died between the check and the send.
      }
    }
    if (closed) await waitOrTimeout(closed, SESSION_CLOSE_TIMEOUT_MS);

    // `clearAll` ran while we waited: the world is gone, so skip both the
    // pointless `close` POST and the commit — it already owns the snapshot.
    if (gen !== generation) {
      releaseLocal();
      return;
    }

    // Tell the server to release its handle + sideband, keyed by character.
    // A failed teardown MUST NOT block the local cleanup.
    if (characterId) {
      try {
        await fetch('/api/live/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: characterId }),
        });
      } catch {
        /* Server gone; ours is the cleanup that still matters. */
      }
    }

    releaseLocal();
    startedGate?.resolve(false);
    closedGate?.resolve();
    startedGate = null;
    closedGate = null;
    clearBooks();
    disarmClock();
    if (wasActive || committed.phase === 'error') commitState({ ...IDLE, error: undefined });
  }

  function clearAll(_reason: 'world-unavailable'): void {
    generation += 1;
    disarmClock();
    releaseLocal();
    startedGate?.resolve(false);
    closedGate?.resolve();
    startedGate = null;
    closedGate = null;
    const hadSnapshot = committed !== IDLE;
    pendingInput = '';
    pendingOutput = '';
    pendingStreaming = '';
    pendingLines = [];
    linesDirty = false;
    committed = IDLE;
    committedLines = EMPTY_LINES;
    if (hadSnapshot) notify();
  }

  events.addEventListener('airp:character-frame', onCharacterFrame);
  events.addEventListener('airp:world-unavailable', onWorldUnavailable);

  return {
    subscribe,
    getSnapshot: () => committed,
    getLines: () => committedLines,
    isAvailable: () => available,
    ensureConfig,
    start,
    stop,
    clearAll,
    tick,
  };
}

/** The one call, process-wide. Two entries, one owner of the transport. */
export const liveCallStore: LiveCallStore = createLiveCallStore();

/** Test seam: reset the singleton between cases (mirrors the rail store's). */
export function resetLiveCallForTest(): void {
  liveCallStore.clearAll('world-unavailable');
}
