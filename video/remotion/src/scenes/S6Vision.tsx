import React, { useMemo } from "react";
import { AbsoluteFill, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasWorld, layoutCards, toScreen, type Cam, type CardSpec } from "../components/Canvas";
import { Footage, Media } from "../components/Media";
import { ChalkWrite, Chip, CursorAvatar, Flash, PlayerCursor } from "../components/Kit";
import { Door } from "../components/Icons";
import { CAST, cast } from "../lib/assets";
import { SNIPPETS } from "../lib/snippets";
import { DiceSlot } from "./parts/DiceSlot";
import { DISPLAY, INK, INK_2, MONO, ORANGE, PAPER, PLAYERS } from "../lib/theme";
import { H, W } from "../lib/timing";

export const MULTI = 300;
export const WRITER = 180;
export const ROUNDS = [90, 70, 60, 50];
export const ROUND_FROM = ROUNDS.map((_, i) => MULTI + WRITER + ROUNDS.slice(0, i).reduce((a, b) => a + b, 0));
/** Fraction of a round spent typing before the effect fires. */
export const TYPE_SHARE = 0.6;

// ───────────────────────── Multiplayer (mock) ─────────────────────────

type Rect = { x: number; y: number; w: number; h: number };
const FULL: Rect = { x: 0, y: 0, w: W, h: H };
const layout = (n: number): Rect[] => {
  const m = 60;
  const g = 36;
  if (n === 1) return [{ x: 160, y: 90, w: 1600, h: 900 }];
  if (n === 2) {
    const w = (W - m * 2 - g) / 2;
    return [0, 1].map((i) => ({ x: m + i * (w + g), y: (H - (w * 9) / 16) / 2, w, h: (w * 9) / 16 }));
  }
  const w = (W - m * 2 - g) / 2;
  const h = (w * 9) / 16;
  const top = (H - h * 2 - g) / 2;
  return [0, 1, 2, 3].map((i) => ({ x: m + (i % 2) * (w + g), y: top + Math.floor(i / 2) * (h + g), w, h }));
};
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

const playerAt = (i: number, f: number) => ({ x: -500 + i * 330 + 260 * Math.sin(f / (28 + i * 6) + i), y: -150 + (i % 2) * 300 + 180 * Math.cos(f / (35 + i * 4) + i * 2) });
const dragged = (f: number) => ({ x: -300 + 600 * Math.sin(f / 70), y: 120 * Math.cos(f / 50) });

const SharedCanvas: React.FC<{ viewer: number; cards: CardSpec[] }> = ({ viewer, cards }) => {
  const f = useCurrentFrame();
  const cam: Cam = { x: [-120, 160, -60, 90][viewer] + 40 * Math.sin(f / 60), y: [-40, 30, 60, -50][viewer], scale: 0.5 };
  const d = dragged(f);
  const all: CardSpec[] = [...cards, { id: "drag", x: d.x, y: d.y, w: 520, h: 360, rot: 3, kind: "scene", src: "scenes/wuwu-seventh-berth.webp", ring: 0, tone: "#555" }];
  return (
    <CanvasWorld
      cam={cam}
      cards={all}
      overlay={
        <>
          {CAST.map((c, i) => {
            const s = toScreen(cam, -600 + i * 240 + 90 * Math.sin(f / 30 + i), 260 * Math.sin(f / 45 + i * 1.4));
            return <CursorAvatar key={c.id} portrait={c.portrait} color={c.tint} x={s.x} y={s.y} size={84} />;
          })}
          {PLAYERS.map((col, i) => {
            const pos = i === 1 ? dragged(f) : playerAt(i, f);
            const s = toScreen(cam, pos.x, pos.y);
            return <PlayerCursor key={col} x={s.x} y={s.y} color={col} pressed={i === 1} size={62} />;
          })}
        </>
      }
    />
  );
};

