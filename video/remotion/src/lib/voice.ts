import voice from "./voice.json";
import { FPS } from "./timing";

/** `text` is what is spoken (Lyra speaks Japanese); `subtitle`, when present, is the English shown on screen. */
export type VoiceLine = { id: string; speaker: string; text: string; subtitle?: string; language?: string; file: string; duration: number };
const LINES = voice as VoiceLine[];

export const line = (id: string) => LINES.find((l) => l.id === id)!;
/** On-screen text for a line — always English. */
export const shown = (id: string) => line(id).subtitle ?? line(id).text;
/** Length of a generated line in frames. */
export const vlen = (id: string) => Math.round(line(id).duration * FPS);

// ── A3 (they talk back): frames relative to the act. Each reply starts right after the question.
// Three exchanges in 20s: Vera → Nanami → Wataru.
export const P1 = 45;
export const V1 = P1 + vlen("player-1") + 12;
export const CUT = V1 + vlen("vera-1") + 4;
export const P2 = CUT + 6;
export const N1 = P2 + vlen("player-2") + 12;
export const CUT2 = N1 + vlen("nanami-1") + 4;
export const P3 = CUT2 + 6;
export const W1 = P3 + vlen("player-3") + 12;

// ── A5 (infinite exploration): frames relative to the act.
// Lyra speaks Japanese (3.5s), so her first line starts earlier to clear her second at LYRA2.
export const LYRA1 = 82;
export const LYRA2 = 195;
export const VERA2 = 610;
