import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import { CaptionTrack } from "./components/Captions";
import { Footage } from "./components/Media";
import { Flash } from "./components/Kit";
import { VoiceClip } from "./components/Voice";
import { WORLDS } from "./lib/assets";
import { NARRATION60 } from "./lib/captions60";
import narrationLiving from "./lib/narration-andrew60.json";
import narrationChara from "./lib/narration-andrew60-chara.json";
import { PROJECT } from "./lib/project";
import { sectionLength } from "./lib/timing";
import { INK } from "./lib/theme";
import { A2Canvas } from "./scenes/A2Canvas";
import { BeforeAfter, CreditsStat, TitleCard } from "./scenes/A4Worlds";
import { A6Next, MULTI_FROM } from "./scenes/A6Next";
import { Call as LiveCall, World as LiveWorld } from "./scenes/ALive";
import { A7Formula } from "./scenes/A7Formula";

/**
 * The 1-minute cut (the submission's limit), made from the full film's pieces, Fogwharf first; the other worlds show
 * their premise (title card + one line) and their core mechanic. 36 of its 60 seconds are the user's own runs.
 * Music: video/music/make-track-60.sh — every section starts on a hit of it.
 *   0–7 key press → the infinite canvas · 7–25 Fogwharf · 25–31 First Snow (premise, radio, its ending) · 31–35 Divergence
 *   (premise, before/after) · 35–45 GPT Live (said, then shown: the call, back into the world, the ticket card) ·
 *   45–48 the writer agent writes rules and code (built) · 48–51 next: friends in the same story (the only thing not
 *   built yet) · 51–60 the formula, logo and credit.
 */
export const TOTAL60 = 1800;

/** `len` frames of a scene, starting at the scene's own frame `skip` (the scene keeps its full length inside). */
const Part: React.FC<{ from: number; len: number; skip?: number; full: number; children: React.ReactNode }> = ({ from, len, skip = 0, full, children }) => (
  <Sequence from={from} durationInFrames={len}>
    <Sequence from={-skip} durationInFrames={full}>
      {children}
    </Sequence>
  </Sequence>
);

/** A footage beat from cuts.ts. */
const Shot: React.FC<{ from: number; len: number; slot: string; push?: number; children?: React.ReactNode }> = ({ from, len, slot, push = 0.05, children }) => (
  <Sequence from={from} durationInFrames={len}>
    <Footage slot={slot} push={push} />
    {children}
  </Sequence>
);

// Frames of each beat (music hits in brackets).
const FOG = 210; // Fogwharf title card
const DICE = 300; // [hit]
const GO = 540; // Vera: 「行くよ、もちろん。」
const SHIP = 600; // Vera: 「二隻目だね」 [hit]
const SHIP_VOICE = 44; // just those words (まだ… starts at 1.4s)
const CREDITS = 660;
const SNOW = 750; // First Snow title card [hit]
const ENDINGS = 795;
const DIV = 930; // Divergence title card [hit]
const LIVE = 1050;
const ELIAS = LIVE + 75; // his first line on the call
const WORLD_IN = 1230; // back into the world: corridor → open office, "Action confirmed" [hit]
const CARD = 1290; // the ticket card
const CODE = 1350; // [second drop]
const NEXT = 1440;
const FORMULA = 1530; // SANDBOX [hit]
const LOGO = 1650; // [final hit]

type Narration = { from: number; to: number; text: string; file: string; duration: number };
/** The narration voiced for this project name (the opening line says it): VO_TAG=andrew60 / andrew60-chara. */
const NARR = (PROJECT === "CharaCanvas" ? narrationChara : narrationLiving) as Narration[];
const underVO = (f: number) => NARR.some((n) => f >= Math.round(n.from * 30) - 6 && f < Math.round((n.from + n.duration) * 30) + 6);
const musicVolume = (f: number) => {
  if ((f >= GO - 6 && f < GO + 60) || (f >= SHIP - 6 && f < SHIP + SHIP_VOICE) || (f >= ELIAS - 6 && f < WORLD_IN)) return 0.3;
  return underVO(f) ? 0.6 : 0.8;
};

const SFX: { src: string; at: number; volume?: number }[] = [
  { src: "sfx/se-card.mp3", at: 20, volume: 0.45 },
  { src: "sfx/dice-roll.mp3", at: DICE + 51 },
  { src: "sfx/se-success.mp3", at: ENDINGS + 60, volume: 0.45 },
  { src: "sfx/se-success.mp3", at: CARD, volume: 0.45 },
  { src: "sfx/crit-chime.mp3", at: LOGO },
];

