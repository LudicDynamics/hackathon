import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Media } from "../components/Media";
import { Flash, Slam } from "../components/Kit";
import { CAST, type Cast } from "../lib/assets";
import { BEAT } from "../lib/timing";
import { INK, ORANGE, PAPER } from "../lib/theme";

const SOLO = BEAT * 2; // one second per character
const FACES_FROM = SOLO * 6; // 180
const FACE_LEN = BEAT / 2; // half-beat cuts
const GRID_FROM = FACES_FROM + FACE_LEN * 12; // 270
const GRID_LEN = 90;

const CastShot: React.FC<{ c: Cast; i: number }> = ({ c, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dir = i % 2 ? -1 : 1;
  const inn = spring({ frame: f, fps, config: { damping: 15, stiffness: 170 } });
  const size = Math.min(360, 1900 / c.name.length);
  // Push the name away from the character so it reads; long names get less room to move.
  const textW = 0.62 * size * c.name.length;
  const shift = Math.max(0, Math.min(330, (1920 - textW) / 2 - 60));
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1.14 - f * 0.003})`, filter: "brightness(.42) saturate(1.15)" }}>
        <Media src={c.bg} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateX(${-dir * shift}px)` }}>
        <Slam text={c.name} size={size} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: "50%",
          width: 880,
          height: 1174,
          transform: `translateX(calc(-50% + ${dir * 440 + (1 - inn) * dir * 800}px)) scale(${1 + (1 - inn) * 0.12})`,
        }}
      >
        <Media src={c.clip} transparent fit="contain" position="50% 100%" />
      </div>
    </AbsoluteFill>
  );
};

const FaceCut: React.FC<{ c: Cast; k: number }> = ({ c, k }) => (
  <AbsoluteFill style={{ background: [ORANGE, PAPER, INK][k % 3], overflow: "hidden" }}>
    <AbsoluteFill style={{ transform: `scale(2.4) rotate(${k % 2 ? -3 : 3}deg)`, transformOrigin: "50% 20%" }}>
      <Media src={c.clip} transparent fit="contain" />
    </AbsoluteFill>
  </AbsoluteFill>
);

const CastGrid: React.FC = () => {
  const f = useCurrentFrame();
  const lit = Math.floor(f / FACE_LEN) % 6;
  const t = interpolate(f, [GRID_LEN - 18, GRID_LEN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: INK }}>
      {CAST.map((c, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = 320 + col * 640;
        const cy = 270 + row * 540;
        // Collapse: every cell shrinks into a round avatar on a small ring around the centre.
        const a = (i / 6) * Math.PI * 2;
        const tx = interpolate(t, [0, 1], [cx, 960 + Math.cos(a) * 150]);
        const ty = interpolate(t, [0, 1], [cy, 540 + Math.sin(a) * 150]);
        const w = interpolate(t, [0, 1], [640, 110]);
        const h = interpolate(t, [0, 1], [540, 110]);
        const on = i === lit && t === 0;
        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: tx - w / 2,
              top: ty - h / 2,
              width: w,
              height: h,
              overflow: "hidden",
              borderRadius: interpolate(t, [0, 1], [0, 60]),
              background: `${c.tint}33`,
              outline: on ? `6px solid ${ORANGE}` : `6px solid ${t > 0 ? c.tint : "transparent"}`,
              outlineOffset: -6,
              filter: `brightness(${on || t > 0 ? 1 : 0.45})`,
            }}
          >
            {t < 0.5 ? (
              <Media src={c.clip} transparent fit="contain" position="50% 100%" />
            ) : (
              <Img src={staticFile(c.portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 14%" }} />
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const S1Cast: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {CAST.map((c, i) => (
      <Sequence key={c.id} from={i * SOLO} durationInFrames={SOLO}>
        <CastShot c={c} i={i} />
      </Sequence>
    ))}
    {Array.from({ length: 12 }, (_, k) => (
      <Sequence key={k} from={Math.round(FACES_FROM + k * FACE_LEN)} durationInFrames={Math.round(FACES_FROM + (k + 1) * FACE_LEN) - Math.round(FACES_FROM + k * FACE_LEN)}>
        <FaceCut c={CAST[(k * 5) % 6]} k={k} />
      </Sequence>
    ))}
    <Sequence from={GRID_FROM} durationInFrames={GRID_LEN}>
      <CastGrid />
    </Sequence>
    <Flash at={FACES_FROM} len={2} />
    <Flash at={GRID_FROM} len={2} />
  </AbsoluteFill>
);
