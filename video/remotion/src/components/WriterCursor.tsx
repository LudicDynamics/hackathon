import React from "react";
import { MONO, PAPER } from "../lib/theme";
import { tr } from "../lib/lang";

/** The app's writer keeps a rust pointer (agent-cursor.css: --ux-color-rust). */
export const RUST = "#B5532C";

/**
 * The little writer's pointer: it goes wherever the writer is reading or writing, with a tag saying what it touches
 * (apps/web/src/components/canvas/AgentCursorLayer.tsx). Screen coordinates, positioned by the pointer tip.
 */
export const WriterCursor: React.FC<{ x: number; y: number; label?: string; color?: string; opacity?: number }> = ({ x, y, label, color = RUST, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "flex-start", gap: 4, opacity, filter: "drop-shadow(0 4px 8px rgba(35,28,20,.45))" }}>
    <svg width={40} height={40} viewBox="0 0 24 24">
      <path d="M3 2 L20 11 L12.5 13 L9.5 21 Z" fill={color} stroke={PAPER} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
    {label && (
      <div style={{ marginTop: 26, background: color, color: PAPER, fontFamily: MONO, fontSize: 21, padding: "5px 12px", borderRadius: 8, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 700 }}>{tr("Writer agent", "作家智能体")}</span> · {label}
      </div>
    )}
  </div>
);

/** A step-by-step cursor path: glide to each point in `glide` frames, then dwell until the next step. */
export type Step = { at: number; x: number; y: number; label: string };
export const walk = (steps: Step[], f: number, glide = 18, from = { x: -200, y: 540 }) => {
  let i = 0;
  while (i + 1 < steps.length && f >= steps[i + 1].at) i++;
  const cur = steps[i];
  const prev = i > 0 ? steps[i - 1] : { ...from, at: 0, label: "" };
  const raw = Math.max(0, Math.min(1, (f - cur.at) / glide));
  const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  return { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t, label: cur.label, step: i, arrived: raw >= 1 };
};
