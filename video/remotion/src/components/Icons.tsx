import React from "react";
import { Img, staticFile } from "remotion";
import type { Axis } from "../lib/assets";

type P = { size?: number; color?: string; stroke?: number };
const Svg: React.FC<P & { children: React.ReactNode }> = ({ size = 96, children }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    {children}
  </svg>
);

export const Pin: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <path d="M24 44s14-13 14-24a14 14 0 1 0-28 0c0 11 14 24 14 24z" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
    <circle cx="24" cy="20" r="5" fill={color} />
  </Svg>
);
export const Glass: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <circle cx="20" cy="20" r="12" stroke={color} strokeWidth={stroke} />
    <path d="M29 29l12 12" stroke={color} strokeWidth={stroke + 1} strokeLinecap="round" />
  </Svg>
);
export const Heart: React.FC<P> = ({ color = "#fff", ...p }) => (
  <Svg {...p}>
    <path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill={color} />
  </Svg>
);
export const Hourglass: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <path d="M12 5h24M12 43h24M14 5c0 12 20 12 20 19S14 31 14 43M34 5c0 12-20 12-20 19s20 7 20 19" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </Svg>
);
export const Grid: React.FC<P> = ({ color = "#fff", ...p }) => (
  <Svg {...p}>
    {[10, 24, 38].flatMap((x) => [10, 24, 38].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3.2} fill={color} />))}
  </Svg>
);
export const Face: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <circle cx="24" cy="24" r="19" stroke={color} strokeWidth={stroke} />
    <circle cx="17.5" cy="21" r="2.6" fill={color} />
    <circle cx="30.5" cy="21" r="2.6" fill={color} />
    <path d="M16 29c4 5 12 5 16 0" stroke={color} strokeWidth={stroke - 0.5} strokeLinecap="round" />
  </Svg>
);
export const Code: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <path d="M16 12L5 24l11 12M32 12l11 12-11 12M27 8l-6 32" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const Quill: React.FC<P> = ({ color = "#fff", ...p }) => (
  <Svg {...p}>
    <path d="M42 5C26 7 13 18 9 37l-3 7 4-2c3-8 8-15 15-20-5 6-9 12-11 19 14-4 25-18 28-36z" fill={color} />
  </Svg>
);
export const Door: React.FC<P> = ({ color = "#fff", stroke = 3, ...p }) => (
  <Svg {...p}>
    <path d="M12 44V18a12 12 0 0 1 24 0v26z" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
    <circle cx="30" cy="30" r="2" fill={color} />
  </Svg>
);
export const Mic: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <rect x="17" y="5" width="14" height="24" rx="7" fill={color} />
    <path d="M10 22a14 14 0 0 0 28 0M24 36v7" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </Svg>
);

export const Chat: React.FC<P> = ({ color = "#fff", stroke = 4, ...p }) => (
  <Svg {...p}>
    <path d="M8 9h32a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H22l-9 8v-8H8a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z" stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
    <circle cx="17" cy="20.5" r="2.4" fill={color} />
    <circle cx="24" cy="20.5" r="2.4" fill={color} />
    <circle cx="31" cy="20.5" r="2.4" fill={color} />
  </Svg>
);

/** Black-and-white anime character bust silhouette (bangs, ahoge, big eyes cut out of the face) — "AI roleplay". */
export const AnimeBust: React.FC<P & { face?: string }> = ({ color = "#fff", face = "#0A0A0A", ...p }) => (
  <Svg {...p}>
    {/* long hair falling past the shoulders */}
    <path d="M9 42C6 28 8 8 24 6c16 2 18 22 15 36-3-2-5-6-6-10H15c-1 4-3 8-6 10z" fill={color} />
    <path d="M7 48c2-8 8-11 17-11s15 3 17 11z" fill={color} />
    {/* face cut out under jagged bangs */}
    <path d="M14.5 19l2.5-5.5 2.5 4.5 2.5-5.5 2 5 2-5 2.5 5.5 2.5-4.5 2.5 5.5c0 8.5-4 14-9.5 14s-9.5-5.5-9.5-14z" fill={face} />
    {/* big anime eyes with highlights, small mouth */}
    <ellipse cx="20" cy="24.2" rx="2.3" ry="3.2" fill={color} />
    <ellipse cx="28" cy="24.2" rx="2.3" ry="3.2" fill={color} />
    <circle cx="20.8" cy="22.9" r="0.8" fill={face} />
    <circle cx="28.8" cy="22.9" r="0.8" fill={face} />
    <path d="M22.6 29.6q1.4 1 2.8 0" stroke={color} strokeWidth="1" strokeLinecap="round" fill="none" />
    {/* ahoge */}
    <path d="M23 6.5c.5-4.5 4-5.7 7.5-4.5-3 .4-4.7 2-5.5 4.8z" fill={color} />
  </Svg>
);

/** "AI roleplay": Nanami as a black-and-white manga cut-out in a ring (public/icons, made by sync-assets.sh). */
export const RoleplayIcon: React.FC<P> = ({ size = 96, color = "#fff" }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", border: `${Math.max(3, Math.round(size * 0.04))}px solid ${color}`, background: "#0A0A0A" }}>
    <Img src={staticFile("icons/roleplay-nanami.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

export const AxisIcon: React.FC<P & { axis: Axis }> = ({ axis, ...p }) =>
  axis === "place" ? <Pin {...p} /> : axis === "deduce" ? <Glass {...p} /> : axis === "bond" ? <Heart {...p} /> : <Hourglass {...p} />;
