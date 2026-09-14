export const FPS = 30;
export const BPM = 120;
/** Frames per beat (15 at 30fps / 120bpm). Every hard cut should land on a multiple of this. */
export const BEAT = (FPS * 60) / BPM;
export const W = 1920;
export const H = 1080;

export const sec = (s: number) => Math.round(s * FPS);
export const beats = (n: number) => Math.round(n * BEAT);

/** Section boundaries in seconds — must match video/README.md and music-cues.json. */
export const SECTIONS = {
  S0: [0, 3],
  S1: [3, 15],
  S2: [15, 27],
  S3: [27, 39],
  S4: [39, 87],
  S5: [87, 112],
  S6: [112, 137],
  S7: [137, 150],
} as const;

export type SectionId = keyof typeof SECTIONS;
export const sectionFrom = (id: SectionId) => sec(SECTIONS[id][0]);
export const sectionLength = (id: SectionId) => sec(SECTIONS[id][1] - SECTIONS[id][0]);
export const TOTAL = sec(150);
