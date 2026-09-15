import { getInputProps } from "remotion";

/**
 * The film's language: "en" (default) or "zh" — the Chinese cut for 小红书 / 哔哩哔哩 (--props='{"lang":"zh"}').
 * Picture, music and cuts are the same; narration (Yunyang), subtitles, bubbles and labels switch. Brand/design type
 * (world titles, the formula, the logo) stays English.
 */
export const LANG = (getInputProps() as { lang?: string }).lang === "zh" ? "zh" : "en";
export const tr = (en: string, zh: string) => (LANG === "zh" ? zh : en);
