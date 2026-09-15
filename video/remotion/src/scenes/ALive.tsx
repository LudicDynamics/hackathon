import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Footage } from "../components/Media";
import { Flash } from "../components/Kit";
import { VoiceClip } from "../components/Voice";
import { Bubble, ELIAS_TINT, EliasTag, reveal } from "./A3Voice";

// GPT LIVE · a feature of its own, between infinite exploration and "Next" (v17). Introduced before it is shown
// (the user: feature first, then its demo): the narration says what GPT Live is over the call's first 3.5s, before
// Elias speaks; then, over the corridor, what a call can do to the world — and the ticket he wrote lands as a card.
// All from the user's 15.59 recording of Elias's world (cuts.ts `el-*`).

/** The call: 3:38.5–3:48.5 (your request on screen, then his two lines). */
export const LIVE_CALL = 300;
/** The corridor, the open-office door, "Action confirmed and the scene is synchronized." (5:32.0–5:36.3). */
const LIVE_ACT = 130;
/** Elias's voice on the call starts 3.5s in (3:42.0 in the recording). */
export const LIVE_VOICE_AT = 105;
/** Frames the voice clip lasts (voice/elias-2.wav, 6.5s). */
export const LIVE_VOICE_LEN = 195;

/** His two lines, relative to the call beat. */
const LINES = [
  { text: "Okay, let's take it slow and get it right.", from: 107, to: 207 },
  { text: "I'm checking what the ticket should cover.", from: 215, to: 296 },
];

/** On a GPT Live call. The box shows your request (English); his replies are voice only, so they are bubbles. */
export const Call: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Footage slot="el-live" push={0} />
      {/* The character card's bio is in Chinese in this take; soften it (the film shows English only). */}
      <div style={{ position: "absolute", left: 52, top: 282, width: 500, height: 108, backdropFilter: "blur(10px)", background: "rgba(40,38,34,.35)", borderRadius: 10 }} />
      <EliasTag label="REAL · GPT LIVE CALL" />
      <div style={{ position: "absolute", right: 70, top: 250, width: 640, display: "flex", flexDirection: "column", gap: 20 }}>
        {LINES.filter((l) => f >= l.from).map((l) => (
          <Bubble key={l.text} text={reveal(l.text, f, l.from, l.to - l.from)} mine={false} tint={ELIAS_TINT} />
        ))}
      </div>
      <Sequence from={LIVE_VOICE_AT}>
        <VoiceClip id="elias-2" />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Back on the canvas: the action is confirmed, and the ticket he wrote on the call is a card in the office. */
export const World: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={LIVE_ACT}>
      <Footage slot="el-act" push={0.03} />
    </Sequence>
    <Sequence from={LIVE_ACT}>
      {/* Zoomed onto the ticket card; the crop keeps the translate popup (top centre) out of frame. */}
      <AbsoluteFill style={{ transform: "scale(1.6)", transformOrigin: "21% 35%" }}>
        <Footage slot="el-item" push={0.05} />
      </AbsoluteFill>
      <EliasTag label="SAVED TO THE WORLD" />
    </Sequence>
    <Flash at={LIVE_ACT} len={1} />
  </AbsoluteFill>
);

export const ALive: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={LIVE_CALL}>
      <Call />
    </Sequence>
    <Sequence from={LIVE_CALL}>
      <World />
    </Sequence>
    <Flash at={0} len={2} />
    <Flash at={LIVE_CALL} len={1} />
  </AbsoluteFill>
);
