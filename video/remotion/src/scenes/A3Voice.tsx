import React from "react";
import { AbsoluteFill, random, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage, Media } from "../components/Media";
import { Chip, Flash, TypingDots } from "../components/Kit";
import { Mic } from "../components/Icons";
import { VoiceClip } from "../components/Voice";
import { cast } from "../lib/assets";
import { CUT, CUT2, CUT3, EL_ACT_LEN, EL_LIVE, EL_WORLD, N1, P1, P2, P3, shown, V1, vlen, W1 } from "../lib/voice";
import { DISPLAY, INK, ORANGE, PAPER, TEXT } from "../lib/theme";

// ACT 3 · "And they talk back." Speech-to-text in, TTS out — Vera, Nanami (setsuna) and Wataru, an otome-style
// love interest, as a faithful mock with real voices; then Elias (Ei) for real, from the user's recordings of his world:
// a voiced reply, a GPT Live call, and the ticket he promised on the call showing up on the canvas.

type Speaker = { name: string; tint: string; clip: string; transparent: boolean };
const VERA: Speaker = { name: "VERA", tint: cast("vera").tint, clip: cast("vera").clip!, transparent: true };
const NANAMI: Speaker = { name: "NANAMI", tint: cast("nanami").tint, clip: cast("nanami").clip!, transparent: true };
/** Wataru (high-school club classmate, quietly intense) is a full scene with its own background, so he is shown as
    a framed portrait card. */
const WATARU: Speaker = { name: "WATARU", tint: "#7FB3E8", clip: "cast/wataru.mp4", transparent: false };
const ELIAS_TINT = "#9FD8C8";

const Wave: React.FC<{ active: boolean; color: string; bars?: number; seed: string }> = ({ active, color, bars = 22, seed }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height: 110 }}>
      {Array.from({ length: bars }, (_, i) => {
        const h = active ? 12 + 90 * random(`${seed}-${i}-${Math.floor(f / 2)}`) * Math.sin(((i + 1) / (bars + 1)) * Math.PI) : 6;
        return <div key={i} style={{ width: 8, height: h, borderRadius: 4, background: color }} />;
      })}
    </div>
  );
};

/** Text revealed in step with its audio, the way live transcription / streamed replies appear. */
const reveal = (text: string, f: number, at: number, len: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.ceil(((f - at) / len) * text.length))));

const Bubble: React.FC<{ text: string; mine: boolean; tint: string }> = ({ text, mine, tint }) => (
  <div
    style={{
      alignSelf: mine ? "flex-end" : "flex-start",
      maxWidth: 780,
      minHeight: 40,
      background: mine ? ORANGE : PAPER,
      color: INK,
      fontFamily: TEXT,
      fontWeight: 600,
      fontSize: 42,
      lineHeight: 1.25,
      padding: "20px 30px",
      borderRadius: 28,
      border: mine ? "none" : `3px solid ${tint}`,
      boxShadow: "0 12px 30px rgba(0,0,0,.45)",
    }}
  >
    {text}
  </div>
);

const Portrait: React.FC<{ s: Speaker; speaking: boolean; pop: number }> = ({ s, speaking, pop }) => {
  const f = useCurrentFrame();
  const talk = speaking ? 1.015 + 0.008 * Math.sin(f / 2) : 1;
  if (s.transparent)
    return (
      <div style={{ position: "absolute", right: -40, bottom: -70, width: 900, height: 1200, transform: `translateX(${(1 - pop) * 300}px) scale(${talk})`, transformOrigin: "50% 100%", opacity: pop }}>
        <Media src={s.clip} transparent fit="contain" position="50% 100%" />
      </div>
    );
  return (
    <div style={{ position: "absolute", right: 110, top: 150, width: 560, height: 840, borderRadius: 22, overflow: "hidden", border: `4px solid ${s.tint}`, boxShadow: "0 40px 90px rgba(0,0,0,.65)", transform: `translateX(${(1 - pop) * 400}px) rotate(${2 - pop * 2}deg) scale(${talk})`, opacity: pop }}>
      <Media src={s.clip} fit="cover" />
    </div>
  );
};

const Exchange: React.FC<{ s: Speaker; bg: string; p: { id: string; at: number }; r: { id: string; at: number } }> = ({ s, bg, p, r }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pLen = vlen(p.id);
  const rLen = vlen(r.id);
  const listening = f >= p.at - 10 && f < p.at + pLen + 4;
  const thinking = f >= p.at + pLen + 4 && f < r.at;
  const speaking = f >= r.at && f < r.at + rLen;
  const pop = spring({ frame: f, fps, config: { damping: 15, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ filter: "brightness(.33) blur(10px)", transform: "scale(1.15)" }}>
        <Media src={bg} />
      </AbsoluteFill>
      <Portrait s={s} speaking={speaking} pop={pop} />
      <div style={{ position: "absolute", right: 120, top: 70, fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: s.tint, letterSpacing: 2 }}>{s.name}</div>
      <div style={{ position: "absolute", left: 110, top: 190, width: 1000, display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Bubbles always show English (`shown`). */}
        {f >= p.at && <Bubble text={reveal(shown(p.id), f, p.at, pLen)} mine tint={s.tint} />}
        {thinking && <TypingDots color={s.tint} scale={1.3} style={{ width: "fit-content" }} />}
        {f >= r.at && <Bubble text={reveal(shown(r.id), f, r.at, rLen)} mine={false} tint={s.tint} />}
      </div>
      <div style={{ position: "absolute", left: 110, bottom: 150, display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ width: 150, height: 150, borderRadius: "50%", background: listening ? ORANGE : "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? `0 0 0 ${12 + 8 * Math.sin(f / 3)}px ${ORANGE}44` : "none" }}>
          <Mic size={78} color={listening ? INK : PAPER} />
        </div>
        <Wave active={listening} color={ORANGE} seed={`me-${s.name}`} />
      </div>
      <div style={{ position: "absolute", right: 760, bottom: 170 }}>
        <Wave active={speaking} color={s.tint} seed={s.name} bars={14} />
      </div>
      <Sequence from={p.at}>
        <VoiceClip id={p.id} />
      </Sequence>
      <Sequence from={r.at}>
        <VoiceClip id={r.id} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Elias's name and what the shot is, top right (clear of the app's close button). */
const EliasTag: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ position: "absolute", right: 120, top: 56, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
    <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: ELIAS_TINT, letterSpacing: 2, textShadow: "0 4px 18px rgba(0,0,0,.75)" }}>ELIAS</div>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: 3, color: INK, background: ORANGE, padding: "8px 18px", borderRadius: 999 }}>{label}</div>
  </div>
);

