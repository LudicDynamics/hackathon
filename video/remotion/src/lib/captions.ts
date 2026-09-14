import type { Cue } from "../components/Captions";

/**
 * Narration subtitles, absolute seconds on the Launch timeline (video/SCRIPT.md, v6 = 2:36).
 * The film is subtitle-first: it must read with the sound off; the user may record these lines later.
 * Character dialogue is subtitled inside its own scene (A3, A5).
 */
export const NARRATION: Cue[] = [
  { from: 0.4, to: 3.8, text: "Stories have always been worlds." },
  { from: 4.2, to: 6.8, text: "Books let us read them." },
  { from: 7.2, to: 9.8, text: "Games let us play them." },
  { from: 10.2, to: 13.8, text: "Chatbots let us talk to one character, alone, in a box." },
  { from: 14.3, to: 16.8, text: "But no one has ever let you live in one." },
  { from: 20.3, to: 23.2, text: "This is Worldlines." },
  { from: 23.4, to: 26.8, text: "One infinite canvas, where you, your characters, and an AI writer share the same world." },
  { from: 33.1, to: 35.0, text: "And they talk back." },
  { from: 53.3, to: 57.8, text: "Pick a world." },
  { from: 58.3, to: 67.5, text: "Investigate a harbour where ships vanish." },
  { from: 68.3, to: 77.5, text: "Be Holmes, and let Watson follow your reasoning." },
  { from: 78.3, to: 87.5, text: "Keep a promise on the night of the first snow." },
  { from: 88.3, to: 95.5, text: "Change one morning in 1994, and see who's still here tonight." },
  { from: 96.2, to: 98.6, text: "Or start with nothing but a promise." },
  // 99.0–106.4 belongs to Lyra's two lines (subtitled in A5).
  { from: 106.6, to: 111.8, text: "Say yes, and the writer builds the next place as you walk into it." },
  { from: 112.3, to: 116.1, text: "Every character has a place of their own, too." },
  // 116.3–119.0 is Vera's line in her nook (subtitled in A5).
  { from: 120.2, to: 123.8, text: "And it never runs out." },
  { from: 124.3, to: 131.5, text: "Next: bring your friends into the same story." },
  { from: 132.3, to: 136.8, text: "The writer writes the plot, the rules, and the code." },
  { from: 137.0, to: 141.5, text: "Whatever the story needs, it can build." },
  { from: 146.6, to: 149.8, text: "Books let us read worlds. Games let us play them." },
  { from: 150.6, to: 155.6, text: "Worldlines lets you live in one." },
];
