import type { Cue } from "../components/Captions";
import { withProject } from "./project";

/**
 * Narration for the 1-minute cut (Launch60.tsx), absolute seconds. Same rules as the full film (captions.ts):
 * "writer agent", the player's typed lines narrated, a feature said before it is shown, each world's premise said
 * over its title card. Only multiplayer is "next" — the writer agent writing rules and code is built.
 * Voiced with CAPTIONS_FILE=captions60.ts VO_TAG=andrew60 node video/music/make-narration.mjs.
 */
// {PROJECT} is the project's name (lib/project.ts): LivingCanvas, or CharaCanvas for that variant.
const RAW60: Cue[] = [
  { from: 1.2, to: 6.9, text: "This is Worldlines: {PROJECT} — where you live the story with AI character agents." },
  { from: 7.2, to: 9.9, text: "Fogwharf: investigate a harbour where ships vanish." },
  { from: 10.1, to: 12.8, text: "When luck matters, the dice decide." },
  { from: 13.1, to: 15.9, text: "Share a theory, and the writer agent writes the next place." },
  { from: 16.1, to: 17.9, text: "The player asks Vera to come along." },
  { from: 18.2, to: 19.8, speaker: "Vera", text: "I'm coming. Of course." },
  { from: 20.2, to: 21.6, speaker: "Vera", text: "The second ship." },
  { from: 22.0, to: 25.1, text: "One game, 44 minutes — until the credits hit zero." },
  { from: 25.2, to: 30.8, text: "First Snow: keep a promise on the night of the first snow — your choices write the ending." },
  { from: 31.2, to: 34.9, text: "Divergence: change one day in 1994, and the street changes." },
  { from: 35.1, to: 37.4, text: "With GPT Live, call a character." },
  // Over the way back into the world, so it is said before the ticket card shows.
  { from: 41.2, to: 43.1, text: "And their promise lands in the world." },
  { from: 45.2, to: 47.9, text: "The writer agent writes the rules and the code, too." },
  { from: 48.1, to: 50.9, text: "Next: bring your friends into the same story." },
  { from: 55.3, to: 59.7, text: "Worldlines lets you live in the world, with your character agents." },
];
export const NARRATION60: Cue[] = RAW60.map((c) => ({ ...c, text: withProject(c.text) }));