const BrowserWindow: React.FC<{ r: Rect; viewer: number; cards: CardSpec[]; chrome: number }> = ({ r, viewer, cards, chrome }) => {
  const bar = 46 * chrome;
  const k = r.w / W;
  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h + bar, borderRadius: 18 * chrome, overflow: "hidden", boxShadow: chrome ? "0 30px 80px rgba(0,0,0,.6)" : "none", background: INK_2, outline: chrome ? `3px solid ${PLAYERS[viewer]}` : "none" }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10, paddingLeft: 18, opacity: chrome }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
        ))}
        <div style={{ marginLeft: 18, height: 26, width: "40%", borderRadius: 13, background: "#2a2a2a" }} />
      </div>
      <div style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0" }}>
        <SharedCanvas viewer={viewer} cards={cards} />
      </div>
    </div>
  );
};

export const Multiplayer: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const cards = useMemo(() => layoutCards({ radius: 6, seed: "mp", density: 0.55 }), []);
  const n = f < d * 0.25 ? 1 : f < d * 0.5 ? 2 : 4;
  const merge = interpolate(f, [d - 45, d - 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rects = layout(n).map((r) => mix(r, FULL, merge));
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {rects.map((r, i) => (merge > 0 && i > 0 ? null : <BrowserWindow key={i} r={r} viewer={i} cards={cards} chrome={1 - merge} />))}
      {merge === 0 && rects.slice(1).map((r, i) => <BrowserWindow key={`w${i + 1}`} r={r} viewer={i + 1} cards={cards} chrome={1} />)}
      <Chip text="next" style={{ right: 40, top: 30 }} />
    </AbsoluteFill>
  );
};

// ───────────────────────── Writer: story → entities → files ─────────────────────────

const LINES = [
  { text: "The fog parts over berth seven.", at: 8 },
  { text: "A harbour master waits with a brass key.", at: 52 },
  { text: "Roll to see if he trusts you.", at: 100 },
];
const FILES = [
  { path: "world/berth-7/README.md", at: 30 },
  { path: "characters/harbor-master.md", at: 75 },
  { path: "player/brass-key.md", at: 95 },
  { path: "world/berth-7/trust-roll.md", at: 125 },
];

const Drop: React.FC<{ at: number; x: number; y: number; rot: number; children: React.ReactNode }> = ({ at, x, y, rot, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const s = spring({ frame: f - at, fps, config: { damping: 11, stiffness: 180 } });
  return <div style={{ position: "absolute", left: x, top: y - (1 - s) * 500, transform: `rotate(${rot * s}deg)`, opacity: Math.min(1, s * 2) }}>{children}</div>;
};

const Writer: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle, rgba(244,241,234,.18) 1.5px, transparent 1.8px)", backgroundSize: "34px 34px" }} />
      <div style={{ position: "absolute", left: 110, top: 100, width: 1060, background: PAPER, borderRadius: 16, padding: "40px 50px", transform: "rotate(-1deg)", boxShadow: "0 20px 50px rgba(0,0,0,.6)", display: "flex", flexDirection: "column", gap: 14 }}>
        {LINES.map((l) => (
          <ChalkWrite key={l.text} text={l.text} start={l.at} cps={30} size={56} />
        ))}
      </div>
      <Drop at={40} x={130} y={560} rot={-4}>
        <div style={{ width: 420, height: 290, background: PAPER, padding: 10, borderRadius: 12 }}>
          <Img src={staticFile("scenes/wuwu-seventh-berth.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
        </div>
      </Drop>
      <Drop at={85} x={600} y={600} rot={3}>
        <CursorAvatar portrait="portraits/old-mo.webp" color="#C9A24A" x={120} y={120} size={220} />
      </Drop>
      <Drop at={105} x={880} y={640} rot={-6}>
        <div style={{ width: 170, height: 170, borderRadius: 22, background: "#C9A24A", border: `6px solid ${PAPER}` }} />
      </Drop>
      <Drop at={135} x={880} y={860} rot={8}>
        <div style={{ width: 150, height: 150, borderRadius: 28, background: PAPER, display: "grid", gridTemplateColumns: "1fr 1fr", padding: 26, gap: 26 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderRadius: "50%", background: i === 3 ? ORANGE : INK }} />
          ))}
        </div>
      </Drop>
      <div style={{ position: "absolute", right: 90, top: 120, width: 620, background: INK_2, borderRadius: 18, padding: "30px 34px", fontFamily: MONO, fontSize: 30, color: PAPER, lineHeight: 1.9, boxShadow: "0 20px 50px rgba(0,0,0,.6)" }}>
        <div style={{ opacity: 0.45 }}>worlds/fogwharf/</div>
        {FILES.map((file) =>
          f >= file.at ? (
            <div key={file.path} style={{ opacity: interpolate(f - file.at, [0, 6], [0, 1], { extrapolateRight: "clamp" }) }}>
              <span style={{ color: ORANGE }}>+ </span>
              {file.path}
            </div>
          ) : null,
        )}
      </div>
    </AbsoluteFill>
  );
};

