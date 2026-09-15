import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage, Media } from "../components/Media";
import { CursorAvatar, Flash, Slam } from "../components/Kit";
import { AxisIcon } from "../components/Icons";
import { cast, WORLDS, type World } from "../lib/assets";
import { DISPLAY, INK, ORANGE, PAPER } from "../lib/theme";
import { LauncherSlot } from "./parts/LauncherSlot";
import { tr } from "../lib/lang";

// ACT 4 · "Pick a world." — the launcher (0–150), then Fogwharf 68s, First Snow 10s, Divergence 12s.
// (Holmes was dropped, v12; its time went to Fogwharf.)

export const LAUNCH = 150;
/** Extra footage beats played between d and e (by slot id). */
type Extra = { slot: string; len: number };
type Beats = { t: number; b: number; c: number; d: number; e: number; extras?: Extra[] };
/** First Snow, 10s from the user's route: studio → street → Nanami's call → the ending CG (the payoff). */
const FIRST_SNOW: Beats = { t: 30, b: 45, c: 45, d: 60, e: 120 };
/**
 * Fogwharf, 68s, everything from the user's 44-minute run in real play order, told as a story (captions.ts). The player
 * types and never speaks, so the narrator says what they asked; Vera answers in her own voice, in full:
 * the case (office) → search for signs (map) → the dice → the player asks why she helps / her answer → the writer agent
 * writes the place the player reasoned toward → the player asks her to come along / 「行くよ、もちろん。」 → the new pier,
 * together → the player spots a new path / 「二隻目だね…」 (her line starts at frame 1200, on the music's crash) → the lantern
 * dock, the player asks whether to turn back / she won't, and says what to check instead → the blue-door hall → out of credits.
 * The music is spliced to these numbers (make-track-a-156.sh): keep the ship at 1200 and the block at 2040.
 */
const FOGWHARF: Beats = {
  t: 30,
  b: 75,
  c: 60,
  d: 90,
  extras: [
    { slot: "r1-ttype", len: 75 },
    { slot: "r1-trust", len: 325 },
    { slot: "r1-writer", len: 160 },
    { slot: "r1-ask", len: 75 },
    { slot: "r1-go", len: 60 },
    { slot: "r1-pier", len: 175 },
    { slot: "r1-stype", len: 75 },
    { slot: "r1-ship", len: 205 },
    { slot: "follow-6", len: 60 },
    { slot: "r1-v1", len: 75 },
    { slot: "r1-v2", len: 66 },
    { slot: "r1-v2b", len: 240 },
    { slot: "follow-7", len: 45 },
  ],
  e: 149,
};
/** Divergence gets 12s: first 2024 visit, the typed line, Ryo's line (real time, her own voice), then the same street
    before and after (the user's two timelines). */
const DIVERGENCE: Beats = { t: 30, b: 60, c: 60, d: 120, e: 90 };
export const BLOCKS: { w: World; beats: Beats }[] = [
  { w: WORLDS[0], beats: FOGWHARF },
  { w: WORLDS[2], beats: FIRST_SNOW },
  { w: WORLDS[3], beats: DIVERGENCE },
];
export const blockIndex = (n: number) => BLOCKS.findIndex((b) => b.w.n === n);
const extrasLen = (b: Beats) => (b.extras ?? []).reduce((a, x) => a + x.len, 0);
const total = (b: Beats) => b.t + b.b + b.c + b.d + extrasLen(b) + b.e;
export const blockFrom = (i: number) => LAUNCH + BLOCKS.slice(0, i).reduce((a, x) => a + total(x.beats), 0);
/** Frame (within A4) where block i's first extra beat starts. */
export const extraFrom = (i: number) => blockFrom(i) + BLOCKS[i].beats.t + BLOCKS[i].beats.b + BLOCKS[i].beats.c + BLOCKS[i].beats.d;
/** Frame (within A4) where block i's payoff (e) starts. */
export const payoffFrom = (i: number) => extraFrom(i) + extrasLen(BLOCKS[i].beats);
/** Frame (within A4) where the extra beat `slot` of block i starts. */
export const slotFrom = (i: number, slot: string) => {
  const xs = BLOCKS[i].beats.extras ?? [];
  const k = xs.findIndex((x) => x.slot === slot);
  return extraFrom(i) + xs.slice(0, Math.max(0, k)).reduce((a, x) => a + x.len, 0);
};
export const slotLen = (i: number, slot: string) => BLOCKS[i].beats.extras?.find((x) => x.slot === slot)?.len ?? 0;

/** Fogwharf's last beat: the run's out-of-credits screen, with what the week cost. */
export const CreditsStat: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 14, stiffness: 260 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: `rgba(10,10,10,${0.55 * s})` }}>
      <div style={{ transform: `scale(${0.9 + 0.1 * s})`, opacity: s, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color: PAPER, letterSpacing: -4 }}>{tr("44-MIN RUN", "一局 44 分钟")}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, color: PAPER, opacity: 0.85 }}>{tr("48M+ tokens this week", "本周 4800 万+ tokens")}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: ORANGE, letterSpacing: 4 }}>{tr("CREDITS: 0", "额度：0")}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Divergence's payoff: the same street in both timelines — original (the user's 2:13), restored (9:06) wiping in. */
