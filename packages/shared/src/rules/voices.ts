/**
 * The voice palette (docs/tts/07 — the ONE mapping table).
 *
 * World content declares a voice by its **effect**, not by DashScope's proper
 * name: `voice: wise-elder`, never `voice: Eldric Sage`. Proper names are
 * unmemorable and typing one wrong mutes the character silently, which is
 * exactly the bug this table was written to kill (docs/tts/07 §0):
 * `Eldric` and `Sage` are NOT voices — `Eldric Sage` is one voice, with a
 * space, and a hand-written name got both halves wrong.
 *
 * Zero dependencies on purpose (same discipline as `rules/characters.ts`): the
 * server route, `tools/check-voices.mjs` and a future voice picker all import
 * this, and none of them should pull in zod or the world store to do it.
 *
 * VERIFICATION: every entry below was synthesised for real against the
 * workspace endpoint on 2026-09-13 (docs/tts/07 §5 records the method). An id
 * that was NOT observed to return audio MUST NOT be added here — an allowlist
 * that admits unverified ids is what turned a typo into silence.
 */

/** Every DashScope qwen3-tts voice is multilingual; gender is the only axis. */
export type VoiceGender = 'female' | 'male';

export interface VoiceEntry {
  /** kebab-case EFFECT name — the only vocabulary world content should use. */
  alias: string;
  /** The DashScope `voice` id that goes on the wire (never written by hand). */
  id: string;
  gender: VoiceGender;
  /** One line describing the SOUND, so a writer can pick without listening. */
  tone: string;
}

/**
 * The palette. Add an entry only after synthesising it (see header) — and note
 * that `alias` MUST stay kebab-case while `id` keeps DashScope's own casing.
 */