// ───────────────────────── Code → effect ─────────────────────────

const CodePanel: React.FC<{ code: string; file: string; len: number }> = ({ code, file, len }) => {
  const f = useCurrentFrame();
  const n = Math.floor(interpolate(f, [0, len * TYPE_SHARE], [0, code.length], { extrapolateRight: "clamp" }));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 820, height: H, background: "#0f0f0f", padding: "70px 56px", fontFamily: MONO, fontSize: 31, lineHeight: 1.55, color: PAPER, whiteSpace: "pre" }}>
      <div style={{ color: ORANGE, fontSize: 24, marginBottom: 26, letterSpacing: 1 }}>{file}</div>
      {code.slice(0, n)}
      <span style={{ background: ORANGE, color: ORANGE }}>{f % 16 < 8 ? "_" : " "}</span>
    </div>
  );
};

export const DiceMock: React.FC<{ go: number }> = ({ go }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: f - go, fps, config: { damping: 12, stiffness: 90 } });
  if (f < go) return null;
  const spin = (1 - t) * 900;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1200 }}>
      <div style={{ width: 300, height: 300, borderRadius: 50, background: PAPER, transform: `translateY(${(1 - t) * -500}px) rotateX(${spin}deg) rotateZ(${spin * 0.6}deg)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 40px 80px rgba(0,0,0,.6)" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 150, color: t > 0.9 ? ORANGE : INK }}>{t > 0.9 ? 73 : Math.floor(random(`d${f}`) * 100)}</div>
      </div>
    </AbsoluteFill>
  );
};

const Snow: React.FC<{ go: number }> = ({ go }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [go, go + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: k }}>
      {Array.from({ length: 140 }, (_, i) => {
        const x = random(`sx${i}`) * 1100;
        const sp = 2 + random(`sv${i}`) * 5;
        const y = ((random(`sy${i}`) * H + (f - go) * sp * 3) % (H + 40)) - 20;
        const r = 3 + random(`sr${i}`) * 7;
        return <div key={i} style={{ position: "absolute", left: x + 30 * Math.sin((f + i * 10) / 20), top: y, width: r, height: r, borderRadius: "50%", background: "#fff", opacity: 0.85 }} />;
      })}
    </AbsoluteFill>
  );
};

const Beam: React.FC<{ go: number }> = ({ go }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [go, go + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: k, mixBlendMode: "screen" }}>
      <AbsoluteFill style={{ background: `conic-gradient(from ${(f - go) * 9}deg at 55% 38%, rgba(255,214,140,.85) 0deg, transparent 22deg, transparent 360deg)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 55% 38%, rgba(255,220,150,.9) 0, transparent 14%)" }} />
    </AbsoluteFill>
  );
};

/** Door leaf inside templates/unwritten-door/assets/tokens/door.png, as fractions of the image. */
const LEAF = { l: 0.226, t: 0.055, w: 0.558, h: 0.825 };
const DOOR_IMG = "scenes/unwritten-door.png";
const BEYOND = "scenes/wuwu-beyond-the-fog.webp";

/**
 * The Unwritten Door's real door: the leaf (cut from the same image) swings open on its hinge and warm light
 * pours out. A Seedance clip at footage/gate-* replaces it automatically.
 */
