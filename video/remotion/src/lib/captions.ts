import type { Cue } from "../components/Captions";

/**
 * Narration subtitles, absolute seconds on the Launch timeline (video/SCRIPT.md, v16 = 3:44).
 * The film is subtitle-first: it must read with the sound off; the user may record these lines later.
 * Character dialogue is subtitled inside its own scene (A3, A5), except lines taken from the user's recordings.
 * "Writer agent", never plain "writer": the one writing the world is an AI agent, not a person.
 */
export const NARRATION: Cue[] = [
  { from: 0.4, to: 3.8, text: "Stories have always been worlds." },
  { from: 4.2, to: 6.8, text: "Books let us read them." },
  { from: 7.2, to: 9.8, text: "Games let us play them." },
  { from: 10.2, to: 13.8, text: "Chatbots let us talk to one character, alone, in a box." },
  { from: 14.3, to: 16.8, text: "But no one has ever let you live in one." },
  // Narrated too: the long line needs ~5.5s, so "This is Worldlines." lands right on the canvas burst.
  { from: 19.6, to: 21.2, text: "This is Worldlines." },
  { from: 21.4, to: 27.4, text: "One infinite canvas, where you, your character agents, and a writer agent share the same world." },
  { from: 33.1, to: 34.9, text: "And they talk back." },
  // Elias (A3, from 67.1s): after the GPT Live call, the ticket he wrote is a card in the world.
  { from: 67.4, to: 71.4, text: "On a live call, he writes it straight into the world." },
  { from: 73.3, to: 77.8, text: "Pick a world." },
  // Fogwharf, 78–142s, all from the user's 44-minute run (Japanese edition), in play order. Narration says what each
  // beat is; Vera's lines play whole, after what the user typed (on screen in Japanese, subtitled as "You").
  { from: 78.3, to: 81.4, text: "A harbour where ships vanish. You take the case." },
  { from: 81.7, to: 86.3, text: "Search the harbour for signs. When luck matters, the dice decide." },
  { from: 86.5, to: 88.2, speaker: "You", text: "OK — why are you helping me this much?" },
  { from: 88.3, to: 91.0, speaker: "Vera", text: "Don't think I trust you unconditionally." },
  { from: 92.4, to: 98.8, speaker: "Vera", text: "But I'd hate for a scratch I missed to hurt someone — I want to be sure whose part this is." },
  { from: 98.9, to: 100.3, speaker: "You", text: "Want to look around together?" },
  { from: 100.5, to: 104.2, text: "Ask her to come along, and she walks the harbour with you." },
  { from: 104.5, to: 109.8, text: "Share your theory, and the writer agent writes the next place into the world." },
  { from: 110.0, to: 112.3, text: "Together, you find the second ship." },
  { from: 112.4, to: 114.0, speaker: "You", text: "Another new path." },
  { from: 114.2, to: 115.4, speaker: "Vera", text: "The second ship." },
  { from: 115.5, to: 120.8, speaker: "Vera", text: "We haven't seen the ship itself yet. But the new path is real." },
  { from: 121.0, to: 123.7, text: "When you want to turn back, she keeps you going." },
  { from: 123.9, to: 125.4, speaker: "You", text: "We've come this far. Head back?" },
  { from: 125.5, to: 127.5, speaker: "Vera", text: "If it were me, I wouldn't go back yet." },
  { from: 127.6, to: 135.5, speaker: "Vera", text: "The scraped crates, or the wheel tracks with no mud — check either one, and we're closer to the second ship." },
  // The usage screenshot covers the whole week, so the run is never credited with all of it: the credits ran out *during* it.
  { from: 135.8, to: 141.8, text: "We got hooked — one game ran 44 minutes, until our $100 in credits hit zero." },
  // First Snow, 142–152s: the user's two routes (16.07 and 16.24 recordings), each ending on its own CG.
  { from: 142.3, to: 145.9, text: "Keep a promise on the night of the first snow." },
  { from: 148.3, to: 151.7, text: "Two routes. Two endings." },
  { from: 152.3, to: 156.8, text: "Change one morning in 1994, and see who's still here tonight." },
  // Ryo's own voice from the user's recording (Divergence). On screen: 「鮭が跳ねるところ、また見たいな。」
  { from: 157.2, to: 160.9, speaker: "Ryo", text: "I want to see the salmon leap again." },
  { from: 161.1, to: 163.8, text: "Same street, before and after." },
  { from: 164.2, to: 166.6, text: "Or start with nothing but a promise." },
  // 167.0–174.4 belongs to Lyra's two lines (subtitled in A5).
  { from: 174.6, to: 179.8, text: "Say yes, and the writer agent builds the next place as you walk into it." },
  { from: 180.3, to: 184.1, text: "Every character has a place of their own, too." },
  // 184.3–187.0 is Vera's line in her nook (subtitled in A5).
  { from: 188.2, to: 191.8, text: "And it never runs out." },
  { from: 192.3, to: 199.5, text: "Next: bring your friends into the same story." },
  { from: 200.3, to: 204.8, text: "The writer agent writes the plot, the rules, and the code." },
  { from: 205.0, to: 209.5, text: "Whatever the story needs, it can build." },
  { from: 214.6, to: 217.8, text: "Books let us read stories. Games let us play them." },
  { from: 218.6, to: 223.6, text: "Worldlines lets you live in the world, with your character agents." },
];
