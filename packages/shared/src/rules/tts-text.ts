/**
 * Remove control tags and stage directions before text reaches a TTS provider.
 *
 * This is intentionally fail-closed: if a bracket cannot be proven to be a
 * properly nested pair, no part of the input is returned. Display text must
 * continue using the original value; this helper is only for speech and cache
 * keys.
 */

const EMO_TAG_RE = /^\[emo:\s*[a-z]+\]\s*/;

const OPEN_TO_CLOSE: Readonly<Record<string, string>> = {
  '(': ')',
  '（': '）',
  '[': ']',
  '【': '】',
};

const CLOSERS: Record<string, true> = { ')': true, '）': true, ']': true, '】': true };

/**
 * Return the text that is safe to send to TTS.
 *
 * Leading emotion control tags are removed (including consecutive tags), then
 * all properly paired action brackets and their contents are removed. Any
 * unmatched, crossed, or otherwise malformed bracket causes an empty result;
 * this includes an unclosed pair spanning a newline. The operation is pure and
 * idempotent.
 */
export function sanitiseTtsText(raw: string): string {
  let text = raw;
  // Keep this aligned with parseEmoTag's grammar while consuming every
  // consecutive leading tag so a second call cannot expose a control tag.
  while (true) {
    const match = EMO_TAG_RE.exec(text);
    if (!match) break;
    text = text.slice(match[0].length);
  }

  const stack: string[] = [];
  let readable = '';
  for (const character of text) {
    const closing = OPEN_TO_CLOSE[character];
    if (closing !== undefined) {
      stack.push(closing);
      continue;
    }
    if (Object.hasOwn(CLOSERS, character)) {
      if (stack.length === 0 || stack.pop() !== character) return '';
      continue;
    }
    if (stack.length === 0) readable += character;
  }

  // An unmatched opening bracket (including one crossing a newline) is unsafe
  // to interpret as ordinary prose, so fail closed rather than speak a prefix.
  if (stack.length > 0) return '';
  return readable.trim();
}
