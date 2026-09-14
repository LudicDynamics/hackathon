import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Flash } from "../components/Kit";
import { INK } from "../lib/theme";
import { Multiplayer, Round } from "./S6Vision";

// ACT 6 · Next: friends in the same story (mock, marked `next`) → the writer writes the plot, the rules and the
// code: real frontmatter typed on the left, the effect on the right, four rounds getting faster.

export const MULTI = 240;
export const ROUNDS = [90, 75, 70, 65];
export const roundFrom = (i: number) => MULTI + ROUNDS.slice(0, i).reduce((a, b) => a + b, 0);

export const A6Next: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <Sequence durationInFrames={MULTI}>
      <Multiplayer />
    </Sequence>
    {ROUNDS.map((len, i) => (
      <Sequence key={i} from={roundFrom(i)} durationInFrames={len}>
        <Round i={i} len={len} />
      </Sequence>
    ))}
    <Flash at={MULTI} len={2} />
  </AbsoluteFill>
);
