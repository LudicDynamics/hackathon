export const FPS = 30;
export const BPM = 120;
/** Frames per beat (15 at 30fps / 120bpm). Every hard cut should land on a multiple of this. */
export const BEAT = (FPS * 60) / BPM;
export const W = 1920;
export const H = 1080;

export const sec = (s: number) => Math.round(s * FPS);
export const beats = (n: number) => Math.round(n * BEAT);

/**
 * Act boundaries in seconds — must match video/SCRIPT.md and the music (track A, spliced to 224s).
 * v13: the voice demo lost its dead air after Ei (30 → 28s); Fogwharf got room to breathe (24 → 34s).
 * v15: the Ei mock became the real Elias footage — a voiced reply, a GPT Live call, the ticket landing in the world (28 → 40s).
 * v16: Fogwharf tells its story — narrated beats and Vera's lines in full, with what you said first (34 → 64s).
 */
export const SECTIONS = {
  A1: [0, 17], // stories were always worlds: read / play / talk → "live"
  A2: [17, 33], // key press → one canvas (writer agent's cursor) → cast
  A3: [33, 73], // they talk back: Vera, Nanami, Wataru (TTS mock), then Elias for real (voice, GPT Live, item saved)
  A4: [73, 164], // launcher + Fogwharf 64s, First Snow 10s (two endings), Divergence 12s
  A5: [164, 192], // infinite exploration: Moonlit Pact, nook, pull-back
  A6: [192, 210], // next: multiplayer, the writer agent writes code
  A7: [210, 224], // formula + logo + credit
} as const;

export type SectionId = keyof typeof SECTIONS;
export const sectionFrom = (id: SectionId) => sec(SECTIONS[id][0]);
export const sectionLength = (id: SectionId) => sec(SECTIONS[id][1] - SECTIONS[id][0]);
export const TOTAL = sec(224);
