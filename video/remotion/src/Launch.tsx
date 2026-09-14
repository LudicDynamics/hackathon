import React from "react";
import { AbsoluteFill, Audio, getInputProps, Sequence, staticFile } from "remotion";
import { CaptionTrack } from "./components/Captions";
import { NARRATION } from "./lib/captions";
import { sectionFrom, sectionLength, type SectionId } from "./lib/timing";
import { LYRA1, LYRA2, VERA2, vlen } from "./lib/voice";
import { INK } from "./lib/theme";
import { A1Opening } from "./scenes/A1Opening";
import { A2Canvas } from "./scenes/A2Canvas";
import { A3Voice } from "./scenes/A3Voice";
import { A4Worlds, BLOCKS, blockFrom } from "./scenes/A4Worlds";
import { A5Infinite } from "./scenes/A5Infinite";
import { A6Next, roundFrom, ROUNDS } from "./scenes/A6Next";
import { A7Formula } from "./scenes/A7Formula";
import { TYPE_SHARE } from "./scenes/S6Vision";

export const SCENES: Record<SectionId, React.FC> = {
  A1: A1Opening,
  A2: A2Canvas,
  A3: A3Voice,
  A4: A4Worlds,
  A5: A5Infinite,
  A6: A6Next,
  A7: A7Formula,
};

const at = (id: SectionId, f: number) => sectionFrom(id) + f;

/** Track A (chosen), spliced from placeholder-120.wav to 156s by video/music/make-track-a-156.sh. */
const MUSIC = (getInputProps() as { music?: string }).music ?? "music/track-a.wav";

/** Music dips under character lines outside A3 (A3's own arrangement is already near-silent). */
const DUCK = [
  ["lyra-1", at("A5", LYRA1)],
  ["lyra-2", at("A5", LYRA2)],
  ["vera-2", at("A5", VERA2)],
] as const;
/** A song dropped in with scripts/try-song.sh has no quiet voice section of its own (and may have vocals). */
const EXTERNAL_SONG = MUSIC.includes("/try-");
const musicVolume = (f: number) => {
  const under = DUCK.some(([id, a]) => f >= a - 8 && f <= a + vlen(id) + 8);
  if (EXTERNAL_SONG && f >= sectionFrom("A3") - 10 && f < sectionFrom("A3") + sectionLength("A3")) return 0.16;
  return under ? (EXTERNAL_SONG ? 0.25 : 0.38) : 0.8;
};

/** One-shot foley from assets/audio/foley, placed on the story beats. */
const SFX: { src: string; at: number; volume?: number }[] = [
  { src: "sfx/page-turn.mp3", at: at("A1", 126), volume: 0.6 },
  { src: "sfx/dice-roll.mp3", at: at("A1", 214) },
  // The key press lands on top of the riser — the loudest moment of the mix; keep it under -1 dBFS.
  { src: "sfx/se-card.mp3", at: at("A2", 20), volume: 0.45 },
  { src: "sfx/se-write.mp3", at: at("A2", 90 + 110), volume: 0.6 },
  ...BLOCKS.map((b, i) => ({ src: "sfx/se-success.mp3", at: at("A4", blockFrom(i) + b.beats.t + b.beats.b + b.beats.c + b.beats.d), volume: 0.45 })),
  { src: "sfx/se-bell.mp3", at: at("A5", 180 + 130) },
  { src: "sfx/gate-open.mp3", at: at("A5", 180 + 285) },
  { src: "sfx/dice-roll.mp3", at: at("A6", roundFrom(0) + Math.round(ROUNDS[0] * TYPE_SHARE)) },
  { src: "sfx/gate-open.mp3", at: at("A6", roundFrom(3) + Math.round(ROUNDS[3] * TYPE_SHARE)) },
  { src: "sfx/crit-chime.mp3", at: at("A7", 240) },
];

export const Launch: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {(Object.keys(SCENES) as SectionId[]).map((id) => {
      const C = SCENES[id];
      return (
        <Sequence key={id} name={id} from={sectionFrom(id)} durationInFrames={sectionLength(id)}>
          <C />
        </Sequence>
      );
    })}
    <CaptionTrack cues={NARRATION} />
    {/* Music peaks at -1.2 dB on its own; leave headroom so foley and voices on top don't clip.
        Candidates share one cue grid, so a song swap is an audio-only render: --props='{"music":"music/candidate-b.wav"}'. */}
    <Audio src={staticFile(MUSIC)} volume={musicVolume} />
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={90} name={`sfx ${s.src}`}>
        <Audio src={staticFile(s.src)} volume={(s.volume ?? 0.8) * 0.75} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
