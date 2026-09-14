import React from "react";
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

export const AxisIcon: React.FC<P & { axis: Axis }> = ({ axis, ...p }) =>
  axis === "place" ? <Pin {...p} /> : axis === "deduce" ? <Glass {...p} /> : axis === "bond" ? <Heart {...p} /> : <Hourglass {...p} />;
