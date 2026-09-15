import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ChalkWrite, Slam, TypingDots } from "../components/Kit";
import { cast } from "../lib/assets";
import { INK, PAPER } from "../lib/theme";
import { LANG, tr } from "../lib/lang";
import { DiceSlot } from "./parts/DiceSlot";

// ACT 1 · "Stories have always been worlds." Read → play → talk to one character → but never *live* in one.
// Beats (frames): ink 0–120, book 120–210, game 210–300, chatbot 300–420, "live." 420–510.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Ink writing itself on parchment — the Moonlit Pact's first line. */
const Ink: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#EADFCB", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${1.02 + f * 0.0014})`, transformOrigin: "28% 52%" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 150 + i * 92, height: 2, background: "rgba(90,70,50,.10)" }} />
        ))}
        <div style={{ position: "absolute", left: 210, top: 330, width: 1500, display: "flex", flexDirection: "column", gap: 18 }}>
          <ChalkWrite text={tr("A slender moonlight fell through", "一缕细细的月光，")} start={6} cps={LANG === "zh" ? 9 : 21} size={96} color="#2a2118" />
          <ChalkWrite text={tr("a crumbling stone arch.", "穿过坍塌的石拱。")} start={56} cps={LANG === "zh" ? 9 : 21} size={96} color="#2a2118" />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 38% 48%, rgba(255,244,220,.55), transparent 55%), radial-gradient(ellipse at center, transparent 50%, rgba(50,32,16,.6) 100%)" }} />
    </AbsoluteFill>
  );
};

const PAGES = ["scenes/wuwu-harbor-chart.webp", "scenes/whitechapel-map.webp", "scenes/first-snow-first-snow.webp", "scenes/divergence-tonight.webp"];
const LAST_PAGE = "scenes/magic-academy-academy-library.webp";

/** A book whose pages are our worlds, flipping. */
const Book: React.FC = () => {
  const f = useCurrentFrame();
  const PW = 700;
  const PH = 860;
  const top = (1080 - PH) / 2;
  const page = (src: string) => (
    <div style={{ position: "absolute", inset: 0, background: PAPER, padding: 30, borderRadius: "0 14px 14px 0" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: INK, perspective: 2600, transform: `scale(${1.08 - f * 0.0008})` }}>
      <div style={{ position: "absolute", left: 960 - PW, top, width: PW, height: PH, background: "#e6dcc6", borderRadius: "14px 0 0 14px", boxShadow: "0 40px 90px rgba(0,0,0,.7)" }} />
      <div style={{ position: "absolute", left: 960, top, width: PW, height: PH, boxShadow: "0 40px 90px rgba(0,0,0,.7)" }}>{page(LAST_PAGE)}</div>
      {PAGES.map((src, k) => {
        const p = interpolate(f, [6 + k * 20, 6 + k * 20 + 17], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        return (
          <div
            key={src}
            style={{
              position: "absolute",
              left: 960,
              top,
              width: PW,
              height: PH,
              transformOrigin: "0% 50%",
              transformStyle: "preserve-3d",
              transform: `rotateY(${-180 * p}deg)`,
              zIndex: p > 0.5 ? 10 + k : 100 - k,
            }}
          >
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>{page(src)}</div>
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#efe6d3", borderRadius: "14px 0 0 14px" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Games: dice crash onto the harbour chart. */
const Game: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ filter: "brightness(.55)", transform: `scale(${1.15 - f * 0.001}) rotate(-2deg)` }}>
        <Img src={staticFile("scenes/wuwu-harbor-chart.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <DiceSlot dice="2d10" results={[7, 6]} throwAt={4} />
    </AbsoluteFill>
  );
};

/** A generic chatbot window: one character, alone, in a box. The camera leaves it in the dark. */
const Chatbot: React.FC = () => {
  const f = useCurrentFrame();
  const n = cast("nanami");
  const s = interpolate(f, [0, 120], [1.45, 0.5], { ...clamp, easing: Easing.out(Easing.cubic) });
  const bubbles = [
    { at: 6, right: false, w: 72 },
    { at: 22, right: true, w: 48 },
    { at: 38, right: false, w: 80 },
    { at: 54, right: true, w: 36 },
  ];
  return (
    <AbsoluteFill style={{ background: "#040404", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${s})`, width: 560, height: 720, background: "#f3f3f3", borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px #2a2a2a, 0 40px 140px rgba(0,0,0,.9)" }}>
        <div style={{ height: 86, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", borderBottom: "1px solid #ddd", background: "#fff" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", overflow: "hidden" }}>
            <Img src={staticFile(n.portrait)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: n.face }} />
          </div>
          <div style={{ width: 170, height: 16, borderRadius: 8, background: "#cdcdcd" }} />
        </div>
        <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {bubbles.map((b) =>
            f >= b.at ? (
              <div key={b.at} style={{ alignSelf: b.right ? "flex-end" : "flex-start", width: `${b.w}%`, height: 58, borderRadius: 20, background: b.right ? "#3b82f6" : "#dedede" }} />
            ) : null,
          )}
          {f > 70 && <TypingDots color="#9a9a9a" style={{ width: "fit-content" }} />}
        </div>
        <div style={{ height: 74, borderTop: "1px solid #ddd", background: "#fff" }} />
      </div>
    </AbsoluteFill>
  );
};

/** Whip's white turn card: one word. */
const Live: React.FC = () => (
  <AbsoluteFill style={{ background: "#FAF8F3", alignItems: "center", justifyContent: "center" }}>
    <Slam text={tr("live.", "活在其中。")} size={LANG === "zh" ? 300 : 380} color={INK} delay={4} />
  </AbsoluteFill>
);

export const A1Opening: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={120}>
      <Ink />
    </Sequence>
    <Sequence from={120} durationInFrames={90}>
      <Book />
    </Sequence>
    <Sequence from={210} durationInFrames={90}>
      <Game />
    </Sequence>
    <Sequence from={300} durationInFrames={120}>
      <Chatbot />
    </Sequence>
    <Sequence from={420} durationInFrames={90}>
      <Live />
    </Sequence>
  </AbsoluteFill>
);

export const springIn = (f: number, fps: number) => spring({ frame: f, fps, config: { damping: 14 } });
export const useFps = () => useVideoConfig().fps;
