import { loadFont as loadDisplay } from "@remotion/google-fonts/InterTight";
import { loadFont as loadHand } from "@remotion/google-fonts/Caveat";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const DISPLAY = loadDisplay("normal", { weights: ["800", "900"], subsets: ["latin"] }).fontFamily;
export const HAND = loadHand("normal", { weights: ["600", "700"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;

export const INK = "#0A0A0A";
export const INK_2 = "#161616";
export const PAPER = "#F4F1EA";
export const ORANGE = "#FF6600";
/** Multiplayer cursor colours; index 0 is always the player. */
export const PLAYERS = ["#FF6600", "#3DA5FF", "#35D07F", "#FF4FA3"];
