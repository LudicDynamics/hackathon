import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionTrack } from "../components/Captions";
import { Footage } from "../components/Media";
import { ChalkWrite, Flash, PlayerCursor } from "../components/Kit";
import { Door } from "../components/Icons";
import { VoiceClip } from "../components/Voice";
import { RUST, walk, WriterCursor, type Step } from "../components/WriterCursor";
import { LYRA1, LYRA2, line, shown, VERA2, vlen } from "../lib/voice";
import { DISPLAY, HAND, INK, MONO, ORANGE, PAPER, TEXT } from "../lib/theme";
import { tr } from "../lib/lang";
import { DiveIn, NookMock, PullBack } from "./S5Infinite";

// ACT 5 · Infinite exploration. The Moonlit Pact: one promise, one door, and the writer builds the next place
// as you walk into it (0–480). Then a character's own nook (480–720), then the canvas that never runs out (720–840).

const OPEN = 180;
const CONTRACT = 300;
const NOOK = 240;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MOON = "scenes/moonlit-opening.png";

const MoonlitOpen: React.FC = () => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, OPEN], [1.04, 1.3], clamp);
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${k})`, transformOrigin: "52% 58%" }}>
        <Img src={staticFile(MOON)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 52% 60%, rgba(190,170,255,${0.1 + 0.06 * Math.sin(f / 7)}), transparent 40%)` }} />
    </AbsoluteFill>
  );
};

// Real choices from templates/moonlit-contract/world/opening.md.
const OPTIONS = [
  tr("Make a contract. With you, beyond this door.", "缔结契约。和你一起，走过这扇门。"),
  tr("But before that, I want to hear what you promise in the contract.", "在那之前，我想先听听你在契约里许下什么。"),
  tr("Not making a contract now. Please let me think a little.", "现在还不缔约。请让我再想一想。"),
];
const CLICK = 130;

type Made = { at: number; x: number; y: number; w: number; h: number; file: string; kind: "md" | "image" | "gate" };
const MADE: Made[] = [
  { at: 188, x: 1040, y: 150, w: 330, h: 210, file: "moonlit-courtyard/README.md", kind: "md" },
  { at: 213, x: 1440, y: 150, w: 330, h: 210, file: "opening.md", kind: "md" },
  { at: 238, x: 1040, y: 420, w: 330, h: 210, file: "item.md", kind: "md" },
  { at: 263, x: 1440, y: 400, w: 400, h: 260, file: "background.png", kind: "image" },
  { at: 285, x: 1240, y: 720, w: 330, h: 230, file: "world/moonlit-courtyard", kind: "gate" },
];
const STEPS: Step[] = [
  { at: 145, x: 330, y: 820, label: "reading  blue-ribbon.md" },
  ...MADE.map((m) => ({ at: m.at - 18, x: m.x + 24, y: m.y + 24, label: `${m.kind === "image" ? "painting" : m.kind === "gate" ? "opening" : "writing"}  ${m.file}` })),
];

const MadeCard: React.FC<{ m: Made }> = ({ m }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < m.at) return null;
  const s = spring({ frame: f - m.at, fps, config: { damping: 12, stiffness: 210 } });
  const base: React.CSSProperties = { position: "absolute", left: m.x, top: m.y, width: m.w, height: m.h, borderRadius: 14, transform: `scale(${s})`, boxShadow: "0 18px 40px rgba(0,0,0,.6)", overflow: "hidden" };
  if (m.kind === "image")
    return (
      <div style={{ ...base, background: PAPER, padding: 8 }}>
        <Img src={staticFile(MOON)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 85%", borderRadius: 8, filter: "hue-rotate(-12deg) brightness(1.1)" }} />
      </div>
    );
  if (m.kind === "gate")
    return (
      <div style={{ ...base, background: "#221c2e", border: `3px solid ${ORANGE}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 0 ${50 + 20 * Math.sin(f / 5)}px ${ORANGE}88` }}>
        <Door size={110} color={ORANGE} />
        <div style={{ fontFamily: MONO, fontSize: 20, color: PAPER }}>{m.file}</div>
      </div>
    );
  return (
    <div style={{ ...base, background: PAPER, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 19, color: RUST }}>{m.file}</div>
      {[0.9, 0.75, 0.85, 0.5].map((w, i) => (
        <div key={i} style={{ height: 11, width: `${w * 100}%`, background: "#2a2622", borderRadius: 6, opacity: 0.7 }} />
      ))}
    </div>
  );
};