export const VOICES: readonly VoiceEntry[] = [
  // ── female ────────────────────────────────────────────────────────────────
  { alias: 'warm-cheerful', id: 'Cherry', gender: 'female', tone: 'Sunny, warm, natural young woman — the friendly default.' },
  { alias: 'gentle-calm', id: 'Serena', gender: 'female', tone: 'Soft-spoken and gentle, quietly attentive.' },
  { alias: 'anime-girlfriend', id: 'Chelsie', gender: 'female', tone: 'Bright anime-style virtual-girlfriend voice.' },
  { alias: 'playful-teasing', id: 'Momo', gender: 'female', tone: 'Playful and teasing, a little mischievous.' },
  { alias: 'sassy-spunky', id: 'Vivian', gender: 'female', tone: 'Sassy and prickly-cute, quick to snap.' },
  { alias: 'refined-thoughtful', id: 'Maia', gender: 'female', tone: 'Composed and intellectual, with warmth underneath.' },
  { alias: 'mature-elegant', id: 'Katerina', gender: 'female', tone: 'Mature and elegant, richly cadenced.' },
  { alias: 'cinematic-american', id: 'Jennifer', gender: 'female', tone: 'Polished, cinematic American English.' },
  { alias: 'shy-sweet', id: 'Mia', gender: 'female', tone: 'Shy, sweet and yielding.' },
  { alias: 'moe-child', id: 'Bunny', gender: 'female', tone: 'High, hyper-cute cartoon-girl voice.' },
  { alias: 'bold-resonant', id: 'Bellona', gender: 'female', tone: 'Loud and clear; carries across a room.' },
  { alias: 'magical-girl', id: 'Stella', gender: 'female', tone: 'Sweet and dreamy until it turns heroic.' },
  { alias: 'girl-next-door', id: 'Nini', gender: 'female', tone: 'Sweet and affectionate, the girl next door.' },
  { alias: 'soothing-whisper', id: 'Seren', gender: 'female', tone: 'Slow and soothing — a sleep-aid voice.' },
  { alias: 'child-innocent', id: 'Bella', gender: 'female', tone: 'Small child: innocent and bright.' },
  { alias: 'spirited-girlfriend', id: 'Ono Anna', gender: 'female', tone: 'Wry, spirited childhood-friend voice.' },

  // ── male ──────────────────────────────────────────────────────────────────
  { alias: 'warm-energetic', id: 'Ethan', gender: 'male', tone: 'Sunny, warm, energetic young man.' },
  { alias: 'cool-composed', id: 'Moon', gender: 'male', tone: 'Cool and detached, effortlessly confident.' },
  { alias: 'soothing-smooth', id: 'Kai', gender: 'male', tone: 'Low and smooth — calm, relaxing read.' },
  { alias: 'casual-drawl', id: 'Nofish', gender: 'male', tone: 'Relaxed and casual, faintly mumbled.' },
  { alias: 'dramatic-theatrical', id: 'Ryan', gender: 'male', tone: 'Heightened and theatrical, full of tension.' },
  { alias: 'friendly-american', id: 'Aiden', gender: 'male', tone: 'Easygoing American young man.' },
  { alias: 'wise-elder', id: 'Eldric Sage', gender: 'male', tone: 'Old and steady, deeply experienced — calm authority.' },
  { alias: 'hoarse-weathered', id: 'Vincent', gender: 'male', tone: 'Hoarse and smoky, weathered by years.' },
  { alias: 'news-anchor', id: 'Neil', gender: 'male', tone: 'Flat and precise, a professional news-reader.' },
  { alias: 'scholarly-narrator', id: 'Elias', gender: 'male', tone: 'Measured lecturer: clear and instructive.' },
  { alias: 'rustic-storyteller', id: 'Arthur', gender: 'male', tone: 'Rustic elder, unhurried, telling old tales.' },
  { alias: 'precocious-child', id: 'Mochi', gender: 'male', tone: 'Clever child: small but unnervingly articulate.' },
  { alias: 'deep-magnetic', id: 'Andre', gender: 'male', tone: 'Deep and magnetic, comfortably steady.' },
  { alias: 'sportscaster', id: 'Radio Gol', gender: 'male', tone: 'Fast and excited sports-commentary delivery.' },

  // ── regional accents ──────────────────────────────────────────────────────
  { alias: 'shanghai-auntie', id: 'Jada', gender: 'female', tone: 'Shanghainese: brisk and no-nonsense.' },
  { alias: 'sichuan-sweetheart', id: 'Sunny', gender: 'female', tone: 'Sichuan-accented, sweet and warm.' },
  { alias: 'cantonese-sweetheart', id: 'Kiki', gender: 'female', tone: 'Cantonese: sweet and friendly.' },
  { alias: 'beijing-youth', id: 'Dylan', gender: 'male', tone: 'Beijing-accented young man.' },
  { alias: 'nanjing-uncle', id: 'Li', gender: 'male', tone: 'Nanjing-accented, patient and gentle.' },
  { alias: 'shaanxi-elder', id: 'Marcus', gender: 'male', tone: 'Shaanxi-accented, terse and grounded.' },
  { alias: 'minnan-uncle', id: 'Roy', gender: 'male', tone: 'Minnan-accented, wry and streetwise.' },
  { alias: 'tianjin-comic', id: 'Peter', gender: 'male', tone: 'Tianjin-accented comic patter.' },
  { alias: 'sichuan-local', id: 'Eric', gender: 'male', tone: 'Sichuan-accented, lively local man.' },
  { alias: 'cantonese-uncle', id: 'Rocky', gender: 'male', tone: 'Cantonese: humorous and chatty.' },
];

/** alias → entry. Module-private; callers go through `resolveVoice`. */
const BY_ALIAS = new Map(VOICES.map((v) => [v.alias, v]));
/** id → entry (DashScope's own casing, spaces included). */
const BY_ID = new Map(VOICES.map((v) => [v.id, v]));

/** The palette size, for tests/gates that must not pass vacuously. */
export const VOICE_COUNT = VOICES.length;

/**
 * Resolve a declared voice to the wire id.
 *
 * Accepts BOTH vocabularies, because both flow through here:
 *   - an effect alias (`wise-elder`) → its DashScope id;
 *   - a raw id already in the palette (`Eldric Sage`) → itself, unchanged.
 *
 * Anything else returns `null` — that is the point. A near-miss (`Eldric`,
 * `Sage`, `cherry`) is NOT silently accepted: the caller warns, falls back to
 * the server default, and `tools/check-voices.mjs` fails the build so the
 * typo can never ship (docs/tts/07 §3).
 */
export function resolveVoice(name: string): string | null {
  const alias = BY_ALIAS.get(name);
  if (alias) return alias.id;
  return BY_ID.has(name) ? name : null;
}

/** The palette entry behind a declared voice, alias or raw id (undefined if unknown). */
export function voiceEntry(name: string): VoiceEntry | undefined {
  return BY_ALIAS.get(name) ?? BY_ID.get(name);
}

