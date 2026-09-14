import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards } from "../components/Canvas";
import { Quill } from "../components/Icons";
import { Flash, PlayerCursor } from "../components/Kit";
import { INK, ORANGE, PAPER } from "../lib/theme";
import { W } from "../lib/timing";

const PRESS = 14; // cursor clicks, key bottoms out
const BURST = 24; // the canvas starts unfolding
const SETTLE = 80;
const S_START = 3.4; // the centre card fills the frame
const S_END = 0.06; // the whole canvas is a field of specks

/** Aggressive exponential pull-out: most of the distance is covered in the first half second. */
export const burstScale = (f: number, from = BURST, to = SETTLE, s0 = S_START, s1 = S_END) => {
  const t = interpolate(f, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.exp) });
  const drift = f > to ? 1 - (f - to) * 0.004 : 1;
  return s0 * Math.pow(s1 / s0, t) * drift;
};

const Keycap: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame: f, fps, config: { damping: 14 } });
  const press = spring({ frame: f - PRESS, fps, config: { damping: 9, stiffness: 420 } });
  const side = 40 - press * 30;
  return (
    <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 560,
          height: 560,
          borderRadius: 104,
          background: PAPER,
          transform: `scale(${interpolate(intro, [0, 1], [1.3, 1])}) translateY(${press * 30}px)`,
          boxShadow: `0 ${side}px 0 #a79f90, 0 ${side + 40}px 90px rgba(0,0,0,.7)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Quill size={270} color={ORANGE} />
      </div>
      <PlayerCursor
        x={interpolate(f, [0, PRESS - 2], [1620, 1010], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}
        y={interpolate(f, [0, PRESS - 2], [1080, 590], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}
        color={ORANGE}
        pressed={f >= PRESS && f < PRESS + 6}
        size={72}
      />
    </AbsoluteFill>
  );
};

const Burst: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Radius 18 (~600 cards): at the settled scale the field reads as a disc of specks; larger crashes the renderer under motion blur.
  const cards = useMemo(() => layoutCards({ radius: 18, seed: "s0", density: 0.6, center: "scenes/wuwu-harbor-chart.webp" }), []);
  // A card pops in the moment the pulling-back camera first reveals it.
  const appearAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const dist = Math.hypot(c.x, c.y);
      let at = 999;
      for (let g = BURST; g <= 90; g++) {
        if (W / 2 / burstScale(g) >= dist * 0.9) {
          at = g;
          break;
        }
      }
      m.set(c.id, c.ring === 0 ? -99 : at);
    }
    return m;
  }, [cards]);
  // Cheap stand-in for camera motion blur: one CSS blur proportional to the zoom speed.
  // (CameraMotionBlur re-renders the whole card field per sample and stalls the renderer.)
  const speed = Math.abs(Math.log(burstScale(f)) - Math.log(burstScale(f - 1)));
  return (
    <AbsoluteFill style={{ filter: `blur(${Math.min(12, speed * 40).toFixed(2)}px)` }}>
      <CanvasWorld
        cam={{ x: 0, y: 0, scale: burstScale(f) }}
        cards={cards}
        appear={(c) => spring({ frame: f - appearAt.get(c.id)!, fps, config: { damping: 13, stiffness: 260 } })}
      />
    </AbsoluteFill>
  );
};

export const S0ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      {f < BURST ? (
        <Keycap />
      ) : (
        <Burst />
      )}
      <Flash at={BURST} len={2} />
    </AbsoluteFill>
  );
};