const Contract: React.FC = () => {
  const f = useCurrentFrame();
  const cur = walk(STEPS, f, 16, { x: 1920, y: 1000 });
  const chosen = f >= CLICK;
  const px = interpolate(f, [60, CLICK - 6], [1500, 520], clamp);
  const py = interpolate(f, [60, CLICK - 6], [900, 432], clamp);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ filter: "blur(14px) brightness(.35)", transform: "scale(1.15)" }}>
        <Img src={staticFile(MOON)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 130, top: 150, width: 800, background: PAPER, borderRadius: 16, padding: "34px 40px", boxShadow: "0 30px 70px rgba(0,0,0,.6)" }}>
        <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 54, color: INK }}>{tr("By Your Own Will", "出于你自己的意志")}</div>
        <ChalkWrite text={tr("“Will you bind a contract with me and walk this night together?”", "“你愿意与我缔结契约，共度这一夜吗？”")} start={4} cps={40} size={34} color="#3a2f26" style={{ marginTop: 10 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
          {OPTIONS.map((o, i) => (
            <div key={o} style={{ fontFamily: TEXT, fontWeight: 600, fontSize: 25, color: chosen && i === 0 ? INK : "#3a2f26", background: chosen && i === 0 ? ORANGE : "rgba(0,0,0,.06)", padding: "14px 18px", borderRadius: 10, opacity: chosen && i > 0 ? 0.35 : 1 }}>
              {o}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 200, top: 760, width: 300, height: 150, background: PAPER, borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 40px rgba(0,0,0,.6)", outline: cur.step === 0 && cur.arrived ? `4px solid ${RUST}` : "none" }}>
        <div style={{ height: 34, background: "#3D6FE0" }} />
        <div style={{ fontFamily: MONO, fontSize: 20, color: INK, padding: "16px 20px" }}>blue-ribbon.md</div>
      </div>
      {MADE.map((m) => (
        <MadeCard key={m.file} m={m} />
      ))}
      {f < 150 && <PlayerCursor x={px} y={py} color={ORANGE} pressed={f >= CLICK && f < CLICK + 6} />}
      {f >= 140 && <WriterCursor x={cur.x} y={cur.y} label={cur.label} />}
    </AbsoluteFill>
  );
};

const Nook: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={45}>
      <DiveIn />
    </Sequence>
    <Sequence from={45}>
      <Footage slot="r5" fallback={<NookMock />} />
    </Sequence>
    <Flash at={43} len={3} />
  </AbsoluteFill>
);

const sub = (id: string, at: number) => ({ from: at / 30, to: (at + vlen(id)) / 30 + 0.2, text: shown(id), speaker: line(id).speaker });

export const A5Infinite: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {/* The user's R5a recording (Moonlit Pact: accept → the writer builds the courtyard) replaces both mock beats. */}
    <Sequence durationInFrames={OPEN + CONTRACT}>
      <Footage
        slot="r5a"
        fallback={
          <>
            <Sequence durationInFrames={OPEN}>
              <MoonlitOpen />
            </Sequence>
            <Sequence from={OPEN} durationInFrames={CONTRACT}>
              <Contract />
            </Sequence>
          </>
        }
      />
    </Sequence>
    <Sequence from={OPEN + CONTRACT} durationInFrames={NOOK}>
      <Nook />
    </Sequence>
    <Sequence from={OPEN + CONTRACT + NOOK}>
      <PullBack />
    </Sequence>
    <Flash at={OPEN} len={1} />
    <Flash at={OPEN + CONTRACT + NOOK} len={1} />
    {[
      ["lyra-1", LYRA1],
      ["lyra-2", LYRA2],
      ["vera-2", VERA2],
    ].map(([id, at]) => (
      <Sequence key={id} from={at as number}>
        <VoiceClip id={id as string} />
      </Sequence>
    ))}
    <CaptionTrack cues={[sub("lyra-1", LYRA1), sub("lyra-2", LYRA2), sub("vera-2", VERA2)]} />
    <div style={{ display: "none", fontFamily: DISPLAY }} />
  </AbsoluteFill>
);
