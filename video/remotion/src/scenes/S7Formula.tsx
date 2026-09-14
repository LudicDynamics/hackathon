import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards } from "../components/Canvas";
import { Code, Face, Grid } from "../components/Icons";
import { CursorAvatar, Flash, PlayerCursor, Slam } from "../components/Kit";
import { CAST } from "../lib/assets";
import { DISPLAY, INK, ORANGE, PAPER, PLAYERS } from "../lib/theme";
import { burstScale } from "./S0ColdOpen";

// Relative to 2:17. Music: silent beat 0–15, hits at 30 / 60 / 90 / 120, groove returns at 180, final hit at 330.
const TERMS = [
  { word: "SANDBOX", Icon: Grid, at: 30 },
  { word: "AGENTS", Icon: Face, at: 60 },
  { word: "CODE", Icon: Code, at: 90 },
];
const EQUALS = 120;
const REPRISE = 180;
const LOGO = 330;

const Equation: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const collapse = interpolate(f, [EQUALS + 10, EQUALS + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inf = spring({ frame: f - (EQUALS + 30), fps, config: { damping: 10, stiffness: 200 } });
  const blowUp = interpolate(f, [REPRISE - 12, REPRISE], [1, 14], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${1 - collapse * 0.7})`, opacity: 1 - collapse }}>
        {TERMS.map(({ word, Icon, at }, i) => {
          const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 320 } });
          if (f < at) return null;
          return (
            <React.Fragment key={word}>
              {i > 0 && <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color: ORANGE }}>+</div>}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `scale(${interpolate(s, [0, 1], [1.5, 1])})` }}>
                <Icon size={130} color={PAPER} />
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 104, color: PAPER, letterSpacing: -4 }}>{word}</div>
              </div>
            </React.Fragment>
          );
        })}
        {f >= EQUALS && <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color: ORANGE }}>=</div>}
      </div>
      {f >= EQUALS + 30 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${inf * blowUp})` }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 520, color: ORANGE, lineHeight: 1 }}>∞</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** Echo of the cold open, but now everyone is on the canvas at once. */
const Reprise: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cards = useMemo(() => layoutCards({ radius: 16, seed: "s7", density: 0.62, center: "scenes/first-snow-first-snow.webp" }), []);
  const scale = burstScale(f, 0, 60, 3.4, 0.14);
  return (
    <CanvasWorld
      cam={{ x: 0, y: 0, scale }}
      cards={cards}
      appear={(c) => spring({ frame: f - c.ring * 2.5, fps, config: { damping: 13, stiffness: 260 } })}
      overlay={
        <>
          {f > 30 &&
            CAST.map((c, i) => {
              const a = (i / CAST.length) * Math.PI * 2 + f / 60;
              const r = 300 + 120 * Math.sin(f / 20 + i);
              return <CursorAvatar key={c.id} portrait={c.portrait} color={c.tint} size={100} x={960 + Math.cos(a) * r * 1.6} y={540 + Math.sin(a) * r} />;
            })}
          {f > 40 &&
            PLAYERS.map((col, i) => (
              <PlayerCursor key={col} color={col} x={960 + 700 * Math.sin(f / 33 + i * 1.7)} y={540 + 360 * Math.cos(f / 27 + i * 2.3)} />
            ))}
        </>
      }
    />
  );
};

export const S7Formula: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={REPRISE}>
      <Equation />
    </Sequence>
    <Sequence from={REPRISE} durationInFrames={LOGO - REPRISE}>
      <Reprise />
    </Sequence>
    <Sequence from={LOGO}>
      <AbsoluteFill style={{ background: INK, alignItems: "center", justifyContent: "center" }}>
        <Slam text="WORLDLINES" size={230} />
      </AbsoluteFill>
    </Sequence>
    {TERMS.map((t) => (
      <Flash key={t.word} at={t.at} len={1} />
    ))}
    <Flash at={REPRISE} len={2} />
    <Flash at={LOGO} len={2} />
  </AbsoluteFill>
);
