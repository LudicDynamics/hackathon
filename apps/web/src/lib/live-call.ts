import { useCallback, useEffect, useRef, useState } from 'react';
import { AirpRequestError } from './airp-gateway.js';
import { isCharacterFrame, type CharacterFrame } from './character-frame-queue.js';
import { UI_COPY, type Locale } from './legacy-ui-copy.js';

/**
 * `apps/web/src/lib/live-call.ts` — the browser half of the nook realtime call
 * (docs/live-voice/00 §2.3, §15.4).
 *
 * Three owners, one per action (upstream: "Assign one owner for each action"):
 *   - browser (here): the mic track in, the synthesized track out, the
 *     `oai-events` data channel, the `session.close` initiation, subtitles;
 *   - server sideband: delegation execution, transcript accumulation,
 *     `session.*.append`.
 *
 * Hard rules this file keeps (docs/live-voice/00 §5):
 *   - NEVER send `session.start` on the data channel — the HTTP
 *     `POST /api/live/session` already starts the session.
 *   - NEVER expect `session.output_audio.delta` here: audio rides the WebRTC
 *     media track, not the data channel.
 *   - NEVER carry `OPENAI_API_KEY` in the browser: only `/api/live/*` is called.
 *   - `getUserMedia` runs inside the user's click, never on mount (cost gate
 *     §2.9: no call ever opens by itself).
 */

/**
 * One raw transcript fragment (docs/live-voice/00 §7.2: deltas "may arrive
 * unevenly"). The delta text and its time bounds are kept verbatim — the
 * subtitle text is the exact concatenation of these deltas, with no inserted
 * spaces and no trimming (see `applyTranscriptDelta`).
 */
interface CaptionSegment {
  delta: string;
  startMs?: number;
  endMs?: number;
}

/** The frozen front-end state shape (docs/live-voice/00 §15.4). */
export interface LiveCallState {
  phase: 'idle' | 'connecting' | 'live' | 'error';
  /** Human-readable, mapped from the server `code` (never a raw status). */
  error?: string;
  inputText: string;
  outputText: string;
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

/** Server `code` → the copy key that names the human-readable reason
 * (docs/live-voice/00 §8 error boundaries). */
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

function numOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Read a `/api/live/*` JSON response while preserving the gateway's
 * cross-cutting 409 handling (`airp-gateway.ts:29-31`): a `no_active_world`
 * answer means the world vanished under the app, and the existing
 * `airp:world-unavailable` forward must still run.
 *
 * This duplicate reader exists because the gateway's `request()` is
 * module-private and adding a `live` namespace to `airp-gateway.ts` would edit
 * a file this session does not own (docs/live-voice/00 §15.6).
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

/**
 * `useLiveCall` — the nook call state machine (docs/live-voice/00 §15.4).
 *
 * `start()` MUST be called from a user action: it opens the microphone. There
 * is deliberately no auto-start (§2.9 cost gate).
 */
export function useLiveCall(opts: {
  characterId: string;
  locale: 'en' | 'ja';
  onCharacterFrame?: (frame: CharacterFrame) => void;
}): {
  state: LiveCallState;
  available: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
} {
  const { characterId, locale, onCharacterFrame } = opts;

  const [state, setState] = useState<LiveCallState>({
    phase: 'idle',
    inputText: '',
    outputText: '',
  });
  const [available, setAvailable] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputSegmentsRef = useRef<CaptionSegment[]>([]);
  const outputSegmentsRef = useRef<CaptionSegment[]>([]);
  const startedRef = useRef<{ promise: Promise<boolean>; resolve: (v: boolean) => void } | null>(null);
  const closedRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const phaseRef = useRef<LiveCallState['phase']>('idle');
  // Tracks whether `start()` ever armed a peer, so an unmount with no call
  // never fires a pointless `POST /api/live/close`.
  const armedRef = useRef(false);
  // Keeps the latest `onCharacterFrame` reachable from a long-lived listener
  // without re-subscribing on every parent render.
  const frameHandlerRef = useRef(onCharacterFrame);
  frameHandlerRef.current = onCharacterFrame;

  const setPhase = useCallback((phase: LiveCallState['phase']) => {
    phaseRef.current = phase;
    setState((prev) => ({ ...prev, phase, error: phase === 'error' ? prev.error : undefined }));
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      phaseRef.current = 'error';
      setState((prev) => ({ ...prev, phase: 'error', error: errorText(error, locale) }));
    },
    [locale],
  );

  // Readiness gate: with no key the button is never rendered (§2.9). Failure to
  // reach the endpoint is also "not available" — the honest reading, since a
  // call could not be opened anyway.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await readJson<LiveConfig>(await fetch('/api/live/config'));
        if (!cancelled) setAvailable(config.ok === true && config.available === true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Character speech reuses the frames `useWorld` already dispatches
  // (docs/live-voice/00 §2.8): `App` owns the WS, we only listen here. No new
  // socket, no new frame name.
  useEffect(() => {
    const onFrame = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!isCharacterFrame(detail)) return;
      if (detail.characterId !== characterId) return;
      if (
        detail.type !== 'character_delta' &&
        detail.type !== 'character_message' &&
        detail.type !== 'character_idle'
      ) {
        return;
      }
      frameHandlerRef.current?.(detail);
    };
    window.addEventListener('airp:character-frame', onFrame);
    return () => window.removeEventListener('airp:character-frame', onFrame);
  }, [characterId]);