const Gate: React.FC<{ go: number }> = ({ go }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = spring({ frame: f - go, fps, config: { damping: 18, stiffness: 70 } });
  const leaf: React.CSSProperties = { position: "absolute", left: `${LEAF.l * 100}%`, top: `${LEAF.t * 100}%`, width: `${LEAF.w * 100}%`, height: `${LEAF.h * 100}%` };
  return (
    <Footage
      slot="gate"
      fallback={
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + open * 0.08})` }}>
          <div style={{ position: "relative", height: 1000, perspective: 1800 }}>
            <Img src={staticFile(DOOR_IMG)} style={{ height: "100%", display: "block" }} />
            {/* Behind the door: another place (the new road beyond the fog), softly lit. */}
            <div style={{ ...leaf, overflow: "hidden", opacity: Math.min(1, open * 3) }}>
              <Img src={staticFile(BEYOND)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.25 - open * 0.15})`, filter: `brightness(${0.9 + open * 0.3})` }} />
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(255,250,240,.35) 100%)" }} />
            </div>
            <div
              style={{
                ...leaf,
                backgroundImage: `url(${staticFile(DOOR_IMG)})`,
                backgroundSize: `${100 / LEAF.w}% ${100 / LEAF.h}%`,
                backgroundPosition: `${(LEAF.l / (1 - LEAF.w)) * 100}% ${(LEAF.t / (1 - LEAF.h)) * 100}%`,
                transformOrigin: "0% 50%",
                transform: `rotateY(${-102 * open}deg)`,
                filter: `brightness(${1 - open * 0.55})`,
                boxShadow: `${-30 * open}px 0 60px rgba(0,0,0,${0.6 * open})`,
              }}
            />
            <div style={{ position: "absolute", left: "-60%", right: "-60%", top: "-20%", bottom: "-40%", mixBlendMode: "screen", opacity: open * 0.5, background: "radial-gradient(ellipse at 50% 52%, rgba(225,235,255,.5) 0%, rgba(200,215,240,.15) 24%, transparent 45%)" }} />
            <div style={{ position: "absolute", left: `${LEAF.l * 100 - 12}%`, width: `${LEAF.w * 100 + 24}%`, top: "86%", height: "30%", mixBlendMode: "screen", opacity: open * 0.45, background: "linear-gradient(to bottom, rgba(220,230,250,.55), transparent)", clipPath: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)" }} />
          </div>
        </AbsoluteFill>
      }
    />
  );
};

const EFFECTS = [
  {
    bg: "bg/whitechapel/fourth.webm",
    Fx: ({ go }: { go: number }) => <Footage slot="c3" fallback={<DiceSlot dice="2d10" results={[7, 6]} throwAt={go} showResult expect=">=11" desc="Deciphering the scrapes" />} />,
  },
  { bg: "bg/first-snow/rooftop.webm", Fx: Snow },
  { bg: "bg/wuwu/lighthouse.webm", Fx: Beam },
  { bg: "bg/unwritten-door/intro.webm", Fx: Gate },
];

export const Round: React.FC<{ i: number; len?: number }> = ({ i, len: lenProp }) => {
  const f = useCurrentFrame();
  const len = lenProp ?? ROUNDS[i];
  const go = Math.round(len * TYPE_SHARE);
  const { bg, Fx } = EFFECTS[i];
  const lit = f >= go;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: "absolute", left: 820, top: 0, width: W - 820, height: H, overflow: "hidden" }}>
        <AbsoluteFill style={{ filter: `brightness(${lit ? 0.8 : 0.3})`, transform: `scale(${lit ? 1.04 : 1.12})` }}>
          <Media src={bg} />
        </AbsoluteFill>
        {lit && <Fx go={go} />}
      </div>
      <CodePanel code={SNIPPETS[i].code} file={SNIPPETS[i].file} len={len} />
      <Flash at={go} len={1} />
    </AbsoluteFill>
  );
};

export const S6Vision: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={MULTI}>
      <Multiplayer />
    </Sequence>
    <Sequence from={MULTI} durationInFrames={WRITER}>
      <Writer />
    </Sequence>
    {ROUNDS.map((len, i) => (
      <Sequence key={i} from={ROUND_FROM[i]} durationInFrames={len}>
        <Round i={i} />
      </Sequence>
    ))}
    <Flash at={MULTI} len={2} />
  </AbsoluteFill>
);

export const heroOf = cast;
