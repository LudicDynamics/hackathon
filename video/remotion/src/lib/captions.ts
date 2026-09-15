import type { Cue } from "../components/Captions";
import { withProject } from "./project";

/**
 * Narration subtitles, absolute seconds on the Launch timeline (video/SCRIPT.md, v17 = 3:52).
 * The film is subtitle-first: it must read with the sound off; the user may record these lines later.
 * Character dialogue is subtitled inside its own scene (A3, A5, AL), except lines taken from the user's recordings.
 * "Writer agent", never plain "writer": the one writing the world is an AI agent, not a person.
 * The player never speaks in the user's runs (they type), so what they asked is narrated, not voiced as dialogue.
 */
// {PROJECT} is the project's name (lib/project.ts): LivingCanvas, or CharaCanvas for that variant.
const RAW: Cue[] = [
  { from: 0.4, to: 3.8, text: "Stories have always been worlds." },
  { from: 4.2, to: 6.8, text: "Books let us read them." },
  { from: 7.2, to: 9.8, text: "Games let us play them." },
  { from: 10.2, to: 13.8, text: "Chatbots let us talk to one character, alone, in a box." },
  { from: 14.3, to: 16.8, text: "But no one has ever let you live in one." },
  // Narrated too: the long line needs ~5.5s, so "This is Worldlines." lands right on the canvas burst.
  { from: 19.3, to: 21.35, text: "This is Worldlines: {PROJECT}." },
  { from: 21.4, to: 27.4, text: "One infinite canvas, where you, your character agents, and a writer agent share the same world." },
  { from: 33.1, to: 34.9, text: "And they talk back." },
  { from: 59.3, to: 63.8, text: "Pick a world." },
  // Fogwharf, 64–132s, all from the user's 44-minute run (Japanese edition), in real play order. The narrator says what
  // each beat is and what the player typed; Vera's lines play whole, in her own voice.
  { from: 64.3, to: 67.4, text: "A harbour where ships vanish. You take the case." },
  { from: 67.7, to: 72.3, text: "Search the harbour for signs. When luck matters, the dice decide." },
  { from: 72.6, to: 75.0, text: "The player asks Vera why she's helping." },
  { from: 75.3, to: 77.9, speaker: "Vera", text: "Don't think I trust you unconditionally." },
  { from: 79.4, to: 85.8, speaker: "Vera", text: "But I'd hate for a scratch I missed to hurt someone — I want to be sure whose part this is." },
  { from: 86.0, to: 91.1, text: "Share your theory, and the writer agent writes the next place into the world." },
  { from: 91.3, to: 93.7, text: "The player asks her to come along." },
  { from: 93.9, to: 95.6, speaker: "Vera", text: "I'm coming. Of course." },
  { from: 95.9, to: 99.6, text: "She comes along — and together, you find the second ship." },
  { from: 101.7, to: 103.9, text: "The player spots a new path." },
  { from: 104.2, to: 105.4, speaker: "Vera", text: "The second ship." },
  { from: 105.5, to: 110.8, speaker: "Vera", text: "We haven't seen the ship itself yet. But the new path is real." },
  { from: 111.0, to: 115.2, text: "Deep in, the player asks whether to turn back." },
  { from: 115.5, to: 117.5, speaker: "Vera", text: "If it were me, I wouldn't go back yet." },
  { from: 117.6, to: 125.5, speaker: "Vera", text: "The scraped crates, or the wheel tracks with no mud — check either one, and we're closer to the second ship." },
  // The usage screenshot covers the whole week, so the run is never credited with all of it: the credits ran out *during* it.
  { from: 125.8, to: 131.8, text: "We got hooked — one game ran 44 minutes, until our $100 in credits hit zero." },
  // First Snow, 132–142s: the user's route (16.07 recording), ending on its CG.
  { from: 132.3, to: 135.9, text: "Keep a promise on the night of the first snow." },
  { from: 138.3, to: 141.7, text: "Your choices write the ending." },
  { from: 142.3, to: 146.8, text: "Change one morning in 1994, and see who's still here tonight." },
  // Ryo's own voice from the user's recording (Divergence). On screen: 「鮭が跳ねるところ、また見たいな。」
  { from: 147.2, to: 150.9, speaker: "Ryo", text: "I want to see the salmon leap again." },
  { from: 151.1, to: 153.8, text: "Same street, before and after." },
  { from: 154.2, to: 156.6, text: "Or start with nothing but a promise." },
  // 157.0–164.4 belongs to Lyra's two lines (subtitled in A5).
  { from: 164.6, to: 169.8, text: "Say yes, and the writer agent builds the next place as you walk into it." },
  { from: 170.3, to: 174.1, text: "Every character has a place of their own, too." },
  // 174.3–177.0 is Vera's line in her nook (subtitled in A5).
  { from: 178.2, to: 181.8, text: "And it never runs out." },
  // GPT Live, 182–200s: the feature first, then its demo (Elias speaks from 185.6s).
  { from: 182.2, to: 185.5, text: "With GPT Live, you can call a character and talk in real time." },
  { from: 192.1, to: 196.2, text: "And what they promise on the call, they write into the world." },
  // 200–218s: what's built first (the writer agent's rounds, 200–210s), then the one thing that's next (210–218s).
  { from: 200.3, to: 204.8, text: "The writer agent writes the plot, the rules, and the code." },
  { from: 205.0, to: 209.5, text: "Whatever the story needs, it can build." },
  { from: 210.3, to: 217.5, text: "Next: bring your friends into the same story." },
  { from: 222.6, to: 225.8, text: "Books let us read stories. Games let us play them." },
  { from: 226.6, to: 231.6, text: "Worldlines lets you live in the world, with your character agents." },
];
export const NARRATION: Cue[] = RAW.map((c) => ({ ...c, text: withProject(c.text) }));
