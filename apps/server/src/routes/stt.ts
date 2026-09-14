import express, { Router } from 'express';

/**
 * Speech-to-text for the player's own voice input (docs/live-voice/语音输入（STT）.md).
 *
 * `POST /api/stt` takes one short recording as the raw request body and returns
 * its transcript. The browser only fills the draft with it; nothing is sent to
 * the writer or a character until the player presses Send. `GET /api/stt/config`
 * tells the UI whether the feature is usable without exposing any credential.
 *
 * Like TTS, config is re-read per request (no module-level client), so an
 * operator can set or rotate `OPENAI_API_KEY` / `OPENAI_BASE_URL` from the
 * connection settings without restarting, and tests can point it at a stub.
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
/** A minute of Opus is well under 1MB; the cap only stops accidental floods. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
/** ISO-639-1 hints the UI can send; anything else lets the model auto-detect. */
const LANGUAGES = new Set(['en', 'ja', 'zh']);

export interface SttConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function readSttConfig(): SttConfig {
  return {
    apiKey: (process.env.OPENAI_API_KEY ?? '').trim(),
    baseUrl: (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, ''),
    model: (process.env.AIRP_STT_MODEL || DEFAULT_MODEL).trim(),
  };
}

/** Upload filename extension; the transcription API infers the codec from it. */
export function audioExtension(contentType: string): string | null {
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mp4') || contentType.includes('m4a') || contentType.includes('aac')) return 'mp4';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  return null;
}

export function createSttRouter(): Router {
  const router = Router();

  router.get('/stt/config', (_req, res) => {
    const config = readSttConfig();
    res.json({ available: config.apiKey !== '', model: config.model });
  });

  router.post(
    '/stt',
    express.raw({ type: ['audio/*', 'application/octet-stream'], limit: MAX_AUDIO_BYTES }),
    async (req, res) => {
      const config = readSttConfig();
      if (!config.apiKey) {
        return res.status(503).json({ ok: false, code: 'stt_unavailable', error: 'Voice input is not configured on this server.' });
      }
      const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      const extension = audioExtension(contentType);
      const audio: unknown = req.body;
      if (!extension || !Buffer.isBuffer(audio) || audio.length === 0) {
        return res.status(400).json({ ok: false, code: 'invalid_audio', error: 'Send a non-empty audio recording.' });
      }
      const language = typeof req.query.language === 'string' && LANGUAGES.has(req.query.language)
        ? req.query.language
        : undefined;

      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audio)], { type: contentType }), `speech.${extension}`);
      form.append('model', config.model);
      form.append('response_format', 'json');
      if (language) form.append('language', language);

      try {
        const upstream = await fetch(`${config.baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: form,
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!upstream.ok) {
          // Status only: never log the key, the base URL or what was said.
          console.warn(`[AIRP STT] Transcription failed upstream (${upstream.status}).`);
          return res.status(502).json({ ok: false, code: 'stt_failed', error: 'Could not transcribe the recording.' });
        }
        const data = (await upstream.json()) as { text?: unknown };
        const text = typeof data.text === 'string' ? data.text.trim() : '';
        return res.json({ ok: true, text });
      } catch (err) {
        const reason = err instanceof Error ? err.name : 'Error';
        console.warn(`[AIRP STT] Transcription request failed (${reason}).`);
        return res.status(502).json({ ok: false, code: 'stt_failed', error: 'Could not transcribe the recording.' });
      }
    }
  );

  return router;
}
