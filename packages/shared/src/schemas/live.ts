import { z } from 'zod';

/**
 * Realtime-call transport shapes (docs/live-voice/00 §2.2).
 *
 * The nook call is the third voice channel: a browser WebRTC media session
 * against `gpt-live-1`, whose delegated backend is the existing pi-rp
 * character agent. These schemas cover only the HTTP seam — the SDP is opaque
 * to us (the server forwards it verbatim to OpenAI) and `sessionId` is opaque
 * in the other direction.
 */

/** The two languages the call front-end is primed for (same domain as TTS). */
export const LIVE_LANGUAGES = ['en', 'ja'] as const;
export type LiveLanguage = (typeof LIVE_LANGUAGES)[number];

/**
 * `POST /api/live/session`. `sdp` is the browser's raw SDP offer; we never
 * parse it. `language` primes the voice front-end's output language and
 * defaults to `en` server-side.
 */
export const LiveSessionInputSchema = z.object({
  character: z.string().min(1),
  sdp: z.string().min(1),
  language: z.enum(LIVE_LANGUAGES).optional(),
}).strict();
export type LiveSessionInput = z.infer<typeof LiveSessionInputSchema>;

/**
 * `POST /api/live/close`. Keyed by `character`, not `sessionId`: a character
 * has at most one live call, so the character id is the stable key while the
 * OpenAI session id stays opaque and server-owned (docs/live-voice/00 §2.2).
 */
export const LiveCloseInputSchema = z.object({
  character: z.string().min(1),
}).strict();
export type LiveCloseInput = z.infer<typeof LiveCloseInputSchema>;