export const BeforeAfter: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const x = interpolate(f, [d * 0.25, d * 0.65], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const pill = (text: string, side: "left" | "right", on: boolean): React.ReactNode => (
    <div style={{ position: "absolute", top: 40, [side]: 50, fontFamily: DISPLAY, fontWeight: 900, fontSize: 30, letterSpacing: 6, color: on ? INK : PAPER, background: on ? ORANGE : "rgba(10,10,10,.6)", padding: "8px 18px", borderRadius: 999 }}>
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Footage slot="r4-before" push={0.02} />
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        <Footage slot="r4-after" push={0.02} />
      </AbsoluteFill>
      {x > 0 && x < 100 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 6, marginLeft: -3, background: ORANGE, boxShadow: `0 0 30px ${ORANGE}` }} />}
      {pill("BEFORE", "left", x < 50)}
      {pill("AFTER", "right", x >= 50)}
    </AbsoluteFill>
  );
};

export const TitleCard: React.FC<{ w: World }> = ({ w }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hero = cast(w.hero);
  const inn = spring({ frame: f - 2, fps, config: { damping: 15, stiffness: 190 } });
  const icon = spring({ frame: f, fps, config: { damping: 10, stiffness: 300 } });
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "brightness(.5)", transform: `scale(${1.12 - f * 0.003})` }}>
        <Media src={w.map} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 130, gap: 26 }}>
        <div style={{ transform: `scale(${icon})`, transformOrigin: "0 50%" }}>
          <AxisIcon axis={w.axis} size={140} color={ORANGE} />
        </div>
        <Slam text={w.title} size={Math.min(220, 1800 / w.title.length)} delay={1} />
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 150, top: 140, width: 480, height: 640, background: PAPER, padding: 12, borderRadius: 16, boxShadow: "0 40px 90px rgba(0,0,0,.65)", transform: `translateX(${(1 - inn) * 800}px) rotate(${4 - inn}deg)` }}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }}>
          <Img src={staticFile(hero.portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: hero.frame }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Payoff: React.FC<{ w: World }> = ({ w }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hero = cast(w.hero);
  const pop = spring({ frame: f - 6, fps, config: { damping: 11, stiffness: 240 } });
  if (w.n === 4) return <BeforeAfter />;
  // First Snow ends on the route's ending CG (the other route's CG is covered in text — dropped).
  if (w.n === 3) return <Footage slot="r3-end2" push={0.04} />;
  if (w.n === 1)
    return (
      <AbsoluteFill>
        <Footage slot="r1-e" push={0.03} />
        <CreditsStat />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill>
      <Footage slot={`r${w.n}-e`} />
      <div style={{ position: "absolute", right: 150, top: 150, transform: `scale(${pop})` }}>
        <CursorAvatar portrait={hero.portrait} position={hero.face} color={hero.tint} x={0} y={0} size={180} dots />
      </div>
    </AbsoluteFill>
  );
};

const WorldBlock: React.FC<{ w: World; beats: Beats }> = ({ w, beats: k }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={k.t}>
      <TitleCard w={w} />
    </Sequence>
    <Sequence from={k.t} durationInFrames={k.b}>
      <Footage slot={`r${w.n}-b`} />
    </Sequence>
    <Sequence from={k.t + k.b} durationInFrames={k.c}>
      <Footage slot={`r${w.n}-c`} push={0.1} />
    </Sequence>
    <Sequence from={k.t + k.b + k.c} durationInFrames={k.d}>
      <Footage slot={`r${w.n}-d`} push={0.12} />
    </Sequence>
    {(k.extras ?? []).map((x, i) => (
      <Sequence key={x.slot} from={k.t + k.b + k.c + k.d + (k.extras ?? []).slice(0, i).reduce((a, y) => a + y.len, 0)} durationInFrames={x.len}>
        <Footage slot={x.slot} push={0.05} />
      </Sequence>
    ))}
    <Sequence from={k.t + k.b + k.c + k.d + extrasLen(k)} durationInFrames={k.e}>
      <Payoff w={w} />
    </Sequence>
    <Flash at={0} len={2} />
    <Flash at={k.t + k.b + k.c + k.d + extrasLen(k)} len={2} />
  </AbsoluteFill>
);

export const A4Worlds: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={LAUNCH} name="launcher">
      <LauncherSlot />
    </Sequence>
    {BLOCKS.map(({ w, beats }, i) => (
      <Sequence key={w.n} from={blockFrom(i)} durationInFrames={total(beats)} name={w.title}>
        <WorldBlock w={w} beats={beats} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
