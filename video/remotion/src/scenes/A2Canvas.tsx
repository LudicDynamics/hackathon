import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards, toScreen, type Cam, type CardSpec } from "../components/Canvas";
import { ChalkWrite, CursorAvatar, Flash, PlayerCursor, Slam } from "../components/Kit";
import { RUST, walk, WriterCursor, type Step } from "../components/WriterCursor";
import { CAST, type Cast, type CastId, WORLDS } from "../lib/assets";
import { INK, ORANGE, PAPER } from "../lib/theme";
import { S0ColdOpen } from "./S0ColdOpen";

// ACT 2 · key press (0–90, burst on the drop at 0:18) → one canvas with the writer at work (90–300) → cast (300–480).

const MAP_POS: [number, number][] = [
  [-780, -450],
  [780, -450],
  [-780, 450],
  [780, 450],
];
const MAP_W = 620;
const MAP_H = 420;
const SPAWN = { x: 40, y: -60, w: 440, h: 260 };
const HOME: Record<CastId, [number, number]> = {
  vera: [-330, -200],
  sumi: [300, -250],
  nanami: [-420, 220],
  watson: [420, 40],
  ryo: [80, 300],
  lyra: [-60, 120],
};

// The writer reads two world READMEs, writes a new chalk, then moves Watson — like the real AgentCursorLayer.
const STEPS: Step[] = [
  { at: 0, x: MAP_POS[0][0], y: MAP_POS[0][1], label: "reading  harbor-chart/README.md" },
  { at: 45, x: MAP_POS[1][0], y: MAP_POS[1][1], label: "reading  london-map/README.md" },
  { at: 95, x: SPAWN.x - SPAWN.w / 2 + 20, y: SPAWN.y - SPAWN.h / 2 + 20, label: "writing  berth-7/opening.md" },
  { at: 155, x: 420, y: 40, label: "moving  Watson → berth-7" },
];
const SPAWN_AT = 110;

const WriterCanvas: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam: Cam = { x: 0, y: 0, scale: 0.6 + 0.015 * Math.sin(f / 40) };
  const cards = useMemo<CardSpec[]>(() => {
    const maps: CardSpec[] = WORLDS.map((w, i) => ({ id: `map-${i}`, x: MAP_POS[i][0], y: MAP_POS[i][1], w: MAP_W, h: MAP_H, rot: 0, kind: "scene", src: w.card, ring: 1, tone: "#555" }));
    return [...maps, ...layoutCards({ radius: 7, seed: "a2", density: 0.4 }).filter((c) => c.ring > 2.4 && c.kind !== "avatar")];
  }, []);
  const w = walk(STEPS, f, 18, { x: -1300, y: 100 });
  const tip = toScreen(cam, w.x, w.y);
  const reading = w.step < 2 && w.arrived;
  const hl = reading ? toScreen(cam, MAP_POS[w.step][0], MAP_POS[w.step][1]) : null;
  const born = spring({ frame: f - SPAWN_AT, fps, config: { damping: 12, stiffness: 200 } });
  const sp = toScreen(cam, SPAWN.x, SPAWN.y);
  const watsonGo = interpolate(f, [165, 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <CanvasWorld
      cam={cam}
      cards={cards}
      overlay={
        <>
          {hl && (
            <div style={{ position: "absolute", left: hl.x - (MAP_W * cam.scale) / 2 - 8, top: hl.y - (MAP_H * cam.scale) / 2 - 8, width: MAP_W * cam.scale + 16, height: MAP_H * cam.scale + 16, border: `4px solid ${RUST}`, borderRadius: 14, opacity: 0.6 + 0.4 * Math.sin(f / 4) }} />
          )}
          {f >= SPAWN_AT && (
            <div style={{ position: "absolute", left: sp.x - (SPAWN.w * cam.scale) / 2, top: sp.y - (SPAWN.h * cam.scale) / 2, width: SPAWN.w * cam.scale, height: SPAWN.h * cam.scale, background: PAPER, borderRadius: 12, padding: 18, transform: `scale(${born})`, boxShadow: "0 16px 40px rgba(0,0,0,.55)", outline: f < 160 ? `3px solid ${RUST}` : "none" }}>
              <ChalkWrite text="The fog parts over berth seven." start={SPAWN_AT + 4} cps={24} size={30} />
            </div>
          )}
          {CAST.map((c, i) => {
            let [x, y] = HOME[c.id];
            x += 170 * Math.sin(f / 38 + i * 1.3);
            y += 110 * Math.cos(f / 47 + i * 2.1);
            if (c.id === "watson") {
              x += (SPAWN.x + 260 - x) * watsonGo;
              y += (SPAWN.y + 40 - y) * watsonGo;
            }
            const s = toScreen(cam, x, y);
            return <CursorAvatar key={c.id} portrait={c.portrait} position={c.face} color={c.tint} x={s.x} y={s.y} size={100} />;
          })}
          <PlayerCursor x={960 + 420 * Math.sin(f / 33)} y={600 + 180 * Math.cos(f / 41)} color={ORANGE} />
          <WriterCursor x={tip.x} y={tip.y} label={w.label} />
        </>
      }
    />
  );
};

/** One character per beat: blurred full illustration behind, the illustration as a framed card, the name. */
const CastCard: React.FC<{ c: Cast; i: number }> = ({ c, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dir = i % 2 ? -1 : 1;
  const inn = spring({ frame: f, fps, config: { damping: 15, stiffness: 190 } });
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: "blur(28px) brightness(.45) saturate(1.2)", transform: "scale(1.2)" }}>
        <Img src={staticFile(c.portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.frame }} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 90,
          left: dir > 0 ? 1080 : 240,
          width: 600,
          height: 800,
          background: PAPER,
          padding: 12,
          borderRadius: 16,
          boxShadow: "0 40px 90px rgba(0,0,0,.65)",
          transform: `translateX(${(1 - inn) * dir * 900}px) rotate(${dir * (3 - inn)}deg)`,
        }}
      >
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }}>
          <Img src={staticFile(c.portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.frame, transform: `scale(${1.12 - f * 0.002})` }} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 400, left: dir > 0 ? 120 : undefined, right: dir > 0 ? undefined : 120 }}>
        <Slam text={c.name} size={230} />
      </div>
    </AbsoluteFill>
  );
};

export const A2Canvas: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={90}>
      <S0ColdOpen />
    </Sequence>
    <Sequence from={90} durationInFrames={210}>
      <WriterCanvas />
    </Sequence>
    {CAST.map((c, i) => (
      <Sequence key={c.id} from={300 + i * 30} durationInFrames={30}>
        <CastCard c={c} i={i} />
      </Sequence>
    ))}
    <Flash at={90} len={2} />
    {CAST.map((c, i) => (
      <Flash key={c.id} at={300 + i * 30} len={1} />
    ))}
  </AbsoluteFill>
);

export const fadeIn = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
export const ORANGE_HL = ORANGE;
