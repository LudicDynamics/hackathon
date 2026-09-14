import durations from "./durations.json";

/** Seconds of a looping clip in public/ (all character and background loops are 6s unless measured otherwise). */
export const dur = (p: string) => (durations as Record<string, number>)[p] ?? 6;

export type CastId = "vera" | "sumi" | "nanami" | "watson" | "seraphina" | "ryo";
export type Cast = { id: CastId; name: string; clip: string; bg: string; portrait: string; tint: string };

export const CAST: Cast[] = [
  { id: "vera", name: "VERA", clip: "cast/vera.webm", bg: "bg/wuwu/lighthouse.webm", portrait: "portraits/vera.webp", tint: "#8B6CFF" },
  { id: "sumi", name: "SUMI", clip: "cast/sumi.webm", bg: "bg/first-snow/snowfall.webm", portrait: "portraits/sumi-yukimura.webp", tint: "#C9A2C8" },
  { id: "nanami", name: "NANAMI", clip: "cast/nanami.webm", bg: "bg/first-snow/studio.webm", portrait: "portraits/nanami.webp", tint: "#E0503C" },
  { id: "watson", name: "WATSON", clip: "cast/watson.webm", bg: "bg/whitechapel/intro.webm", portrait: "portraits/watson.webp", tint: "#C79A55" },
  { id: "seraphina", name: "SERAPHINA", clip: "cast/seraphina.webm", bg: "scenes/magic-academy-academy-library.webp", portrait: "portraits/seraphina.webp", tint: "#E0662A" },
  { id: "ryo", name: "RYO", clip: "cast/ryo.webm", bg: "bg/divergence/y1994.webm", portrait: "portraits/ryo-child.webp", tint: "#4FB38A" },
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