/** 13.27 run: his voiced reply streams into the dialogue box (the box shows the English line itself). */
const EliasText: React.FC = () => (
  <AbsoluteFill>
    <Footage slot="el-text" push={0.04} />
    <EliasTag label="REAL · IN-APP VOICE" />
    <VoiceClip id="elias-1" />
  </AbsoluteFill>
);

/** His two lines on the call, frames relative to the beat (the clip starts 1.5s before he speaks). */
const LIVE_LINES = [
  { text: "Okay, let's take it slow and get it right.", from: 47, to: 147 },
  { text: "I'm checking what the ticket should cover.", from: 155, to: 236 },
];

/** 15.59 run: on a GPT Live call. The box shows your request (English); his replies are voice only, so they are bubbles. */
const EliasLive: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Footage slot="el-live" push={0} />
      {/* The character card's bio is in Chinese in this take; soften it (the film shows English only). */}
      <div style={{ position: "absolute", left: 52, top: 282, width: 500, height: 108, backdropFilter: "blur(10px)", background: "rgba(40,38,34,.35)", borderRadius: 10 }} />
      <EliasTag label="REAL · GPT LIVE CALL" />
      <div style={{ position: "absolute", right: 70, top: 250, width: 640, display: "flex", flexDirection: "column", gap: 20 }}>
        {LIVE_LINES.filter((l) => f >= l.from).map((l) => (
          <Bubble key={l.text} text={reveal(l.text, f, l.from, l.to - l.from)} mine={false} tint={ELIAS_TINT} />
        ))}
      </div>
      <Sequence from={45}>
        <VoiceClip id="elias-2" />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Back on the canvas: the action is confirmed, and the ticket he wrote on the call is a card in the office. */
const EliasWorld: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={EL_ACT_LEN}>
      <Footage slot="el-act" push={0.03} />
    </Sequence>
    <Sequence from={EL_ACT_LEN}>
      {/* Zoomed onto the ticket card; the crop keeps the translate popup (top centre) out of frame. */}
      <AbsoluteFill style={{ transform: "scale(1.6)", transformOrigin: "21% 35%" }}>
        <Footage slot="el-item" push={0.05} />
      </AbsoluteFill>
      <EliasTag label="SAVED TO THE WORLD" />
    </Sequence>
    <Flash at={EL_ACT_LEN} len={1} />
  </AbsoluteFill>
);

const VoiceMock: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={CUT}>
      <Exchange s={VERA} bg="bg/wuwu/workshop.webm" p={{ id: "player-1", at: P1 }} r={{ id: "vera-1", at: V1 }} />
    </Sequence>
    <Sequence from={CUT} durationInFrames={CUT2 - CUT}>
      <Exchange s={NANAMI} bg="bg/first-snow/studio.webm" p={{ id: "player-2", at: P2 - CUT }} r={{ id: "nanami-1", at: N1 - CUT }} />
    </Sequence>
    <Sequence from={CUT2} durationInFrames={CUT3 - CUT2}>
      <Exchange s={WATARU} bg="cast/wataru.mp4" p={{ id: "player-3", at: P3 - CUT2 }} r={{ id: "wataru-1", at: W1 - CUT2 }} />
    </Sequence>
    <Sequence from={CUT3} durationInFrames={EL_LIVE - CUT3}>
      <EliasText />
    </Sequence>
    <Sequence from={EL_LIVE} durationInFrames={EL_WORLD - EL_LIVE}>
      <EliasLive />
    </Sequence>
    <Sequence from={EL_WORLD}>
      <EliasWorld />
    </Sequence>
    <Flash at={CUT} len={1} />
    <Flash at={CUT2} len={1} />
    <Flash at={CUT3} len={1} />
    <Flash at={EL_LIVE} len={1} />
    <Flash at={EL_WORLD} len={1} />
    <Sequence durationInFrames={CUT3}>
      <Chip text="MOCK · TTS" style={{ left: 40, top: 36, background: "#333", color: PAPER, fontSize: 20 }} />
    </Sequence>
  </AbsoluteFill>
);

export const A3Voice: React.FC = () => <Footage slot="r0" muted={false} push={0.03} fallback={<VoiceMock />} />;
