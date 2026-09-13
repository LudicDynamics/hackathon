/**
 * dialogue-pages — pure pagination helpers for the character-modal stage
 * (docs/tts/03 §2.1, contract docs/tts/00 §6). Zero React imports: the jiti
 * test in apps/web/test/voice-engine.test.mjs imports this module directly.
 *
 * A "page" is one non-empty line of the character's reply: the line structure
 * comes from the character preset ([One sentence per line]); pagination is
 * pure front-end. The model is not guaranteed to obey, so a reply with no
 * newline degrades to exactly one page (contract §6.2 warning) — never an
 * empty stage, never a truncated line, never a punctuation-based fallback.
 */

import type { Emotion } from '../../lib/audio.js';

/** Emotion tags the preset may emit (T3.2). Moved here with parseEmoTag. */
const EMO_TAGS: readonly Emotion[] = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

/** Frontier guard: an unterminated `[emo` prefix longer than this is prose. */
export const EMO_PREFIX_GUARD = 24;

/** One page = one non-empty line. `sealed=false` is only possible on the last
 *  page (which may still grow while the stream is open). */
export interface DialoguePage {
  /** Line text with any leading `[emo: tag]` stripped. */
  text: string;
  /** Effective mood: this line's tag, else inherited from the previous page. */
  emo: Emotion;
  /** The line is closed by a `\n` or by `final` (vs. still streaming). */
  sealed: boolean;
}

/** Strip a leading "[emo: tag]" (T3.2); returns display text + parsed mood. */
export function parseEmoTag(raw: string): { text: string; emo: Emotion } {
  const match = /^\[emo:\s*([a-z]+)\]\s*/.exec(raw);
  if (!match) return { text: raw, emo: 'normal' };
  const tag = match[1] as Emotion;
  return { text: raw.slice(match[0].length), emo: EMO_TAGS.includes(tag) ? tag : 'normal' };
}

/**
 * The single source of truth for pagination: only '\n' closes a page
 * (contract §6.2 — NO punctuation-based fallback).
 * - empty lines (consecutive `\n` / whitespace-only) are dropped, no page.
 * - `final=false` leaves the last line unsealed; `final=true` seals all.
 * - an unterminated `[emo` prefix is frozen: that line yields text='' and
 *   sealed=false, and `tailOpen=true`.
 * - `text` = the pages joined by '\n' (compatibility layer for the old
 *   "drained" catch-up check).
 */
export function parseEmoPages(
  raw: string,
  opts?: { final?: boolean }
): { pages: DialoguePage[]; emo: Emotion; tailOpen: boolean; text: string } {
  const lines = raw.split('\n');
  let emo: Emotion = 'normal';
  let tailOpen = false;
  const pages: DialoguePage[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const tagged = /^\[emo:\s*[a-z]+\]/.test(line);
    const parsed = parseEmoTag(line);
    if (tagged) emo = parsed.emo;
    // Freeze an unterminated tag prefix, but only while more chars may arrive.
    // The guard keeps a wild `[emo…` from hanging the paper; plain bracketed
    // prose (`[System] …`) never matches because the prefix must be `[emo`.
    if (
      isLast &&
      !opts?.final &&
      !tagged &&
      /^\[emo[\s:]*[a-z]*$/.test(line) &&
      line.length <= EMO_PREFIX_GUARD
    ) {
      tailOpen = true;
      pages.push({ text: '', emo, sealed: false });
      continue;
    }
    if (parsed.text.trim() === '') continue; // empty / whitespace-only line: no page
    pages.push({ text: parsed.text, emo, sealed: opts?.final === true || !isLast });
  }
  return { pages, emo, tailOpen, text: pages.map((p) => p.text).join('\n') };
}

/** Personality rhythm: 45ms/char, 300ms after a comma, 150ms at sentence end. */
export function charDelay(prev: string): number {
  if (prev === ',' || prev === '，') return 300;
  if ('.;!?。！？…'.includes(prev)) return 150;
  return 45;
}

/** Boundary clamp (contract §6.4: pageIndex ∈ [0, len-1]); len<=0 → 0. */
export function clampPageIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return Math.min(Math.max(i, 0), len - 1);
}

/** mock greeting line (contract §7.1, frozen copy — do not change). */
export const GREETING_LINE: Record<'en' | 'ja', { text: string; emo: Emotion }> = {
  en: { text: 'Something on your mind?', emo: 'normal' },
  ja: { text: 'どうしたの？', emo: 'normal' },
};
