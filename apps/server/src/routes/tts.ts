import { Router } from 'express';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { LocalWorldStore } from '@airp/shared';

/**
 * Server-side TTS: the ONE synthesis point (docs/tts/00 §1, docs/tts/01).
 *
 * `POST /api/tts` takes one page of character dialogue, checks the on-disk
 * content-addressed cache, and on a miss calls DashScope `qwen3-tts-flash`,
 * downloads the resulting OSS wav and writes it atomically before returning a
 * local URL. `GET /api/tts/audio/:file` serves that wav back.
 *
 * There is deliberately NO module-level state (no cached config, no client):
 * every request re-reads env and the active store, so tests may set env after
 * import and an operator may rotate the key without a restart (docs/tts/01 §10).
 *
 * TTS is a performance, not state (docs/tts/00 §1): it never writes `events`,
 * never emits a WS frame and never touches `assets/audio/` (docs/tts/00 §9).
 */

/** DashScope caps `text` at 512 tokens ≈ 600 chars; 500 is the conservative pick. */
const MAX_TEXT_CHARS = 500;
/** A voice is a single bare DashScope id token — no spaces (docs/tts/00 §15.1). */
const VOICE_RE = /^[A-Za-z0-9_-]+$/;
/** Content-addressed cache file: `hashOf(...)` output (docs/tts/00 §2.2/§3.2). */
const FILE_RE = /^[a-f0-9]{20}\.wav$/;
/** World locale short code → DashScope `language_type` (docs/tts/00 §4.4). */
const LANGUAGE_MAP: Record<string, string> = { ja: 'Japanese', en: 'English' };

const DEFAULTS = {
  model: 'qwen3-tts-flash-2025-11-27',
  baseUrl: 'https://dashscope-intl.aliyuncs.com/api/v1',
  timeoutMs: 15000,
  voice: 'Cherry',
} as const;

interface TtsConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  defaultVoice: string;
}

/**
 * Re-read env on EVERY request, never at module load (docs/tts/01 §3.D step 0):
 * the test harness sets env after import and expects it to take effect.
 */
function readTtsConfig(): TtsConfig {
  const timeoutRaw = Number(process.env.AIRP_TTS_TIMEOUT_MS);
  return {
    apiKey: process.env.DASHSCOPE_API_KEY ?? '',
    // Trailing slashes are stripped so `/services/...` always concatenates cleanly.
    baseUrl: (process.env.AIRP_TTS_BASE_URL ?? DEFAULTS.baseUrl).replace(/\/+$/, ''),
    model: process.env.AIRP_TTS_MODEL ?? DEFAULTS.model,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : DEFAULTS.timeoutMs,
    defaultVoice: process.env.AIRP_TTS_DEFAULT_VOICE ?? DEFAULTS.voice,
  };
}

/**
 * docs/tts/00 §3.2: sha256(`${model}|${voice}|${language_type}|${text}`).slice(0,20).
 * The four fields are joined verbatim (including the RESOLVED language_type, not
 * the request's short code) — same voice/text/model MUST hit, different MUST miss.
 */
export function hashOf(model: string, voice: string, languageType: string, text: string): string {
  return createHash('sha256').update(`${model}|${voice}|${languageType}|${text}`).digest('hex').slice(0, 20);
}

/** Upstream failure carrier: a typed marker beats string-matching the message. */
class TtsUpstreamError extends Error {
  constructor(
    public kind: 'timeout' | 'upstream',
    message: string
  ) {
    super(message);
    this.name = 'TtsUpstreamError';
  }
}

/** Map a `synthesise` throw onto the frozen error matrix (docs/tts/01 §3.E). */
function mapSynthError(err: unknown): { status: number; code: string; error: string } {
  if (err instanceof TtsUpstreamError && err.kind === 'timeout') {
    return { status: 504, code: 'tts_timeout', error: err.message };
  }
  if (err instanceof TtsUpstreamError) {
    return { status: 502, code: 'tts_upstream', error: err.message };
  }
  const aborted = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
  if (aborted) return { status: 504, code: 'tts_timeout', error: 'TTS request timed out' };
  return { status: 502, code: 'tts_upstream', error: err instanceof Error ? err.message : String(err) };
}

/** A wav container is `RIFF....WAVE` — the 4-byte sigil plus the 4-byte form type. */
function isWav(buf: Buffer): boolean {
  return (
    buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE'
  );
}

/**
 * Synthesise one page of text via DashScope → download → return the wav bytes.
 * A single `AbortController` covers BOTH hops (docs/tts/00 §3.3: the timeout is a
 * total budget including the download).
 */
