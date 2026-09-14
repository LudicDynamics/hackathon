import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards } from "../components/Canvas";
import { Face, Grid, RoleplayIcon } from "../components/Icons";
import { CursorAvatar, Flash, PlayerCursor, Slam, WorldlinesMark } from "../components/Kit";
import { CAST } from "../lib/assets";
import { DISPLAY, INK, ORANGE, PAPER, PLAYERS } from "../lib/theme";
import { burstScale } from "./S0ColdOpen";

// ACT 7 · SANDBOX + AGENTS + AI ROLEPLAY = WORLDLINES · INFINITE CANVAS.
// Relative to 2:16. Music: silent beat 0–15, hits at 30 / 60 / 90, hit + swell at 120, groove 180, final hit at 240.
const TERMS = [
  { word: "SANDBOX", Icon: Grid, at: 30 },
  { word: "AGENTS", Icon: Face, at: 60 },
  { word: "AI ROLEPLAY", Icon: RoleplayIcon, at: 90 },
];
const EQUALS = 120;
const REPRISE = 180;
const LOGO = 240;

const Equation: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lift = interpolate(f, [EQUALS, EQUALS + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `translateY(${-lift * 250}px) scale(${1 - lift * 0.35})` }}>
        {TERMS.map(({ word, Icon, at }, i) => {
          if (f < at) return null;
          const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 320 } });
          return (
            <React.Fragment key={word}>
              {i > 0 && <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 110, color: ORANGE }}>+</div>}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, transform: `scale(${interpolate(s, [0, 1], [1.5, 1])})` }}>
                <Icon size={120} color={PAPER} />
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 96, color: PAPER, letterSpacing: -3, wordSpacing: 22, whiteSpace: "nowrap" }}>{word}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {f >= EQUALS && (
        <div style={{ position: "absolute", top: 520, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 110, color: ORANGE, lineHeight: 1 }}>=</div>
          <WorldlinesMark size={190} delay={EQUALS + 6} />
          <Slam text="INFINITE CANVAS" size={70} color={ORANGE} delay={EQUALS + 14} style={{ letterSpacing: 10 }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Echo of the cold open, with everyone on the canvas at once. */
const Reprise: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = useMemo(() => layoutCards({ radius: 16, seed: "a7", density: 0.62, center: "scenes/moonlit-opening.png" }), []);
  return (
    <CanvasWorld
      cam={{ x: 0, y: 0, scale: burstScale(f, 0, 45, 3.4, 0.14) }}
      cards={cards}
      appear={(c) => spring({ frame: f - c.ring * 2.2, fps, config: { damping: 13, stiffness: 260 } })}
      overlay={
        <>
          {f > 20 &&
            CAST.map((c, i) => {
              const a = (i / CAST.length) * Math.PI * 2 + f / 40;
              const r = 300 + 100 * Math.sin(f / 15 + i);
              return <CursorAvatar key={c.id} portrait={c.portrait} position={c.face} color={c.tint} size={100} x={960 + Math.cos(a) * r * 1.6} y={540 + Math.sin(a) * r} />;
            })}
          {f > 25 && PLAYERS.map((col, i) => <PlayerCursor key={col} color={col} x={960 + 700 * Math.sin(f / 25 + i * 1.7)} y={540 + 360 * Math.cos(f / 21 + i * 2.3)} />)}
        </>
      }
    />
  );
};

const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const fade = (a: number) => interpolate(f, [a, a + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center", gap: 20 }}>
      <WorldlinesMark size={230} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, letterSpacing: 14, color: ORANGE, opacity: fade(20) }}>INFINITE CANVAS</div>
      {/* Studio credit, quieter than the product name. */}
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: fade(55) }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: 8, color: PAPER, opacity: 0.85 }}>BUILT BY LUDICDYNAMICS</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 26, letterSpacing: 1, color: PAPER, opacity: 0.55 }}>From Tokyo, to the world.</div>
      </div>
    </AbsoluteFill>
  );
};

export const A7Formula: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={REPRISE}>
      <Equation />
    </Sequence>
    <Sequence from={REPRISE} durationInFrames={LOGO - REPRISE}>
      <Reprise />
    </Sequence>
    <Sequence from={LOGO}>
      <Logo />
    </Sequence>
    {TERMS.map((t) => (
      <Flash key={t.word} at={t.at} len={1} />
    ))}
    <Flash at={EQUALS} len={1} />
    <Flash at={REPRISE} len={2} />
    <Flash at={LOGO} len={2} />
  </AbsoluteFill>
);
