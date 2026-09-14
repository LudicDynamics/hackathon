import { Router } from 'express';
import {
  LiveCloseInputSchema,
  LiveSessionInputSchema,
  isValidCharacterId,
  nookIdOf,
  parseFrontmatter,
  resolveLiveVoice,
  type LocalWorldStore,
  type LiveLanguage,
} from '@airp/shared';
import {
  LiveCallError,
  readLiveConfig,
  type LiveCallRegistry,
} from '../engine/live-session.js';

/**
 * The realtime-call HTTP seam (docs/live-voice/00 §2.2, §5.13).
 *
 * Three routes, all under the `/api` prefix that `createWorldRouter` and
 * `createTtsRouter` already share. This router owns `/api/live*` and nothing
 * else, so mounting it after those two never shadows them.
 *
 * There is deliberately NO module-level state: every request re-reads env and
 * the active store, the same hard requirement TTS carries (docs/tts/01 §10) —
 * tests set env after import and expect it to take effect.
 *
 * `/api/live/config` MUST answer even with no active world: readiness is about
 * credentials, not about which save is open (docs/live-voice/00 §15.3). Only
 * the session route carries `needsWorld` semantics, and it checks the nook
 * itself rather than relying on `createWorldRouter`'s middleware — that
 * middleware only guards paths inside its own router (world.ts:407-422).
 */
export function createLiveRouter(
  getActiveStore: () => LocalWorldStore | null,
  // The registry is built in `index.ts` (the composition root) so the world
  // router can call `closeAll()` on world switch / save deletion without the
  // two routers importing each other (docs/live-voice/00 §2.4 freeze 3).
  registry: LiveCallRegistry
): Router {
  const router = Router();

  /**
   * Readiness only: never expose the key or the upstream base URL.
   * `available` is false without a key, and the UI hides the call button
   * rather than rendering one that errors on click (docs/live-voice/00 §2.9).
   */
  router.get('/live/config', (_req, res) => {
    const config = readLiveConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ...config });
  });

  /**
   * Open a call: validate, ensure the character agent exists, resolve a voice,
   * create the Live session and attach the sideband.
   *
   * Body: `{ character: string, sdp: string, language?: 'en' | 'ja' }`.
   * Success: `{ ok: true, sessionId, sdp, character, voice }`.
   */
  router.post('/live/session', async (req, res) => {
    const parsed = LiveSessionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        code: 'invalid_argument',
        error: 'character and sdp must be non-empty strings; language is en or ja',
      });
    }
    const { character, sdp } = parsed.data;
    const language: LiveLanguage = parsed.data.language ?? 'en';

    // The id shape is the security boundary (docs/nook/00 §3.2) — same gate as
    // `GET /api/nook` (world.ts:569), before the store is even consulted.
    if (!isValidCharacterId(character)) {
      return res.status(400).json({
        ok: false,
        code: 'invalid_argument',
        error: 'character must be a lower-kebab-case id',
      });
    }

    const store = getActiveStore();
    if (!store) {
      return res.status(409).json({
        ok: false,
        code: 'no_active_world',
        error: 'Choose a world or start a new save.',
      });
    }

    const nookId = nookIdOf(character)!;
    if ((await store.statKind(nookId)) !== 'dir') {
      return res.status(404).json({
        ok: false,
        code: 'not_found',
        error: `No such character: "${character}"`,
      });
    }

    // Voice resolution reads the SAME README `/api/characters` reads, so a
    // character's DashScope voice (docs/tts/07) decides its Live voice through
    // the one mapping table (docs/live-voice/00 §2.6). A missing or unknown
    // voice falls back to the default and the chosen name is echoed back.
    let voice = resolveLiveVoice(undefined);
    try {
      const { frontmatter } = parseFrontmatter(
        await store.readFile(`${nookId}/README.md`)
      );
      const declared = typeof frontmatter?.voice === 'string' ? frontmatter.voice : undefined;
      voice = resolveLiveVoice(declared);
    } catch {
      // No README is not an error here: the call still works on the default voice.
    }

    try {
      const handle = await registry.open({
        characterId: character,
        sdp,
        language,
        voice,
        worldRoot: store.worldRoot,
      });
      return res.json({
        ok: true,
        sessionId: handle.sessionId,
        sdp: handle.sdp,
        character,
        voice: handle.voice,
      });
    } catch (err) {
      const failure =
        err instanceof LiveCallError
          ? err
          : new LiveCallError('internal', 500, err instanceof Error ? err.message : String(err));
      return res.status(failure.status).json({
        ok: false,
        code: failure.code,
        error: failure.message,
      });
    }
  });

  /**
   * Hang up. Keyed by character (a character has at most one call, and the
   * OpenAI session id stays opaque and server-owned). Idempotent: closing a
   * call that already ended is a success, not an error.
   */
  router.post('/live/close', async (req, res) => {
    const parsed = LiveCloseInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        code: 'invalid_argument',
        error: 'character must be a non-empty string',
      });
    }
    if (!isValidCharacterId(parsed.data.character)) {
      return res.status(400).json({
        code: 'invalid_argument',
        error: 'character must be a lower-kebab-case id',
      });
    }
    try {
      await registry.close(parsed.data.character);
    } catch (err) {
      // A failed teardown must not block the browser's cleanup (docs/live-voice/00
      // §5.13): the registry already released its local state in the finally path.
      console.warn(
        `[AIRP Live] close failed for ${parsed.data.character}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return res.json({ ok: true });
  });

  return router;
}

/** Re-exported so `index.ts` can wire world teardown to the same registry type. */
export type { LiveCallRegistry };
