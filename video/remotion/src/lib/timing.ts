export const FPS = 30;
export const BPM = 120;
/** Frames per beat (15 at 30fps / 120bpm). Every hard cut should land on a multiple of this. */
export const BEAT = (FPS * 60) / BPM;
export const W = 1920;
export const H = 1080;

export const sec = (s: number) => Math.round(s * FPS);
export const beats = (n: number) => Math.round(n * BEAT);

/**
 * Act boundaries in seconds — must match video/SCRIPT.md and the music (track A, spliced to 156s).
 * v6: the voice demo grew by 6s for a third character (Wataru), so every later act moved +6s.
 */
export const SECTIONS = {
  A1: [0, 17], // stories were always worlds: read / play / talk → "live"
  A2: [17, 33], // key press → one canvas (writer cursor) → cast
  A3: [33, 53], // they talk back (STT → TTS): Vera, Nanami, Wataru
  A4: [53, 96], // launcher + four worlds
  A5: [96, 124], // infinite exploration: Moonlit Pact, nook, pull-back
  A6: [124, 142], // next: multiplayer, writer writes code
  A7: [142, 156], // formula + logo + credit
} as const;

export type SectionId = keyof typeof SECTIONS;
export const sectionFrom = (id: SectionId) => sec(SECTIONS[id][0]);
export const sectionLength = (id: SectionId) => sec(SECTIONS[id][1] - SECTIONS[id][0]);
export const TOTAL = sec(156);
