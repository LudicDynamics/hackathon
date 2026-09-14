import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { Footage, Media } from "../components/Media";
import { Chip } from "../components/Kit";
import { Mic } from "../components/Icons";
import { cast } from "../lib/assets";
import { DISPLAY, INK, MONO, ORANGE, PAPER } from "../lib/theme";

const Wave: React.FC<{ active: boolean; color: string; bars?: number; seed: string }> = ({ active, color, bars = 22, seed }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height: 120 }}>
      {Array.from({ length: bars }, (_, i) => {
        const h = active ? 14 + 100 * random(`${seed}-${i}-${Math.floor(f / 2)}`) * Math.sin(((i + 1) / (bars + 1)) * Math.PI) : 8;
        return <div key={i} style={{ width: 9, height: h, borderRadius: 5, background: color }} />;
      })}
    </div>
  );
};

const Bubble: React.FC<{ text: string; from: number; cps?: number; side: "left" | "right"; color: string }> = ({ text, from, cps = 26, side, color }) => {
  const f = useCurrentFrame();
  if (f < from) return null;
  const n = Math.min(text.length, Math.floor(((f - from) / 30) * cps));
  return (
    <div
      style={{
        alignSelf: side === "left" ? "flex-start" : "flex-end",
        maxWidth: 760,
        background: side === "right" ? color : PAPER,
        color: side === "right" ? INK : INK,
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: 46,
        letterSpacing: -1,
        padding: "22px 32px",
        borderRadius: 30,
        boxShadow: "0 12px 30px rgba(0,0,0,.4)",
      }}
    >
      {text.slice(0, n)}
    </div>
  );
};

/** Stand-in for R0 until the real STT → TTS recording exists. The real clip replaces all of this. */
const VoiceMock: React.FC = () => {
  const f = useCurrentFrame();
  const n = cast("nanami");
  const listening = (f >= 40 && f < 150) || (f >= 290 && f < 315);
  const speaking = (f >= 178 && f < 280) || (f >= 322 && f < 360);
  const t = f < 150 ? 0 : Math.min(f, 177) - 150;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ filter: "brightness(.35) blur(4px)", transform: "scale(1.1)" }}>
        <Media src="bg/first-snow/studio.webm" />
      </AbsoluteFill>
      <div style={{ position: "absolute", right: -40, bottom: -60, width: 900, height: 1200, transform: `scale(${speaking ? 1.02 + 0.01 * Math.sin(f / 2) : 1})`, transformOrigin: "50% 100%" }}>
        <Media src={n.clip} transparent fit="contain" position="50% 100%" />
      </div>
      <div style={{ position: "absolute", left: 110, top: 150, width: 1000, display: "flex", flexDirection: "column", gap: 26 }}>
        <Bubble text="Nanami, did the snow start yet?" from={60} side="right" color={ORANGE} />
        <Bubble text="It just did. I saved the first flake for you." from={180} side="left" color={n.tint} />
        <Bubble text="Then let's go see it." from={292} cps={60} side="right" color={ORANGE} />
        <Bubble text="Race you to the roof!" from={322} cps={60} side="left" color={n.tint} />
      </div>
      <div style={{ position: "absolute", left: 110, bottom: 110, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ width: 170, height: 170, borderRadius: "50%", background: listening ? ORANGE : "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? `0 0 0 ${14 + 8 * Math.sin(f / 3)}px ${ORANGE}44` : "none" }}>
          <Mic size={90} color={listening ? INK : PAPER} />
        </div>
        <Wave active={listening} color={ORANGE} seed="me" />
      </div>
      <div style={{ position: "absolute", right: 820, bottom: 150 }}>
        <Wave active={speaking} color={n.tint} seed="nanami" bars={16} />
      </div>
      {f >= 150 && (
        <div style={{ position: "absolute", right: 110, top: 90, fontFamily: MONO, fontSize: 64, color: t >= 27 ? ORANGE : PAPER, background: "rgba(0,0,0,.6)", padding: "10px 26px", borderRadius: 16 }}>
          {(t / 30).toFixed(1)}s
        </div>
      )}
      <Chip text="PLACEHOLDER · R0" style={{ left: 40, top: 36, background: "#333", color: PAPER, fontSize: 20 }} />
    </AbsoluteFill>
  );
};

export const S3Voice: React.FC = () => <Footage slot="r0" muted={false} push={0.04} fallback={<VoiceMock />} />;
