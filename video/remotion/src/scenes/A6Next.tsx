import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Flash } from "../components/Kit";
import { INK } from "../lib/theme";
import { Multiplayer, Round } from "./S6Vision";

// ACT 6 · What's built, then what's next (user, 2026-09-15): the writer agent writes the plot, the rules and the code —
// real frontmatter typed on the left, the effect on the right, four rounds getting faster — then, last, the one thing
// not built yet: friends in the same story (mock, marked `next`).

export const ROUNDS = [90, 75, 70, 65];
export const roundFrom = (i: number) => ROUNDS.slice(0, i).reduce((a, b) => a + b, 0);
/** Where the multiplayer beat starts (after the four rounds), and how long it runs. */
export const MULTI_FROM = roundFrom(ROUNDS.length);
export const MULTI = 240;

export const A6Next: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    {ROUNDS.map((len, i) => (
      <Sequence key={i} from={roundFrom(i)} durationInFrames={len}>
        <Round i={i} len={len} />
      </Sequence>
    ))}
    <Sequence from={MULTI_FROM} durationInFrames={MULTI}>
      <Multiplayer />
    </Sequence>
    <Flash at={MULTI_FROM} len={2} />
  </AbsoluteFill>
);