// ── GPT-Live realtime-call voices (docs/live-voice/00 §2.6) ──────────────────
//
// The nook realtime call (third voice channel) speaks through OpenAI's
// `gpt-live-1`, whose voice vocabulary is NOT DashScope's. This block extends
// the ONE mapping table rather than opening a second one: a parallel alias
// table is exactly the "two truths" drift the header warns about.
//
// VERIFICATION: every name below returned HTTP 201 from
// `POST /v1/live/sessions` on 2026-09-14 (docs/live-voice/00 §12 P5/P6).
// An illegal name is a HARD 403, so a name that was not observed to open a
// session MUST NOT be added here — same discipline as the palette above.

/** The GPT-Live voices an AIRP character call may use (probe-verified). */
export const LIVE_VOICES: readonly string[] = [
  // OpenAI's own gpt-live-1 set (12).
  'quartz', 'ripple', 'vesper', 'willow', 'stone', 'gleam',
  'meridian', 'bossa', 'tempo', 'beacon', 'delta', 'cinder',
  // Realtime-era voices also accepted by gpt-live-1 (10).
  'marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral',
  'echo', 'sage', 'shimmer', 'verse',
];

/** Voice used when a character declares none, or declares an unknown one. */
export const DEFAULT_LIVE_VOICE = 'marin';

const LIVE_VOICE_SET = new Set(LIVE_VOICES);

/**
 * alias → GPT-Live voice. Written out per alias on purpose (docs/live-voice/00
 * L-C1): collapsing to "one voice per gender" would make two same-gender
 * characters in one world sound identical. Reuse is allowed and deliberate —
 * 40 DashScope effects do not fit 22 Live voices.
 *
 * The gender split below follows OpenAI's published voice descriptions
 * [INFERENCE] — it is a pragmatic cast, NOT an acoustically verified one.
 * Whoever next listens to a call SHOULD correct a misgendered row here.
 */
const LIVE_BY_ALIAS: Readonly<Record<string, string>> = {
  // ── female ────────────────────────────────────────────────────────────────
  'warm-cheerful': 'marin',
  'gentle-calm': 'sage',
  'anime-girlfriend': 'ballad',
  'playful-teasing': 'coral',
  'sassy-spunky': 'shimmer',
  'refined-thoughtful': 'willow',
  'mature-elegant': 'vesper',
  'cinematic-american': 'marin',
  'shy-sweet': 'ballad',
  'moe-child': 'coral',
  'bold-resonant': 'quartz',
  'magical-girl': 'shimmer',
  'girl-next-door': 'marin',
  'soothing-whisper': 'sage',
  'child-innocent': 'ballad',
  'spirited-girlfriend': 'coral',
  'shanghai-auntie': 'vesper',
  'sichuan-sweetheart': 'ripple',
  'cantonese-sweetheart': 'gleam',

  // ── male ──────────────────────────────────────────────────────────────────
  'warm-energetic': 'cedar',
  'cool-composed': 'alloy',
  'soothing-smooth': 'ash',
  'casual-drawl': 'echo',
  'dramatic-theatrical': 'verse',
  'friendly-american': 'cedar',
  'wise-elder': 'stone',
  'hoarse-weathered': 'stone',
  'news-anchor': 'alloy',
  'scholarly-narrator': 'alloy',
  'rustic-storyteller': 'stone',
  'precocious-child': 'echo',
  'deep-magnetic': 'verse',
  'sportscaster': 'echo',
  'beijing-youth': 'cedar',
  'nanjing-uncle': 'ash',
  'shaanxi-elder': 'meridian',
  'minnan-uncle': 'beacon',
  'tianjin-comic': 'delta',
  'sichuan-local': 'cinder',
  'cantonese-uncle': 'bossa',
};

/**
 * Resolve a character's declared `voice` to a GPT-Live voice name.
 *
 * Accepts the same two vocabularies as `resolveVoice` (an effect alias or a
 * raw DashScope id), because both flow through `characters/<id>/README.md`.
 * Anything missing or unknown falls back to `DEFAULT_LIVE_VOICE` — unlike
 * `resolveVoice`, this NEVER returns null: the call has to pick a voice, and a
 * missing one is normal (some characters declare none).
 */
export function resolveLiveVoice(name: string | undefined): string {
  if (!name) return DEFAULT_LIVE_VOICE;
  const entry = voiceEntry(name);
  const mapped = entry ? LIVE_BY_ALIAS[entry.alias] : undefined;
  return mapped !== undefined && LIVE_VOICE_SET.has(mapped) ? mapped : DEFAULT_LIVE_VOICE;
}
