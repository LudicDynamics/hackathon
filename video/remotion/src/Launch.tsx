import React from "react";
import { AbsoluteFill, Audio, getInputProps, Sequence, staticFile } from "remotion";
import { CaptionTrack } from "./components/Captions";
import { VoiceClip } from "./components/Voice";
import { NARRATION } from "./lib/captions";
import narration from "./lib/narration.json";
import { sectionFrom, sectionLength, type SectionId } from "./lib/timing";
import { LYRA1, LYRA2, VERA2, vlen } from "./lib/voice";
import { INK } from "./lib/theme";
import { A1Opening } from "./scenes/A1Opening";
import { A2Canvas } from "./scenes/A2Canvas";
import { A3Voice } from "./scenes/A3Voice";
import { A4Worlds, BLOCKS, blockFrom, blockIndex, payoffFrom, slotFrom, slotLen } from "./scenes/A4Worlds";
import { A5Infinite } from "./scenes/A5Infinite";
import { A6Next, roundFrom, ROUNDS } from "./scenes/A6Next";
import { ALive, LIVE_VOICE_AT, LIVE_VOICE_LEN } from "./scenes/ALive";
import { A7Formula } from "./scenes/A7Formula";
import { TYPE_SHARE } from "./scenes/S6Vision";

export const SCENES: Record<SectionId, React.FC> = {
  A1: A1Opening,
  A2: A2Canvas,
  A3: A3Voice,
  A4: A4Worlds,
  A5: A5Infinite,
  AL: ALive,
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
/** Ryo speaks in the user's Divergence recording (the d beat of Divergence). */
const I4 = blockIndex(4);
const W4 = BLOCKS[I4].beats;
const RYO_AT = at("A4", blockFrom(I4) + W4.t + W4.b + W4.c);
/** Vera's own lines from the user's Fogwharf run: 「2隻目だね」 and 「私なら、まだ戻らない。」. */
const I1 = blockIndex(1);
const VERA_SHIP_AT = at("A4", slotFrom(I1, "r1-ship"));
const VERA_SHIP_LEN = slotLen(I1, "r1-ship");
const VERA_BACK_AT = at("A4", slotFrom(I1, "r1-v2"));
const VERA_BACK_LEN = slotLen(I1, "r1-v2");
/** 「行くよ、もちろん。」 — her answer when the player asks her to come along (19:55.9). */
const VERA_GO_AT = at("A4", slotFrom(I1, "r1-go"));
const VERA_GO_LEN = slotLen(I1, "r1-go");
/** Elias on the GPT Live call (the AL feature beat). */
const ELIAS_LIVE_AT = at("AL", LIVE_VOICE_AT);
/** …and the rest of that reply, after her pause: what to check instead of turning back. */
const VERA_BACK2_AT = at("A4", slotFrom(I1, "r1-v2b"));
const VERA_BACK2_LEN = slotLen(I1, "r1-v2b");
/** 「あんたを無条件に信用してるわけじゃないよ…」 — the audio clip starts where the picture does (5:26.0). */
const VERA_TRUST_AT = at("A4", slotFrom(I1, "r1-trust"));
const VERA_TRUST_LEN = slotLen(I1, "r1-trust");

/**
 * Temporary TTS narration for every narration subtitle (video/music/make-narration.mjs), so the user can hear the
 * film voiced before recording it themselves. Render without it: --props='{"vo":false}'.
 */
type Narration = { from: number; to: number; text: string; file: string; duration: number };
const VO = (getInputProps() as { vo?: boolean }).vo !== false;
const NARR = VO ? (narration as Narration[]) : [];
const underVO = (f: number) => NARR.some((n) => f >= Math.round(n.from * 30) - 6 && f < Math.round((n.from + n.duration) * 30) + 6);

/** A song dropped in with scripts/try-song.sh has no quiet voice section of its own (and may have vocals). */
const EXTERNAL_SONG = MUSIC.includes("/try-");
const musicVolume = (f: number) => {
  if (f >= RYO_AT - 6 && f < RYO_AT + W4.d) return 0.3;
  if (f >= VERA_BACK_AT - 6 && f < VERA_BACK2_AT + VERA_BACK2_LEN) return 0.3;
  if (f >= VERA_SHIP_AT - 6 && f < VERA_SHIP_AT + VERA_SHIP_LEN) return 0.35;
  if (f >= VERA_TRUST_AT - 6 && f < VERA_TRUST_AT + VERA_TRUST_LEN) return 0.3;
  if (f >= VERA_GO_AT - 6 && f < VERA_GO_AT + VERA_GO_LEN) return 0.3;
  if (f >= ELIAS_LIVE_AT - 6 && f < ELIAS_LIVE_AT + LIVE_VOICE_LEN) return 0.3;
  const under = DUCK.some(([id, a]) => f >= a - 8 && f <= a + vlen(id) + 8);
  if (EXTERNAL_SONG && f >= sectionFrom("A3") - 10 && f < sectionFrom("A3") + sectionLength("A3")) return 0.16;
  // Narration only dips the music a little: its melody and hits carry the film (character voices dip it further).
  if (underVO(f)) return EXTERNAL_SONG ? 0.25 : 0.6;
  return under ? (EXTERNAL_SONG ? 0.25 : 0.38) : 0.8;
};

/** One-shot foley from assets/audio/foley, placed on the story beats. */
const SFX: { src: string; at: number; volume?: number }[] = [
  { src: "sfx/page-turn.mp3", at: at("A1", 126), volume: 0.6 },
  { src: "sfx/dice-roll.mp3", at: at("A1", 214) },
  // The key press lands on top of the riser — the loudest moment of the mix; keep it under -1 dBFS.
  { src: "sfx/se-card.mp3", at: at("A2", 20), volume: 0.45 },
  { src: "sfx/se-write.mp3", at: at("A2", 90 + 110), volume: 0.6 },
  ...BLOCKS.map((_, i) => ({ src: "sfx/se-success.mp3", at: at("A4", payoffFrom(i)), volume: 0.45 })),
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
    {/* Ryo's and Vera's own lines from the user's runs, levelled to -16 LUFS (video/music/make-ryo-line.sh). */}
    <Sequence from={RYO_AT} durationInFrames={W4.d} name="ryo voice">
      <VoiceClip id="ryo-1" />
    </Sequence>
    <Sequence from={VERA_BACK_AT} durationInFrames={VERA_BACK_LEN} name="vera won't go back">
      <VoiceClip id="vera-back" />
    </Sequence>
    <Sequence from={VERA_BACK2_AT} durationInFrames={VERA_BACK2_LEN} name="vera: check the crates or the tracks">
      <VoiceClip id="vera-back2" />
    </Sequence>
    <Sequence from={VERA_SHIP_AT} durationInFrames={VERA_SHIP_LEN} name="vera: the second ship">
      <VoiceClip id="vera-ship" />
    </Sequence>
    <Sequence from={VERA_GO_AT} durationInFrames={VERA_GO_LEN} name="vera: I'm coming, of course">
      <VoiceClip id="vera-go" />
    </Sequence>
    <Sequence from={VERA_TRUST_AT} durationInFrames={VERA_TRUST_LEN} name="vera: not unconditionally">
      <VoiceClip id="vera-trust" />
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
