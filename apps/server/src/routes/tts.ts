import { Router } from 'express';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { resolveVoice, sanitiseTtsText, parseFrontmatter, type LocalWorldStore } from '@airp/shared';
import { LocalTtsError, characterLocalVoice, isLocalTtsCharacter, localTtsEmotion, localTtsHash, readLocalTtsConfig, synthesiseLocal } from './local-tts.js';

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
/**
 * Structural sanity gate only. The palette lookup below is what decides, so a
 * space is legal here: `Eldric Sage` is ONE DashScope voice, and the old
 * no-space regex silently rewrote it to the default (docs/tts/07 §0).
 */
const VOICE_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;
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
 * Cache keys include the effective delivery instructions for instruct models,
 * so changing voice direction cannot reuse ordinary or stale audio.
 */
export function hashOf(model: string, voice: string, languageType: string, text: string, instructions = ''): string {
  return createHash('sha256')
    .update(`${model}|${voice}|${languageType}|${text}${instructions ? `|delivery:${instructions}` : ''}`)
    .digest('hex')
    .slice(0, 20);
}

/** Ordinary Flash does not support instruction control; never send ignored options. */
export function deliveryInstructions(model: string, voice: string): string {
  if (!/^qwen3-tts-instruct-flash(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return '';
  const identity = voice === 'Cherry' || voice === 'Nini'
    ? 'Use a natural youthful feminine speaking voice, not a child voice. '
    : 'Preserve the selected speaker identity and natural vocal register. ';
  return identity +
    'Speak as if talking quietly face to face, at a comfortable conversational pace. ' +
    'Use relaxed phrasing and small, context-appropriate emotional changes. Keep pitch stable and unforced. ' +
    'Avoid exaggerated rises, sing-song delivery, theatrical breathiness, artificial laughter, shouting and announcer-style emphasis. ' +
    'Read only the supplied text; do not speak these instructions.';
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
  const instructions = deliveryInstructions(opts.model, opts.voice);
  const payload = {
    model: opts.model,
    input: {
      text: opts.text,
      voice: opts.voice,
      language_type: opts.languageType,
      ...(instructions ? { instructions, optimize_instructions: false } : {}),
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

  // Public readiness only: never expose credentials or gateway URLs.
  router.get('/tts/config', (_req, res) => {
    const config = readTtsConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ configured: Boolean(config.apiKey.trim() || readLocalTtsConfig().baseUrl), model: config.model, defaultVoice: config.defaultVoice });
  });

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

    // Step 2 — `text` must be a non-empty string before it enters the shared
    // safety boundary. Only the emptiness check trims the raw input here.
    const {
      text: rawText,
      voice: rawVoice,
      language: rawLanguage,
      characterId,
      emotion: rawEmotion,
    } = req.body as { text?: unknown; voice?: unknown; language?: unknown; characterId?: unknown; emotion?: unknown };
    if (typeof rawText !== 'string' || rawText.trim() === '') {
      return res
        .status(400)
        .json({ ok: false, code: 'invalid_argument', error: 'text must be a non-empty string' });
    }

    // Step 3 — clean before truncation, hashing, cache lookup, and synthesis.
    // The helper is pure and idempotent; this server-side pass is mandatory even
    // when the browser already performed its preflight.
    const cleanedText = sanitiseTtsText(rawText);
    if (cleanedText === '') {
      return res
        .status(400)
        .json({ ok: false, code: 'invalid_argument', error: 'text must be a non-empty string' });
    }

    // Step 4 — truncate BEFORE hashing, so the cache key matches the text that
    // was actually sent. Truncation keeps the performance alive rather than
    // failing silently; `truncated` reaches the client.
    let text = cleanedText;
    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      truncated = true;
    }

    // Step 5 — resolve the declared voice through the palette (docs/tts/07 §3).
    // Two vocabularies reach here: an effect alias from world content
    // (`wise-elder`) or a raw id already in the palette (`Eldric Sage`).
    // A typo is NOT silently accepted — the page still plays on the default,
    // but `check:voices` fails the build so it never ships (07 §3).
    const defaultVoice = resolveVoice(config.defaultVoice) ?? DEFAULTS.voice;
    const requestedVoice = typeof rawVoice === 'string' ? rawVoice.trim() : '';
    let voice = defaultVoice;
    if (requestedVoice !== '') {
      if (!VOICE_RE.test(requestedVoice)) {
        console.warn(
          `[AIRP TTS] reject malformed voice "${requestedVoice}"; falling back to "${config.defaultVoice}"`
        );
      } else {
        voice = resolveVoice(requestedVoice) ?? defaultVoice;
        if (voice === defaultVoice && requestedVoice !== config.defaultVoice) {
          console.warn(
            `[AIRP TTS] unknown voice "${requestedVoice}" (not in the palette, docs/tts/07); ` +
              `falling back to "${config.defaultVoice}"`
          );
        }
      }
    }

    // Step 6 — world locale short code → DashScope `language_type`.
    const languageType = typeof rawLanguage === 'string' ? (LANGUAGE_MAP[rawLanguage] ?? 'Auto') : 'Auto';

    // Character-local voice gets first refusal; an unavailable service falls
    // through to the existing online provider without exposing credentials.
    const local = readLocalTtsConfig();
    if (local.baseUrl && typeof characterId === 'string') {
      try {
        const manifest = await store.getManifest();
        const registered = manifest.characters?.some(character => character.id === characterId);
        let declared: Record<string, unknown> = {};
        if (registered && /^[a-z0-9][a-z0-9-]*$/.test(characterId)) {
          try { declared = parseFrontmatter(await store.readFile(`characters/${characterId}/README.md`)).frontmatter ?? {}; } catch { /* legacy */ }
        }
        const override = (process.env.AIRP_TTS_CHARACTER_VOICES ?? '').split(',').some(pair => pair.trim().startsWith(`${characterId}=`));
        const selected = characterLocalVoice(characterId, declared.voice, declared.gender)
          ?? (!override && isLocalTtsCharacter(manifest.id, characterId) ? local.voice : null);
        if (registered && selected) {
          const localConfig = { ...local, voice: selected };
          const language = typeof rawLanguage === 'string' && rawLanguage in LANGUAGE_MAP ? rawLanguage : 'auto';
          const emotion = localTtsEmotion(rawEmotion);
          const localFile = `${localTtsHash(localConfig, text, language, emotion)}.wav`;
          const localAbs = path.join(store.worldRoot, '.airpworld', 'tts-cache', localFile);
          const cached = existsSync(localAbs);
          if (!cached) await writeAtomic(localAbs, await synthesiseLocal(localConfig, text, language, emotion));
          return res.json({ ok: true, url: `/api/tts/audio/${localFile}`, cached, characters: text.length, truncated });
        }
      } catch (error) {
        const reason = error instanceof LocalTtsError ? error.message : error instanceof Error ? error.name : 'Error';
        console.warn(`[AIRP TTS] Local character TTS failed (${reason}); falling back to online TTS.`);
        res.setHeader('X-AIRP-TTS-Fallback', 'local-to-online');
      }
    }

    // Step 7 — cache lookup. `existsSync` (not `stat`) is enough: atomic writes
    // guarantee "present ⇒ complete".
    const instructions = deliveryInstructions(config.model, voice);
    const hash = hashOf(config.model, voice, languageType, text, instructions);
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

    // Step 8 — key check comes AFTER the cache probe on purpose: an already
    // synthesised page keeps playing even if the key was withdrawn.
    if (!config.apiKey) {
      console.warn('[AIRP TTS] Online TTS unavailable: DASHSCOPE_API_KEY is not set.');
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
      // The reason ("DashScope HTTP 429", a timeout…) carries no key or URL.
      console.warn(`[AIRP TTS] Online TTS failed (${mapped.code}: ${mapped.error}).`);
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
