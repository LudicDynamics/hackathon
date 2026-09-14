import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards, toScreen, type Cam, type CardSpec } from "../components/Canvas";
import { Footage, Media } from "../components/Media";
import { ChalkWrite, CursorAvatar, Flash, PlayerCursor, TypingDots } from "../components/Kit";
import { CAST, cast, WORLDS, type CastId } from "../lib/assets";
import { DISPLAY, ORANGE, PAPER } from "../lib/theme";

const MAP_POS = [
  [-780, -450],
  [780, -450],
  [-780, 450],
  [780, 450],
];
const ITEM = { x: -60, y: -60 };
const WATSON_REST = { x: 380, y: 60 };
const NANAMI_REST = { x: -420, y: 190 };
const DROP = 165;
const CLICK = 285;
const MODAL = 300;

const HOME: Record<CastId, [number, number]> = {
  vera: [-300, -250],
  sumi: [260, -230],
  nanami: [-420, 190],
  watson: [380, 60],
  seraphina: [60, 300],
  ryo: [-80, 40],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

const wander = (id: CastId, i: number, f: number) => {
  const [bx, by] = HOME[id];
  return { x: bx + 200 * Math.sin(f / 38 + i * 1.3), y: by + 130 * Math.cos(f / 47 + i * 2.1) };
};

const avatarPos = (id: CastId, i: number, f: number) => {
  const w = wander(id, i, f);
  if (id === "watson") {
    const t = ease(f, 90, 140);
    return { x: lerp(w.x, WATSON_REST.x, t), y: lerp(w.y, WATSON_REST.y, t) };
  }
  if (id === "nanami") {
    const t = ease(f, 200, 250);
    return { x: lerp(w.x, NANAMI_REST.x, t), y: lerp(w.y, NANAMI_REST.y, t) };
  }
  return w;
};

const playerWorld = (f: number) => {
  const idle = { x: 120 + 260 * Math.sin(f / 30), y: -40 + 200 * Math.cos(f / 41) };
  if (f < 80) return idle;
  if (f < 110) {
    const t = ease(f, 80, 110);
    const from = { x: 120 + 260 * Math.sin(80 / 30), y: -40 + 200 * Math.cos(80 / 41) };
    return { x: lerp(from.x, ITEM.x, t), y: lerp(from.y, ITEM.y, t) };
  }
  if (f < DROP) {
    const t = ease(f, 115, DROP - 5);
    return { x: lerp(ITEM.x, WATSON_REST.x, t), y: lerp(ITEM.y, WATSON_REST.y, t) };
  }
  const t = ease(f, 230, CLICK - 5);
  return { x: lerp(WATSON_REST.x + 40, NANAMI_REST.x, t), y: lerp(WATSON_REST.y + 40, NANAMI_REST.y, t) };
};

const camAt = (f: number): Cam => {
  const t = ease(f, 230, 295);
  return { x: lerp(0, NANAMI_REST.x, t), y: lerp(0, NANAMI_REST.y, t), scale: lerp(0.6 + 0.02 * Math.sin(f / 50), 1.05, t) };
};

/** Nanami's close-up, used until the real C2 capture exists. */
export const ModalMock: React.FC<{ who: CastId }> = ({ who }) => {
  const c = cast(who);
  return (
    <AbsoluteFill style={{ background: "rgba(10,10,10,.6)" }}>
      <div style={{ position: "absolute", left: 60, bottom: -40, width: 920, height: 1200 }}>
        <Media src={c.clip} transparent fit="contain" position="50% 100%" />
      </div>
      <div style={{ position: "absolute", right: 110, bottom: 150, width: 800, background: "rgba(22,20,18,.92)", border: `2px solid ${c.tint}`, borderRadius: 24, padding: "30px 40px" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: c.tint, letterSpacing: 3 }}>{c.name}</div>
        <TypingDots color={c.tint} style={{ marginTop: 22, width: "fit-content" }} />
      </div>
    </AbsoluteFill>
  );
};

export const S2OneCanvas: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = camAt(f);
  const cards = useMemo<CardSpec[]>(() => {
    const maps: CardSpec[] = WORLDS.map((w, i) => ({
      id: `map-${w.n}`,
      x: MAP_POS[i][0],
      y: MAP_POS[i][1],
      w: 620,
      h: 420,
      rot: [-3, 2, 2, -2][i],
      kind: "scene",
      src: w.card,
      ring: 1,
      tone: "#555",
    }));
    const extra = layoutCards({ radius: 7, seed: "s2", density: 0.4 }).filter((c) => c.ring > 2.4 && c.kind !== "avatar");
    return [...maps, ...extra];
  }, []);

  const bounce = f >= DROP ? Math.sin(Math.min(1, (f - DROP) / 12) * Math.PI) : 0;
  const dim = interpolate(f, [CLICK, MODAL], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p = toScreen(cam, playerWorld(f).x, playerWorld(f).y);
  const item = f < 110 ? ITEM : f < DROP ? playerWorld(f) : null;
  const itemS = item ? toScreen(cam, item.x, item.y) : null;
  const burst = f >= DROP ? spring({ frame: f - DROP, fps, config: { damping: 30 } }) : 0;
  const w = toScreen(cam, WATSON_REST.x, WATSON_REST.y);
  const nanamiS = toScreen(cam, NANAMI_REST.x, NANAMI_REST.y);
  const modal = spring({ frame: f - MODAL, fps, config: { damping: 16, stiffness: 200 } });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: `brightness(${1 - dim * 0.65}) blur(${dim * 8}px)` }}>
        <CanvasWorld
          cam={cam}
          cards={cards}
          overlay={
            <>
              {f > 150 && f < MODAL && (
                <div style={{ position: "absolute", left: w.x + 90, top: w.y - 150, background: PAPER, padding: "18px 26px", borderRadius: 12, transform: "rotate(-2deg)", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                  <ChalkWrite text="Where did you find this?" start={170} size={46} />
                </div>
              )}
              {burst > 0 && burst < 0.99 && (
                <div style={{ position: "absolute", left: w.x, top: w.y, width: 320 * burst, height: 320 * burst, transform: "translate(-50%,-50%)", borderRadius: "50%", border: `6px solid ${ORANGE}`, opacity: 1 - burst }} />
              )}
              {CAST.map((c, i) => {
                const pos = avatarPos(c.id, i, f);
                const s = toScreen(cam, pos.x, pos.y);
                return <CursorAvatar key={c.id} portrait={c.portrait} color={c.tint} x={s.x} y={s.y} size={104} bounce={c.id === "watson" ? bounce : 0} dots={c.id === "watson" && f > DROP + 10 && f < 230} />;
              })}
              {itemS && (
                <div style={{ position: "absolute", left: itemS.x - 60, top: itemS.y - 60, width: 120, height: 120, borderRadius: 18, background: "#C9A24A", boxShadow: "0 16px 30px rgba(0,0,0,.5)", border: `4px solid ${PAPER}` }} />
              )}
              <PlayerCursor x={p.x} y={p.y} color={ORANGE} pressed={(f >= 108 && f < DROP) || (f >= CLICK && f < CLICK + 6)} />
            </>
          }
        />
      </AbsoluteFill>
      <Sequence from={MODAL}>
        <AbsoluteFill style={{ transform: `scale(${modal})`, transformOrigin: `${nanamiS.x}px ${nanamiS.y}px`, opacity: modal }}>
          <Footage slot="c2" fallback={<ModalMock who="nanami" />} />
        </AbsoluteFill>
      </Sequence>
      <Flash at={MODAL} len={1} />
    </AbsoluteFill>
  );
};
