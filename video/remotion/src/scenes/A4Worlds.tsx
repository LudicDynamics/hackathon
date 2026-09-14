import React from "react";
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage, Media } from "../components/Media";
import { CursorAvatar, Flash, Slam } from "../components/Kit";
import { AxisIcon } from "../components/Icons";
import { cast, WORLDS, type World } from "../lib/assets";
import { INK, ORANGE, PAPER } from "../lib/theme";
import { LauncherSlot } from "./parts/LauncherSlot";

// ACT 4 · "Pick a world." — the launcher (0–150), then four worlds (10s, 10s, 10s, 8s).

export const LAUNCH = 150;
type Beats = { t: number; b: number; c: number; d: number; e: number };
const TEN: Beats = { t: 30, b: 75, c: 60, d: 90, e: 45 };
const EIGHT: Beats = { t: 30, b: 60, c: 45, d: 75, e: 30 };
export const BLOCKS: { w: World; beats: Beats }[] = [
  { w: WORLDS[0], beats: TEN },
  { w: WORLDS[1], beats: TEN },
  { w: WORLDS[2], beats: TEN },
  { w: WORLDS[3], beats: EIGHT },
];
const total = (b: Beats) => b.t + b.b + b.c + b.d + b.e;
export const blockFrom = (i: number) => LAUNCH + BLOCKS.slice(0, i).reduce((a, x) => a + total(x.beats), 0);

const TitleCard: React.FC<{ w: World }> = ({ w }) => {
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
    <Sequence from={k.t + k.b + k.c + k.d} durationInFrames={k.e}>
      <Payoff w={w} />
    </Sequence>
    <Flash at={0} len={2} />
    <Flash at={k.t + k.b + k.c + k.d} len={2} />
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
