import React from "react";
import { AbsoluteFill, Img, random, staticFile } from "remotion";
import { CAST, SCENES } from "../lib/assets";
import { H, W } from "../lib/timing";
import { INK, ORANGE, PAPER } from "../lib/theme";
import { Door } from "./Icons";

export type Cam = { x: number; y: number; scale: number };
export type CardKind = "scene" | "avatar" | "chalk" | "gate" | "dice";
export type CardSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  kind: CardKind;
  src?: string;
  /** object-position for avatar crops. */
  pos?: string;
  /** Distance from the origin in cell widths — drives staggered reveals. */
  ring: number;
  tone: string;
};

export const CELL_W = 640;
export const CELL_H = 480;

const TONES: Record<CardKind, string> = { scene: "#6b5a48", avatar: ORANGE, chalk: PAPER, gate: "#3a2f26", dice: "#e8e4dc" };
const SIZES: Record<CardKind, [number, number]> = { scene: [520, 360], avatar: [230, 230], chalk: [420, 300], gate: [260, 360], dice: [170, 170] };
const pickKind = (r: number): CardKind => (r < 0.56 ? "scene" : r < 0.72 ? "avatar" : r < 0.86 ? "chalk" : r < 0.94 ? "gate" : "dice");

/** Deterministic scatter of cards on a jittered grid, sorted from the centre outwards. */
export function layoutCards({ radius, seed, density = 0.62, center }: { radius: number; seed: string; density?: number; center?: string }): CardSpec[] {
  const cards: CardSpec[] = [];
  const R = Math.ceil(radius);
  for (let gx = -R; gx <= R; gx++) {
    for (let gy = -R; gy <= R; gy++) {
      const x0 = gx * CELL_W;
      const y0 = gy * CELL_H;
      const dist = Math.hypot(x0, y0);
      if (dist > radius * CELL_W) continue;
      const k = `${seed}-${gx}-${gy}`;
      const isCenter = gx === 0 && gy === 0;
      if (!isCenter && random(k + "d") > density) continue;
      const kind = isCenter ? "scene" : pickKind(random(k + "k"));
      const who = CAST[Math.floor(random(k + "c") * CAST.length)];
      const src = kind === "scene" ? (isCenter && center ? center : SCENES[Math.floor(random(k + "s") * SCENES.length)]) : kind === "avatar" ? who.portrait : undefined;
      const [w, h] = SIZES[kind];
      cards.push({
        id: k,
        x: x0 + (isCenter ? 0 : (random(k + "x") - 0.5) * 180),
        y: y0 + (isCenter ? 0 : (random(k + "y") - 0.5) * 140),
        w,
        h,
        rot: isCenter ? 0 : (random(k + "r") - 0.5) * 8,
        kind,
        src,
        pos: kind === "avatar" ? who.face : undefined,
        ring: dist / CELL_W,
        tone: kind === "avatar" ? who.tint : TONES[kind],
      });
    }
  }
  return cards.sort((a, b) => a.ring - b.ring);
}

const Pips: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%">
    {[[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={9} fill={i === 2 ? ORANGE : INK} />
    ))}
  </svg>
);

export const Card: React.FC<{ c: CardSpec; lod?: boolean }> = ({ c, lod }) => {
  const round = c.kind === "avatar" ? "50%" : 14;
  if (lod) return <div style={{ width: "100%", height: "100%", background: c.tone, borderRadius: round, opacity: 0.85 }} />;
  const shadow = "0 18px 40px rgba(0,0,0,.55)";
  switch (c.kind) {
    case "scene":
      return (
        <div style={{ width: "100%", height: "100%", background: PAPER, padding: 10, borderRadius: 14, boxShadow: shadow }}>
          <Img src={staticFile(c.src!)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
        </div>
      );
    case "avatar":
      return (
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: `10px solid ${c.tone}`, overflow: "hidden", boxShadow: shadow, background: INK }}>
          <Img src={staticFile(c.src!)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.pos ?? "50% 14%" }} />
        </div>
      );
    case "chalk":
      return (
        <div style={{ width: "100%", height: "100%", background: PAPER, borderRadius: 14, boxShadow: shadow, padding: "40px 36px", display: "flex", flexDirection: "column", gap: 26 }}>
          {[0.92, 0.78, 0.86, 0.5].map((w, i) => (
            <div key={i} style={{ height: 14, width: `${w * 100}%`, background: "#2a2622", borderRadius: 8, opacity: 0.75 }} />
          ))}
          <div style={{ width: 44, height: 10, background: ORANGE, borderRadius: 6 }} />
        </div>
      );
    case "gate":
      return (
        <div style={{ width: "100%", height: "100%", background: c.tone, borderRadius: 14, boxShadow: shadow, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Door size={170} color={ORANGE} />
        </div>
      );
    case "dice":
      return (
        <div style={{ width: "100%", height: "100%", background: c.tone, borderRadius: 30, boxShadow: shadow, padding: 18 }}>
          <Pips />
        </div>
      );
  }
};

export const DotGrid: React.FC<{ cam: Cam; opacity?: number }> = ({ cam, opacity = 1 }) => {
  let size = 56 * cam.scale;
  while (size < 14) size *= 8;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: "radial-gradient(circle, rgba(244,241,234,.20) 1.5px, transparent 1.8px)",
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${W / 2 - cam.x * cam.scale}px ${H / 2 - cam.y * cam.scale}px`,
      }}
    />
  );
};

/** World → screen coordinates for things that should keep a constant on-screen size (cursors, avatars). */
export const toScreen = (cam: Cam, x: number, y: number) => ({ x: W / 2 + (x - cam.x) * cam.scale, y: H / 2 + (y - cam.y) * cam.scale });

/**
 * The shared infinite canvas: dot grid + a single world transform + culled, level-of-detail cards.
 * `children` are drawn in world space; `overlay` in screen space.
 */
export const CanvasWorld: React.FC<{
  cam: Cam;
  cards: CardSpec[];
  appear?: (c: CardSpec) => number;
  bg?: string;
  children?: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ cam, cards, appear, bg = INK, children, overlay }) => {
  const halfW = W / 2 / cam.scale;
  const halfH = H / 2 / cam.scale;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <DotGrid cam={cam} />
      {/* Cards are placed in screen space, each with its own small transform. A single world-sized
          transformed layer (20k+ px before scaling) gets clipped by Chrome once a filter touches it. */}
      {cards.map((c) => {
        if (Math.abs(c.x - cam.x) > halfW + c.w || Math.abs(c.y - cam.y) > halfH + c.h) return null;
        const a = appear ? appear(c) : 1;
        if (a <= 0.001) return null;
        const s = toScreen(cam, c.x, c.y);
        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: s.x - c.w / 2,
              top: s.y - c.h / 2,
              width: c.w,
              height: c.h,
              transform: `scale(${cam.scale * a}) rotate(${c.rot}deg)`,
              opacity: Math.min(1, a * 1.5),
            }}
          >
            {/* Below ~80px on screen a card is a flat swatch — keeps far zooms cheap enough to render. */}
            <Card c={c} lod={c.w * cam.scale < 80} />
          </div>
        );
      })}
      {children && (
        <div style={{ position: "absolute", left: W / 2, top: H / 2, transformOrigin: "0 0", transform: `scale(${cam.scale}) translate(${-cam.x}px, ${-cam.y}px)` }}>
          {children}
        </div>
      )}
      {overlay}
    </AbsoluteFill>
  );
};
