import React from "react";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage, Media } from "../components/Media";
import { CursorAvatar, Flash, Slam } from "../components/Kit";
import { AxisIcon } from "../components/Icons";
import { cast, WORLDS, type World } from "../lib/assets";
import { sec } from "../lib/timing";
import { INK, ORANGE } from "../lib/theme";

export const BLOCK = sec(12);
// title / enter / main view / core verb / payoff  (all multiples of a beat)
const T = 45;
const B = 75;
const C = 75;
const D = 105;
const E = BLOCK - T - B - C - D; // 60

const TitleCard: React.FC<{ w: World }> = ({ w }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hero = cast(w.hero);
  const inn = spring({ frame: f - 4, fps, config: { damping: 15, stiffness: 160 } });
  const icon = spring({ frame: f, fps, config: { damping: 10, stiffness: 300 } });
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "brightness(.5)", transform: `scale(${1.15 - f * 0.003})` }}>
        <Media src={w.map} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 130, gap: 30 }}>
        <div style={{ transform: `scale(${icon})`, transformOrigin: "0 50%" }}>
          <AxisIcon axis={w.axis} size={150} color={ORANGE} />
        </div>
        <Slam text={w.title} size={Math.min(230, 1900 / w.title.length)} delay={2} />
      </AbsoluteFill>
      <div style={{ position: "absolute", right: -20, bottom: -40, width: 600, height: 800, transform: `translateX(${(1 - inn) * 700}px)` }}>
        <Media src={hero.clip} transparent fit="contain" position="50% 100%" />
      </div>
    </AbsoluteFill>
  );
};

const Payoff: React.FC<{ w: World }> = ({ w }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hero = cast(w.hero);
  const pop = spring({ frame: f - 10, fps, config: { damping: 11, stiffness: 240 } });
  return (
    <AbsoluteFill>
      <Footage slot={`r${w.n}-e`} />
      <div style={{ position: "absolute", right: 150, bottom: 150, transform: `scale(${pop})` }}>
        <CursorAvatar portrait={hero.portrait} color={hero.tint} x={0} y={0} size={190} dots />
      </div>
    </AbsoluteFill>
  );
};

const WorldBlock: React.FC<{ w: World }> = ({ w }) => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={T}>
      <TitleCard w={w} />
    </Sequence>
    <Sequence from={T} durationInFrames={B}>
      <Footage slot={`r${w.n}-b`} />
    </Sequence>
    <Sequence from={T + B} durationInFrames={C}>
      <Footage slot={`r${w.n}-c`} push={0.1} />
    </Sequence>
    <Sequence from={T + B + C} durationInFrames={D}>
      <Footage slot={`r${w.n}-d`} push={0.12} />
    </Sequence>
    <Sequence from={T + B + C + D} durationInFrames={E}>
      <Payoff w={w} />
    </Sequence>
    <Flash at={0} len={2} />
    <Flash at={T + B + C + D} len={2} />
  </AbsoluteFill>
);

export const S4Worlds: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {WORLDS.map((w, i) => (
      <Sequence key={w.n} from={i * BLOCK} durationInFrames={BLOCK} name={w.title}>
        <WorldBlock w={w} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
