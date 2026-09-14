import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DISPLAY, HAND, INK, ORANGE, PAPER } from "../lib/theme";

/** Full-frame white flash for `len` frames starting at `at`. */
export const Flash: React.FC<{ at: number; len?: number; color?: string }> = ({ at, len = 2, color = "#fff" }) => {
  const f = useCurrentFrame();
  if (f < at || f >= at + len) return null;
  return <AbsoluteFill style={{ background: color }} />;
};

/** Heavy display type that slams in (scale 1.35 → 1) at `delay`. `children` (e.g. coloured spans) replace `text`. */
export const Slam: React.FC<{ text: string; size: number; color?: string; delay?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  text,
  size,
  color = PAPER,
  delay = 0,
  style,
  children,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 320, mass: 0.6 } });
  if (f < delay) return null;
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: -size * 0.04,
        lineHeight: 0.9,
        color,
        transform: `scale(${interpolate(s, [0, 1], [1.35, 1])})`,
        opacity: interpolate(s, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children ?? text}
    </div>
  );
};

/** The wordmark: WORLD in white, LINES in orange. */
export const WorldlinesMark: React.FC<{ size: number; delay?: number }> = ({ size, delay }) => (
  <Slam text="WORLDLINES" size={size} delay={delay}>
    <span style={{ color: PAPER }}>WORLD</span>
    <span style={{ color: ORANGE }}>LINES</span>
  </Slam>
);

/** Handwritten chalk ink that writes itself, `cps` characters per second from `start`. */
export const ChalkWrite: React.FC<{ text: string; start?: number; cps?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({
  text,
  start = 0,
  cps = 28,
  size = 64,
  color = INK,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((f - start) / fps) * cps));
  return (
    <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: size, color, lineHeight: 1.1, ...style }}>
      {text.slice(0, n)}
      {n > 0 && n < text.length && <span style={{ opacity: 0.5 }}>|</span>}
    </div>
  );
};

/** Three bouncing dots — "someone is talking" without words. */
export const TypingDots: React.FC<{ color: string; style?: React.CSSProperties; scale?: number }> = ({ color, style, scale = 1 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 8 * scale, padding: `${12 * scale}px ${18 * scale}px`, background: PAPER, borderRadius: 30 * scale, boxShadow: "0 8px 20px rgba(0,0,0,.4)", ...style }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 14 * scale, height: 14 * scale, borderRadius: "50%", background: color, transform: `translateY(${Math.sin(f / 3 - i) * 5 * scale}px)` }} />
      ))}
    </div>
  );
};

/** Circular avatar with a multiplayer-style pointer. Positioned by its centre. */
export const CursorAvatar: React.FC<{ portrait: string; color: string; x: number; y: number; size?: number; bounce?: number; dots?: boolean; position?: string }> = ({
  portrait,
  color,
  x,
  y,
  size = 96,
  bounce = 0,
  dots,
  position = "50% 14%",
}) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${1 + bounce * 0.35})` }}>
    <svg width={size * 0.34} height={size * 0.34} viewBox="0 0 24 24" style={{ position: "absolute", left: -size * 0.16, top: -size * 0.16 }}>
      <path d="M2 2 L22 10 L12 12 L10 22 Z" fill={color} stroke={INK} strokeWidth={1.5} />
    </svg>
    <div style={{ width: size, height: size, borderRadius: "50%", border: `${Math.max(3, size * 0.06)}px solid ${color}`, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.5)", background: INK }}>
      <Img src={staticFile(portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position }} />
    </div>
    {dots && <TypingDots color={color} scale={size / 110} style={{ position: "absolute", left: size * 0.6, top: -size * 0.45 }} />}
  </div>
);

/** The player's own arrow cursor. */
export const PlayerCursor: React.FC<{ x: number; y: number; color: string; pressed?: boolean; size?: number }> = ({ x, y, color, pressed, size = 54 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ position: "absolute", left: x, top: y, transform: `scale(${pressed ? 0.82 : 1})`, transformOrigin: "0 0", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))" }}
  >
    <path d="M3 2 L20 11 L12.5 13 L9.5 21 Z" fill={color} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

/** Small pill label, used for the `next` marker on mocked vision shots. */
export const Chip: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={{ position: "absolute", fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: 2, color: INK, background: PAPER, padding: "8px 18px", borderRadius: 999, ...style }}>
    {text}
  </div>
);

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);
