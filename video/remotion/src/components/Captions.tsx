import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ORANGE, PAPER, TEXT } from "../lib/theme";

/** Seconds relative to the Sequence the track is mounted in. */
export type Cue = { from: number; to: number; text: string; speaker?: string };

/** Whip-style subtitle: small, centred, lower third, on a soft dark pill so it reads on white too. */
export const Caption: React.FC<{ cue: Cue; t: number }> = ({ cue, t }) => {
  const a = Math.max(0, Math.min(1, (t - cue.from) * 6, (cue.to - t) * 6));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center", opacity: a, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1500,
          textAlign: "center",
          fontFamily: TEXT,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.3,
          letterSpacing: -0.3,
          color: PAPER,
          background: "rgba(10,10,10,.58)",
          padding: "10px 24px",
          borderRadius: 12,
        }}
      >
        {cue.speaker && <span style={{ color: ORANGE, fontWeight: 800, marginRight: 14 }}>{cue.speaker}</span>}
        {cue.text}
      </div>
    </div>
  );
};

export const CaptionTrack: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const cue = cues.find((c) => t >= c.from && t < c.to);
  return cue ? <Caption cue={cue} t={t} /> : null;
};