export async function synthesise(opts: {
  text: string;
  voice: string;
  languageType: string; // already mapped: 'Auto' | 'Chinese' | 'English' | 'Japanese' | … (never the short code)
  apiKey: string;
  baseUrl: string; // e.g. https://dashscope-intl.aliyuncs.com/api/v1
  model: string; // e.g. qwen3-tts-flash-2025-11-27
  timeoutMs: number; // total budget incl. the OSS download
}): Promise<Buffer> {
  // Step 1 — request shape (qwen3-tts-flash.md §1.1/§1.2/§2.1/§2.2). `language_type`
  // keeps its underscore: a camelCase key is silently ignored by DashScope.
  const endpoint = `${opts.baseUrl}/services/aigc/multimodal-generation/generation`;
  const payload = {
    model: opts.model,
    input: {
      text: opts.text,
      voice: opts.voice,
      language_type: opts.languageType,
    },
  };
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
  };

  // Step 2 — fire, under the total budget.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new TtsUpstreamError('timeout', `TTS request timed out after ${opts.timeoutMs}ms`);
      }
      throw err;
    }

    // Step 3 — `output.audio.url` (qwen3-tts-flash.md §3). `res.ok` is the primary
    // verdict; `code`/`message` are only folded into the error text.
    if (!res.ok) throw new TtsUpstreamError('upstream', `DashScope HTTP ${res.status}`);
    const data = (await res.json()) as {
      status_code?: number;
      code?: string;
      message?: string;
      output?: { audio?: { url?: string } };
      usage?: { characters?: number };
    };
    const audioUrl = data.output?.audio?.url;
    if (typeof audioUrl !== 'string' || audioUrl === '') {
      throw new TtsUpstreamError(
        'upstream',
        `DashScope response has no output.audio.url: ${data.code ?? ''} ${data.message ?? ''}`.trim()
      );
    }

    // Step 4 — download now. The OSS URL is a SIGNED link that expires (24h,
    // qwen3-tts-flash.md §5.3), so caching the wav is the only correct posture.
    let audioRes: Response;
    try {
      audioRes = await fetch(audioUrl, { signal: ac.signal });
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new TtsUpstreamError('timeout', `TTS download timed out after ${opts.timeoutMs}ms`);
      }
      throw err;
    }
    if (!audioRes.ok) throw new TtsUpstreamError('upstream', `OSS download HTTP ${audioRes.status}`);
    const buf = Buffer.from(await audioRes.arrayBuffer());

    // Magic-byte gate (docs/tts/00 §15.21): an error page must never be cached.
    // The cache is content-addressed and the browser never retries a failed
    // decode, so a poisoned file would be permanent.
    if (!isWav(buf)) {
      throw new TtsUpstreamError('upstream', 'OSS download is not a RIFF/WAVE file');
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Same-dir temp + rename, mirroring `LocalWorldStore.writeFileAtomic`
 * (local-store.ts:174-188). Same-dir is REQUIRED: rename is atomic only within
 * one filesystem. The temp name carries pid + random because two concurrent
 * requests (two pages prefetched at once) may synthesise the SAME hash and race.
 *
 * `FILE_RE` never matches `.tmp-…`, so a crash between write and rename leaves
 * garbage that can never be mistaken for a cache hit.
 */
async function writeAtomic(abs: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, abs);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

/**
 * Assemble the TTS routes. Mounted alongside `createWorldRouter` on `/api`.
 * Nothing here is module-level state: every request re-reads env and the
 * active store, so tests may set env after import (hard requirement, §10).
 */
export function createTtsRouter(
  repoRoot: string,
  getActiveStore: () => LocalWorldStore | null
): Router {
  const router = Router();

  /**
   * Synthesise one page of character dialogue (docs/tts/01 §3.D, eight steps).
   * Request body: `{ text: string, voice?: string, language?: string }`.
   * Success: `{ ok: true, url, cached, characters, truncated }`.
   * Failure: `{ ok: false, code, error }` — TTS-owned codes, NOT `ActionErrorCode`
   * (docs/tts/01 §11 conflict 3).
   */
  router.post('/tts', async (req, res) => {
    // Step 0 — per-request config.
    const config = readTtsConfig();

    // Step 1 — an active world is required: the cache root hangs off it.
    const store = getActiveStore();
    if (!store) {
      return res.status(400).json({ ok: false, code: 'no_active_world', error: 'No active world' });
    }

    // Step 2 — `text` must be a non-empty string. Only the emptiness check
    // trims; the page text is sent verbatim (leading space may be a beat).
    const {
      text: rawText,
      voice: rawVoice,
      language: rawLanguage,
    } = req.body as { text?: unknown; voice?: unknown; language?: unknown };
    if (typeof rawText !== 'string' || rawText.trim() === '') {
      return res
        .status(400)
        .json({ ok: false, code: 'invalid_argument', error: 'text must be a non-empty string' });
    }

    // Step 3 — truncate BEFORE hashing, so the cache key matches the text that
    // was actually sent. Truncation keeps the performance alive rather than
    // failing silently; `truncated` reaches the client.
    let text = rawText;
    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }

    // Step 4 — validate the voice shape; a malformed id would 400 upstream and
    // mute the whole page. Fail loud in the log, but never widen the response.
    const requestedVoice = typeof rawVoice === 'string' ? rawVoice.trim() : '';
    const voice = VOICE_RE.test(requestedVoice) ? requestedVoice : config.defaultVoice;
    if (requestedVoice !== '' && !VOICE_RE.test(requestedVoice)) {
      console.warn(
        `[AIRP TTS] reject malformed voice "${requestedVoice}"; falling back to "${config.defaultVoice}"`
      );
    }

    // Step 5 — world locale short code → DashScope `language_type`.
    const languageType = typeof rawLanguage === 'string' ? (LANGUAGE_MAP[rawLanguage] ?? 'Auto') : 'Auto';

    // Step 6 — cache lookup. `existsSync` (not `stat`) is enough: atomic writes
    // guarantee "present ⇒ complete".
    const hash = hashOf(config.model, voice, languageType, text);
    const cacheDir = path.join(store.worldRoot, '.airpworld', 'tts-cache');
    const file = `${hash}.wav`;
    const abs = path.join(cacheDir, file);
    if (existsSync(abs)) {
      return res.json({
        ok: true,
        url: `/api/tts/audio/${file}`,
        cached: true,
        characters: text.length,
        truncated,
      });
    }

    // Step 7 — key check comes AFTER the cache probe on purpose: an already
    // synthesised page keeps playing even if the key was withdrawn.
    if (!config.apiKey) {
      return res
        .status(503)
        .json({ ok: false, code: 'tts_unconfigured', error: 'DASHSCOPE_API_KEY is not set' });
    }
    let wav: Buffer;
    try {
      wav = await synthesise({
        text,
        voice,
        languageType,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    } catch (err) {
      const mapped = mapSynthError(err);
      return res.status(mapped.status).json({ ok: false, code: mapped.code, error: mapped.error });
    }
    try {
      await writeAtomic(abs, wav);
    } catch (err) {
      // Synthesis succeeded but did not land — the next request re-synthesises
      // the same hash, so this is idempotent and safe (docs/tts/01 §3.D step 7).
      console.warn(
        `[AIRP TTS] failed to cache ${file} in ${path.relative(repoRoot, cacheDir) || cacheDir}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return res.status(500).json({
        ok: false,
        code: 'internal',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 8 — the frozen five-field success body.
    return res.json({
      ok: true,
      url: `/api/tts/audio/${file}`,
      cached: false,
      characters: text.length,
      truncated,
    });
  });

  /**
   * Serve one cached wav. Content-addressed ⇒ immutable ⇒ a year-long cache.
   * The name shape is checked FIRST (it subsumes any `..` attempt), then the
   * `/api/audio` triple belt: resolve + prefix check + symlink re-check
   * (docs/tts/00 §2.2).
   */
  router.get('/tts/audio/:file', (req, res) => {
    const notFound = (status: number, error: string) =>
      res.status(status).json({ ok: false, code: 'not_found', error });

    const store = getActiveStore();
    if (!store) return notFound(404, 'No active world');

    const file = String(req.params.file ?? '');
    if (!FILE_RE.test(file)) return notFound(403, 'invalid audio file name');

    const cacheDir = path.join(store.worldRoot, '.airpworld', 'tts-cache');
    try {
      const abs = path.resolve(cacheDir, file);
      if (!abs.startsWith(cacheDir + path.sep)) {
        return notFound(403, 'path escapes tts cache root');
      }
      // `realpathSync` throws when the file is missing, which the catch turns
      // into the 404 the client expects.
      const real = realpathSync(abs);
      if (!real.startsWith(realpathSync(cacheDir) + path.sep)) {
        return notFound(403, 'path escapes tts cache root (symlink)');
      }
      res.sendFile(abs, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }, (err) => {
        if (err && !res.headersSent) notFound(404, err.message);
      });
    } catch (err) {
      notFound(404, err instanceof Error ? err.message : String(err));
    }
  });

  return router;
}