  /**
   * Append one raw transcript fragment. The display text is the exact
   * concatenation of the deltas — no separator is inserted and nothing is
   * trimmed, because the deltas are already contiguous fragments of the same
   * utterance (docs/live-voice/00 §7.2). `start_ms`/`end_ms` are retained
   * alongside the text for diagnostics; arrival order is authoritative.
   */
  const applyTranscriptDelta = useCallback((channel: 'input' | 'output', message: Record<string, unknown>) => {
    const delta = typeof message.delta === 'string' ? message.delta : '';
    if (delta === '') return;
    const segment: CaptionSegment = {
      delta,
      startMs: numOrUndefined(message.start_ms),
      endMs: numOrUndefined(message.end_ms),
    };
    const segments = channel === 'input' ? inputSegmentsRef.current : outputSegmentsRef.current;
    segments.push(segment);
    const text = segments.map((part) => part.delta).join('');
    setState((prev) => (channel === 'input' ? { ...prev, inputText: text } : { ...prev, outputText: text }));
  }, []);

  /** The data channel is the only place transcript events arrive; audio itself
   * is on the media track (`session.output_audio.delta` MUST NOT be expected). */
  const onDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return; // A non-JSON frame is not ours to guess at.
      }
      // Read `type` through a local so the frame-name scanner
      // (tools/check-ws-contract.mjs:137, which treats any `<expr>.type === 'x'`
      // as a frame literal) does not read the `'string'` typeof guard as a frame.
      const raw = message.type;
      const type = typeof raw === 'string' ? raw : '';
      switch (type) {
        case 'session.started':
          startedRef.current?.resolve(true);
          break;
        case 'session.closed':
          closedRef.current?.resolve();
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
    },
    [applyTranscriptDelta],
  );

  /** Release every local resource. No network waits — `stop()` owns those. */
  const teardownLocal = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    try {
      dcRef.current?.close();
    } catch {
      /* already closing */
    }
    dcRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* already closing */
    }
    pcRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    armedRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (phaseRef.current === 'connecting' || phaseRef.current === 'live') return;
    if (!available) {
      fail(new LiveClientError('unavailable'));
      return;
    }

    startedRef.current = (() => {
      let resolve!: (v: boolean) => void;
      const promise = new Promise<boolean>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();
    armedRef.current = true;
    inputSegmentsRef.current = [];
    outputSegmentsRef.current = [];
    setState({ phase: 'connecting', inputText: '', outputText: '' });
    phaseRef.current = 'connecting';

    try {
      // 1. Microphone — inside the user's click, never on mount.
      if (!navigator.mediaDevices?.getUserMedia) throw new LiveClientError('mic_unsupported');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') throw new LiveClientError('mic_denied');
        throw new LiveClientError('mic_unsupported');
      }
      streamRef.current = stream;

      // 2. Peer connection; the synthesized voice arrives as a remote track.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.addEventListener('track', (event) => {
        const [remote] = event.streams;
        if (remote && audioRef.current) audioRef.current.srcObject = remote;
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed' && phaseRef.current === 'live') {
          fail(new LiveClientError('connection'));
        }
      });
      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      // 3. Data channel FIRST, so no early event is missed. We never send
      //    `session.start` here — the HTTP call already starts the session.
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.addEventListener('message', onDataChannelMessage);

      // 4. Offer with ICE already gathered (single-shot SDP, no trickle).
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc, ICE_GATHERING_TIMEOUT_MS);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new LiveClientError('connection');

      // 5. Our server creates the Live session and attaches the sideband.
      const result = await readJson<LiveSessionResponse>(
        await fetch('/api/live/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: characterId, sdp, language: locale }),
        }),
      );

      // 6. Answer from OpenAI, relayed by our server.
      await pc.setRemoteDescription({ type: 'answer', sdp: result.sdp });

      // 7. Only `session.started` promotes the call to `live`; the HTTP 200 is
      //    the server's word, not the session's.
      const started = await waitForSignalOrTimeout(startedRef.current.promise, SESSION_START_TIMEOUT_MS);
      if (phaseRef.current !== 'connecting') return; // stopped mid-flight
      if (!started) {
        throw new LiveClientError('connection');
      }
      setPhase('live');
      await audio.play().catch(() => {
        /* Autoplay blocked: the subtitle still tells the player what was said. */
      });
    } catch (err) {
      teardownLocal();
      fail(err);
    }
  }, [available, characterId, locale, fail, onDataChannelMessage, setPhase, teardownLocal]);

  const stop = useCallback(async () => {
    if (phaseRef.current === 'idle') return;
    const wasActive = phaseRef.current === 'connecting' || phaseRef.current === 'live';

    // Ask the session to close and give it the frozen 15s window for
    // `session.closed`. A silent session MUST NOT stall the hangup.
    let closed: Promise<void> | null = null;
    if (dcRef.current?.readyState === 'open') {
      closedRef.current = (() => {
        let resolve!: () => void;
        const promise = new Promise<void>((res) => {
          resolve = res;
        });
        return { promise, resolve };
      })();
      closed = closedRef.current.promise;
      try {
        dcRef.current.send(JSON.stringify({ type: 'session.close' }));
      } catch {
        closed = null; // The channel died between the check and the send.
      }
    }
    if (closed) await waitOrTimeout(closed, SESSION_CLOSE_TIMEOUT_MS);

    // Tell the server to release its handle + sideband, keyed by character.
    // A failed teardown MUST NOT block the local cleanup.
    try {
      await fetch('/api/live/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: characterId }),
      });
    } catch {
      /* Server gone; ours is the cleanup that still matters. */
    }

    teardownLocal();
    startedRef.current?.resolve(false);
    closedRef.current?.resolve();
    closedRef.current = null;
    if (wasActive || phaseRef.current === 'error') {
      phaseRef.current = 'idle';
      setState((prev) => ({ ...prev, phase: 'idle', error: undefined }));
    }
  }, [characterId, teardownLocal]);

  // Unmount: release media and the peer without waiting on the network.
  useEffect(() => {
    return () => {
      // Only a call that was actually armed needs the server told. A nook
      // unmounted with no call fires nothing.
      const wasArmed = armedRef.current;
      startedRef.current?.resolve(false);
      closedRef.current?.resolve();
      teardownLocal();
      if (wasArmed) {
        void fetch('/api/live/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character: characterId }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [characterId, teardownLocal]);

  return { state, available, start, stop };
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
