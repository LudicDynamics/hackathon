import React from "react";
import { AbsoluteFill, getStaticFiles, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { dur } from "../lib/assets";
import { SLOTS } from "../lib/cuts";
import { DISPLAY, INK, ORANGE, PAPER } from "../lib/theme";

export const isVideo = (s: string) => /\.(mp4|webm|mov)$/i.test(s);
const isMedia = (s: string) => /\.(mp4|webm|mov|png|jpe?g|webp)$/i.test(s);

/** Looping clip or still. Videos loop via <Loop>; transparent webm keeps its alpha. */
export const Media: React.FC<{
  src: string;
  transparent?: boolean;
  fit?: "cover" | "contain";
  position?: string;
  style?: React.CSSProperties;
}> = ({ src, transparent, fit = "cover", position = "50% 50%", style }) => {
  const { fps } = useVideoConfig();
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit, objectPosition: position, ...style };
  if (!isVideo(src)) return <Img src={staticFile(src)} style={s} />;
  return (
    <Loop durationInFrames={Math.floor(dur(src) * fps) - 1}>
      <OffthreadVideo src={staticFile(src)} transparent={transparent} muted style={s} />
    </Loop>
  );
};

export const resolveSlot = (slot: string) => {
  const files = getStaticFiles().map((f) => f.name).filter(isMedia);
  for (const c of SLOTS[slot]?.candidates ?? []) {
    const hit = files.find((name) => {
      const n = name.toLowerCase();
      return typeof c.match === "string" ? n.startsWith(c.match) : c.match.every((m) => n.includes(m));
    });
    if (hit) return { src: hit, from: c.from ?? 0, rate: c.rate ?? 1 };
  }
  return null;
};

export const Placeholder: React.FC<{ slot: string }> = ({ slot }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#101010", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ position: "absolute", inset: 48, border: `4px dashed ${ORANGE}`, borderRadius: 28, opacity: 0.6 + 0.4 * Math.sin(frame / 6) }} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 150, color: ORANGE, letterSpacing: -4 }}>{slot.toUpperCase()}</div>
      <div style={{ fontFamily: "PingFang SC, sans-serif", fontSize: 44, color: PAPER, opacity: 0.85, maxWidth: 1400, textAlign: "center", lineHeight: 1.35 }}>
        {SLOTS[slot]?.note ?? slot}
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 28, color: PAPER, opacity: 0.4, letterSpacing: 6 }}>TO RECORD</div>
    </AbsoluteFill>
  );
};

/**
 * A footage slot: the resolved recording (with a slow push-in), else `fallback`, else a labelled placeholder.
 */
export const Footage: React.FC<{ slot: string; fit?: "cover" | "contain"; push?: number; muted?: boolean; fallback?: React.ReactNode }> = ({
  slot,
  fit = "cover",
  push = 0.06,
  muted = true,
  fallback,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const r = resolveSlot(slot);
  if (!r) return <>{fallback ?? <Placeholder slot={slot} />}</>;
  const s: React.CSSProperties = { width: "100%", height: "100%", objectFit: fit, transform: `scale(${1 + (push * frame) / durationInFrames})` };
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {isVideo(r.src) ? (
        <OffthreadVideo src={staticFile(r.src)} trimBefore={Math.round(r.from * fps)} playbackRate={r.rate} muted={muted} style={s} />
      ) : (
        <Img src={staticFile(r.src)} style={s} />
      )}
    </AbsoluteFill>
  );
};
