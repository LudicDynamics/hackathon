import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { S0ColdOpen } from "./scenes/S0ColdOpen";
import { S1Cast } from "./scenes/S1Cast";
import { S2OneCanvas } from "./scenes/S2OneCanvas";
import { S3Voice } from "./scenes/S3Voice";
import { BLOCK, S4Worlds } from "./scenes/S4Worlds";
import { S5Infinite } from "./scenes/S5Infinite";
import { ROUND_FROM, ROUNDS, S6Vision, TYPE_SHARE, WRITER, MULTI } from "./scenes/S6Vision";
import { S7Formula } from "./scenes/S7Formula";
import { sectionFrom, sectionLength, type SectionId } from "./lib/timing";
import { INK } from "./lib/theme";

export const SCENES: Record<SectionId, React.FC> = {
  S0: S0ColdOpen,
  S1: S1Cast,
  S2: S2OneCanvas,
  S3: S3Voice,
  S4: S4Worlds,
  S5: S5Infinite,
  S6: S6Vision,
  S7: S7Formula,
};

const at = (id: SectionId, f: number) => sectionFrom(id) + f;

/** One-shot foley from assets/audio/foley, placed on the story beats. */
const SFX: { src: string; at: number; volume?: number }[] = [
  { src: "sfx/se-card.mp3", at: at("S0", 14) },
  { src: "sfx/se-get.mp3", at: at("S2", 165) },
  { src: "sfx/se-bell.mp3", at: at("S2", 285) },
  ...[0, 1, 2, 3].map((i) => ({ src: "sfx/se-success.mp3", at: at("S4", i * BLOCK + 300), volume: 0.7 })),
  { src: "sfx/gate-open.mp3", at: at("S5", 88) },
  { src: "sfx/pen-scratch.mp3", at: at("S6", MULTI + 8), volume: 0.6 },
  { src: "sfx/dice-roll.mp3", at: at("S6", ROUND_FROM[0] + Math.round(ROUNDS[0] * TYPE_SHARE)) },
  { src: "sfx/gate-open.mp3", at: at("S6", ROUND_FROM[3] + Math.round(ROUNDS[3] * TYPE_SHARE)) },
  { src: "sfx/crit-chime.mp3", at: at("S7", 330) },
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
    {/* Music peaks at -0.6 dB on its own; leave headroom so foley on top doesn't clip. */}
    <Audio src={staticFile("music/placeholder-120.wav")} volume={0.8} />
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={90} name={`sfx ${s.src}`}>
        <Audio src={staticFile(s.src)} volume={(s.volume ?? 0.8) * 0.75} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const WRITER_FRAMES = WRITER;
