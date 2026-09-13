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
