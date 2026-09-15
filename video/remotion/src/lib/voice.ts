import voice from "./voice.json";
import { LANG } from "./lang";
import { FPS } from "./timing";

/** On-screen text for the Chinese cut (bubbles in A3, subtitles in A5); the voices stay as they are. */
const ZH: Record<string, string> = {
  "player-1": "Vera，你在灯塔发现了什么？",
  "vera-1": "十二分钟的黑暗。有人想让港口失明。",
  "player-2": "Nanami，下雪了吗？",
  "nanami-1": "刚开始下！快上天台来！",
  "player-3": "Wataru，你在等我吗？",
  "wataru-1": "……我没在等。只是刚好帮你留了座。",
  "lyra-1": "我是 Lyra。为守护你而来。",
  "lyra-2": "你愿意与我缔结契约，共度这一夜吗？",
  "vera-2": "这里啊，是我放那些没能修好的东西的地方。",
};

/** `text` is what is spoken (Lyra speaks Japanese); `subtitle`, when present, is the English shown on screen. */
export type VoiceLine = { id: string; speaker: string; text: string; subtitle?: string; language?: string; file: string; duration: number };
const LINES = voice as VoiceLine[];

export const line = (id: string) => LINES.find((l) => l.id === id)!;
/** On-screen text for a line — always English. */
export const shown = (id: string) => (LANG === "zh" && ZH[id]) || line(id).subtitle || line(id).text;
/** Length of a generated line in frames. */
export const vlen = (id: string) => Math.round(line(id).duration * FPS);

// ── A3 (they talk back): frames relative to the act. Each reply starts right after the question.
// Three mock exchanges (Vera → Nanami → Wataru), then Elias for real. The player speaks with TTS voices too (longer
// than `say`), so gaps are tight: a reply lands 8 frames after the question, the next scene 4 frames after the reply.
const REPLY_GAP = 8;
const SCENE_GAP = 4;
// Starts after the narrated "And they talk back." (33.1–34.9s) so the two voices never overlap.
export const P1 = 55;
export const V1 = P1 + vlen("player-1") + REPLY_GAP;
export const CUT = V1 + vlen("vera-1") + SCENE_GAP;
export const P2 = CUT + SCENE_GAP;
export const N1 = P2 + vlen("player-2") + REPLY_GAP;
export const CUT2 = N1 + vlen("nanami-1") + SCENE_GAP;
export const P3 = CUT2 + SCENE_GAP;
export const W1 = P3 + vlen("player-3") + REPLY_GAP;
export const CUT3 = W1 + vlen("wataru-1") + SCENE_GAP;
// Elias (the team calls him Ei), from the user's recording of his world — not a mock (cuts.ts `el-text`): his voiced
// reply closes the act (to its end, 780). His GPT Live call is its own feature beat later (scenes/ALive.tsx).

// ── A5 (infinite exploration): frames relative to the act.
// Lyra speaks Japanese (3.5s), so her first line starts earlier to clear her second at LYRA2.
export const LYRA1 = 82;
export const LYRA2 = 195;
export const VERA2 = 610;
