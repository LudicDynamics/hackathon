import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from './i18n.js';

/**
 * Player voice input (docs/live-voice/语音输入（STT）.md): record one short
 * utterance, transcribe it on the server, and hand the text to the host input.
 * The transcript is only a draft — the host decides when anything is sent.
 *
 * The microphone opens inside the player's click (never on mount) and is
 * released as soon as the recording stops.
 */

export type VoiceInputState = 'idle' | 'recording' | 'transcribing';
export type VoiceInputError = 'mic_denied' | 'mic_unsupported' | 'unavailable' | 'failed';

/** Auto-stop so a forgotten recording cannot run (and bill) indefinitely. */
export const MAX_RECORDING_MS = 60_000;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export class VoiceInputFailure extends Error {
  constructor(readonly code: VoiceInputError) {
    super(code);
  }
}

/** First container the browser can record; Safari falls back to mp4. */
export function pickRecordingMimeType(
  isSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type),
): string {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? '';
}

/** UI locale → the ISO-639-1 hint the server accepts. */
export function transcriptionLanguage(locale: Locale): 'en' | 'ja' | 'zh' {
  return locale === 'ja' ? 'ja' : locale === 'zh-CN' ? 'zh' : 'en';
}

export async function transcribe(blob: Blob, locale: Locale): Promise<string> {
  const response = await fetch(`/api/stt?language=${transcriptionLanguage(locale)}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; text?: unknown; code?: string } | null;
  if (!response.ok || data?.ok !== true) {
    throw new VoiceInputFailure(data?.code === 'stt_unavailable' ? 'unavailable' : 'failed');
  }
  return typeof data.text === 'string' ? data.text.trim() : '';
}

export function useVoiceInput({ locale, onText }: { locale: Locale; onText: (text: string) => void }) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const releaseMic = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        // Unmounting drops the recording instead of transcribing it.
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      recorderRef.current = null;
      releaseMic();
    };
  }, [releaseMic]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('mic_unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'mic_denied' : 'mic_unsupported');
      return;
    }
    if (!mountedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    streamRef.current = stream;
    const mimeType = pickRecordingMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      releaseMic();
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      if (blob.size === 0) {
        setState('idle');
        return;
      }
      setState('transcribing');
      try {
        const text = await transcribe(blob, locale);
        if (text && mountedRef.current) onTextRef.current(text);
      } catch (err) {
        if (mountedRef.current) setError(err instanceof VoiceInputFailure ? err.code : 'failed');
      } finally {
        if (mountedRef.current) setState('idle');
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setState('recording');
    timerRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, MAX_RECORDING_MS);
  }, [locale, releaseMic]);

  const toggle = useCallback(() => {
    if (state === 'recording') stop();
    else if (state === 'idle') void start();
  }, [state, start, stop]);

  return { state, error, toggle };
}