export const Launch60: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {/* The key press opening onto the infinite canvas (the writer agent's cursor, the cast); the drop lands at 1s. */}
    <Part from={0} len={FOG} full={sectionLength("A2")}>
      <A2Canvas />
    </Part>
    {/* Fogwharf, all from the user's 44-minute run. */}
    <Sequence from={FOG} durationInFrames={30}>
      <TitleCard w={WORLDS[0]} />
    </Sequence>
    <Shot from={FOG + 30} len={DICE - FOG - 30} slot="r1-c" push={0.1} />
    <Shot from={DICE} len={90} slot="r1-d" push={0.12} />
    <Shot from={390} len={90} slot="r1-writer" />
    <Shot from={480} len={60} slot="r1-ask" />
    <Shot from={GO} len={60} slot="r1-go" />
    <Shot from={SHIP} len={60} slot="r1-ship" />
    <Shot from={CREDITS} len={SNOW - CREDITS} slot="r1-e" push={0.03}>
      <CreditsStat />
    </Shot>
    {/* First Snow: its premise, Nanami on the radio (the user's run), then the ending CG it led to. (The other route's
        ending CG is covered in Japanese text — viewers disliked it; one clean CG is enough.) */}
    <Sequence from={SNOW} durationInFrames={ENDINGS - SNOW}>
      <TitleCard w={WORLDS[2]} />
    </Sequence>
    <Shot from={ENDINGS} len={60} slot="r3-b" />
    <Shot from={ENDINGS + 60} len={DIV - ENDINGS - 60} slot="r3-end2" push={0.04} />
    {/* Divergence: its premise, then the same street before and after. */}
    <Sequence from={DIV} durationInFrames={30}>
      <TitleCard w={WORLDS[3]} />
    </Sequence>
    <Sequence from={DIV + 30} durationInFrames={LIVE - DIV - 30}>
      <BeforeAfter />
    </Sequence>
    {/* GPT Live: the call from 1s in (the narration names the feature before Elias speaks); then back into the world —
        the last 2s of the corridor into the open office ("Action confirmed…") — and the ticket card he wrote. */}
    <Part from={LIVE} len={WORLD_IN - LIVE} skip={30} full={300}>
      <LiveCall />
    </Part>
    <Part from={WORLD_IN} len={CODE - WORLD_IN} skip={130 - (CARD - WORLD_IN)} full={240}>
      <LiveWorld />
    </Part>
    {/* Built: the writer agent typing a rule and its effect (first round). Next: friends in the same story (mock). */}
    <Part from={CODE} len={NEXT - CODE} skip={0} full={sectionLength("A6")}>
      <A6Next />
    </Part>
    <Part from={NEXT} len={FORMULA - NEXT} skip={MULTI_FROM + 60} full={sectionLength("A6")}>
      <A6Next />
    </Part>
    {/* The formula from its first hit (SANDBOX) to the equals, then straight to the logo on the final hit. */}
    <Part from={FORMULA} len={LOGO - FORMULA} skip={30} full={sectionLength("A7")}>
      <A7Formula />
    </Part>
    <Part from={LOGO} len={TOTAL60 - LOGO} skip={240} full={sectionLength("A7")}>
      <A7Formula />
    </Part>
    {[FOG, FOG + 30, DICE, 390, 480, GO, SHIP, CREDITS, SNOW, ENDINGS, ENDINGS + 60, DIV, DIV + 30, LIVE, WORLD_IN, CODE, NEXT, FORMULA, LOGO].map((at) => (
      <Flash key={at} at={at} len={[DICE, SHIP, SNOW, DIV, WORLD_IN, CODE, LOGO].includes(at) ? 2 : 1} />
    ))}
    <CaptionTrack cues={NARRATION60} />
    <Audio src={staticFile("music/track-60.wav")} volume={musicVolume} />
    <Sequence from={GO} durationInFrames={60} name="vera: I'm coming, of course">
      <VoiceClip id="vera-go" />
    </Sequence>
    <Sequence from={SHIP} durationInFrames={SHIP_VOICE} name="vera: the second ship">
      <Audio src={staticFile("voice/vera-ship.wav")} volume={(f) => interpolate(f, [SHIP_VOICE - 8, SHIP_VOICE - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </Sequence>
    {NARR.map((n, i) => (
      <Sequence key={`vo-${i}`} from={Math.round(n.from * 30)} durationInFrames={Math.ceil(n.duration * 30) + 2} name={`vo: ${n.text}`}>
        <Audio src={staticFile(n.file)} />
      </Sequence>
    ))}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={90} name={`sfx ${s.src}`}>
        <Audio src={staticFile(s.src)} volume={(s.volume ?? 0.8) * 0.75} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
