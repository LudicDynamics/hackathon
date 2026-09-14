import durations from "./durations.json";

/** Seconds of a looping clip in public/ (all character and background loops are 6s unless measured otherwise). */
export const dur = (p: string) => (durations as Record<string, number>)[p] ?? 6;

export type CastId = "vera" | "sumi" | "nanami" | "watson" | "ryo" | "lyra";
export type Cast = {
  id: CastId;
  name: string;
  /** Full illustration (with its own background) — the cast is never shown as a cut-out in the showcase. */
  portrait: string;
  /** object-position for round avatars (face). */
  face: string;
  /** object-position for 3:4 portrait cards. */
  frame: string;
  tint: string;
  /** Transparent standing art — only where the app itself shows it (dialogue close-up). */
  clip?: string;
  bg?: string;
};

export const CAST: Cast[] = [
  { id: "vera", name: "VERA", portrait: "portraits/vera.webp", face: "50% 14%", frame: "50% 30%", tint: "#8B6CFF", clip: "cast/vera.webm", bg: "bg/wuwu/lighthouse.webm" },
  { id: "sumi", name: "SUMI", portrait: "portraits/sumi-yukimura.webp", face: "50% 14%", frame: "50% 30%", tint: "#C9A2C8", clip: "cast/sumi.webm", bg: "bg/first-snow/snowfall.webm" },
  { id: "nanami", name: "NANAMI", portrait: "portraits/nanami.webp", face: "50% 14%", frame: "50% 30%", tint: "#E0503C", clip: "cast/nanami.webm", bg: "bg/first-snow/studio.webm" },
  { id: "watson", name: "WATSON", portrait: "portraits/watson.webp", face: "50% 12%", frame: "50% 30%", tint: "#C79A55", clip: "cast/watson.webm", bg: "bg/whitechapel/intro.webm" },
  { id: "ryo", name: "RYO", portrait: "portraits/ryo-child.webp", face: "50% 14%", frame: "50% 30%", tint: "#4FB38A", clip: "cast/ryo.webm", bg: "bg/divergence/y1994.webm" },
  { id: "lyra", name: "LYRA", portrait: "scenes/moonlit-opening.png", face: "71% 20%", frame: "73% 35%", tint: "#B9B2E8" },
];

export const cast = (id: CastId) => CAST.find((c) => c.id === id)!;

/** Still scene art used to tile the infinite canvas. */
export const SCENES = [
  "divergence-1994-11-02.webp", "divergence-convergence.webp", "divergence-future-original.webp",
  "divergence-future-restored.webp", "divergence-intro.webp", "divergence-shop-daylight.webp",
  "divergence-thirty-years-later.webp", "divergence-tokiwa-electrics.webp", "divergence-tonight.webp",
  "first-snow-amber-cafe.webp", "first-snow-campus-rooftop.webp", "first-snow-first-snow.webp",
  "first-snow-intro.webp", "first-snow-radio-studio.webp", "first-snow-winter-schedule.webp",
  "magic-academy-academy-library.webp", "whitechapel-case-board.webp", "whitechapel-fleet-street-press.webp",
  "whitechapel-fourth-chapter-eve.webp", "whitechapel-fourth.webp", "whitechapel-intro.webp",
  "whitechapel-map.webp", "whitechapel-morgue.webp", "whitechapel-press.webp", "whitechapel-scene3.webp",
  "wuwu-beyond-the-fog.webp", "wuwu-harbor-chart.webp", "wuwu-intro.webp", "wuwu-old-lighthouse.webp",
  "wuwu-seventh-berth.webp", "wuwu-workshop.webp",
].map((f) => `scenes/${f}`);

export type Axis = "place" | "deduce" | "bond" | "time";
export type World = {
  n: 1 | 2 | 3 | 4;
  title: string;
  axis: Axis;
  hero: CastId;
  map: string;
  card: string;
  /** Substrings that may identify this world in captured file names. */
  aliases: string[];
};

export const WORLDS: World[] = [
  { n: 1, title: "FOGWHARF", axis: "place", hero: "vera", map: "bg/wuwu/map.webm", card: "scenes/wuwu-harbor-chart.webp", aliases: ["wuwu", "fogwharf"] },
  { n: 2, title: "HOLMES", axis: "deduce", hero: "watson", map: "bg/whitechapel/map.webm", card: "scenes/whitechapel-map.webp", aliases: ["whitechapel", "holmes"] },
  { n: 3, title: "FIRST SNOW", axis: "bond", hero: "nanami", map: "bg/first-snow/map.webm", card: "scenes/first-snow-first-snow.webp", aliases: ["firstsnow", "first-snow"] },
  { n: 4, title: "DIVERGENCE", axis: "time", hero: "ryo", map: "bg/divergence/map.webm", card: "scenes/divergence-tonight.webp", aliases: ["divergence"] },
];
