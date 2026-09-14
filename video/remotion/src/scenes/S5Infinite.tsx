import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards, toScreen, type CardSpec } from "../components/Canvas";
import { Footage, Media } from "../components/Media";
import { Chip, CursorAvatar, Flash, PlayerCursor, TypingDots } from "../components/Kit";
import { CAST, cast } from "../lib/assets";
import { ORANGE, PAPER } from "../lib/theme";

const DIVE = 90;
const RP = 240;
const WALK = 180;
const PULL = 240;

const vera = cast("vera");
const VERA_CARD: CardSpec = { id: "vera", x: 0, y: 0, w: 230, h: 230, rot: 0, kind: "avatar", src: vera.portrait, ring: 0, tone: vera.tint };

/** Camera dives into Vera's avatar — entering her nook. */
export const DiveIn: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const cards = useMemo(() => [VERA_CARD, ...layoutCards({ radius: 5, seed: "dive", density: 0.5 }).filter((c) => c.ring > 1)], []);
  const t = interpolate(f, [d * 0.2, d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.exp) });
  return <CanvasWorld cam={{ x: 0, y: 0, scale: 0.7 * Math.pow(18 / 0.7, t) }} cards={cards} />;
};

/** Stand-in for R5: RP with Vera while her canvas grows one card at a time. */
export const NookMock: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grown = useMemo(() => layoutCards({ radius: 3.6, seed: "nook", density: 0.95 }).filter((c) => c.ring > 0.9), []);
  const cam = { x: 0, y: 0, scale: 0.72 - f * 0.0006 };
  const order = new Map(grown.map((c, i) => [c.id, i]));
  const v = toScreen(cam, 0, 0);
  const talkingVera = Math.floor(f / 40) % 2 === 1;
  return (
    <CanvasWorld
      cam={cam}
      cards={[VERA_CARD, ...grown]}
      appear={(c) => (c.id === "vera" ? 1 : spring({ frame: f - 10 - order.get(c.id)! * 14, fps, config: { damping: 12, stiffness: 220 } }))}
      overlay={
        <>
          {talkingVera ? (
            <TypingDots color={vera.tint} scale={1.4} style={{ position: "absolute", left: v.x + 90, top: v.y - 160 }} />
          ) : (
            <TypingDots color={ORANGE} scale={1.4} style={{ position: "absolute", left: v.x + 250, top: v.y + 40 }} />
          )}
          <PlayerCursor x={v.x + 200 + 30 * Math.sin(f / 20)} y={v.y + 90 + 20 * Math.cos(f / 25)} color={ORANGE} />
          <Chip text="PLACEHOLDER · R5" style={{ left: 40, top: 36, background: "#333", color: PAPER, fontSize: 20 }} />
        </>
      }
    />
  );
};

/** Stand-in for C6: characters walk the map on their own; Vera follows the player. */
const PresenceMock: React.FC = () => {
  const f = useCurrentFrame();
  const player = (g: number) => ({ x: 960 + 520 * Math.sin(g / 45), y: 560 + 240 * Math.sin(g / 31) });
  const p = player(f);
  const follow = player(f - 14);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "brightness(.62)" }}>
        <Media src="bg/wuwu/map.webm" />
      </AbsoluteFill>
      {CAST.filter((c) => c.id !== "vera").map((c, i) => (
        <CursorAvatar
          key={c.id}
          portrait={c.portrait}
          color={c.tint}
          size={96}
          x={300 + i * 330 + 120 * Math.sin(f / (26 + i * 5) + i)}
          y={300 + (i % 2) * 380 + 90 * Math.cos(f / (33 + i * 4) + i * 2)}
          dots={i === 1 && Math.floor(f / 45) % 2 === 0}
        />
      ))}
      <CursorAvatar portrait={vera.portrait} color={vera.tint} size={110} x={follow.x - 90} y={follow.y + 60} />
      <PlayerCursor x={p.x} y={p.y} color={ORANGE} />
      <Chip text="PLACEHOLDER · C6" style={{ left: 40, top: 36, background: "#333", color: PAPER, fontSize: 20 }} />
    </AbsoluteFill>
  );
};

/** Pull back: the RP patch shrinks while the canvas keeps growing outwards — no edge. */
export const PullBack: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const cards = useMemo(() => [VERA_CARD, ...layoutCards({ radius: 20, seed: "grow", density: 0.6 }).filter((c) => c.ring > 0.9)], []);
  const t = interpolate(f, [0, d], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const scale = 0.9 * Math.pow(0.05 / 0.9, t);
  return (
    <CanvasWorld
      cam={{ x: 0, y: 0, scale }}
      cards={cards}
      appear={(c) => (c.ring < 3 ? 1 : spring({ frame: f - c.ring * 13, fps, config: { damping: 14 } }))}
    >
      <div style={{ position: "absolute", left: -1300, top: -950, width: 2600, height: 1900, borderRadius: 60, border: `${5 / scale}px solid ${ORANGE}`, opacity: 0.9 }} />
    </CanvasWorld>
  );
};

export const S5Infinite: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={DIVE}>
      <DiveIn />
    </Sequence>
    <Sequence from={DIVE} durationInFrames={RP}>
      <Footage slot="r5" fallback={<NookMock />} />
    </Sequence>
    <Sequence from={DIVE + RP} durationInFrames={WALK}>
      <Footage slot="c6" fallback={<PresenceMock />} />
    </Sequence>
    <Sequence from={DIVE + RP + WALK} durationInFrames={PULL}>
      <PullBack />
    </Sequence>
    <Flash at={DIVE - 2} len={3} />
    <Flash at={DIVE + RP} len={1} />
    <Flash at={DIVE + RP + WALK} len={1} />
  </AbsoluteFill>
);
