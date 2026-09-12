/**
 * Spatial humanization (doc-03 §5.4). Pure, no I/O: turns box geometry into the
 * words a reader can act on. Coordinates never leave this module — the whole
 * point of `look_at`'s Layout and `view_canvas`'s Relative block is that a
 * distance becomes a phrase (doc-22 §5: the granularity of a direction word is
 * itself the quantification).
 *
 * Vocabulary and thresholds are frozen by doc-03 §5.4 / §13.1.
 */

/** An axis-aligned canvas box in CSS px. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalized centre distance: 1.0 == the two boxes are one average box apart. */
function normalDistance(a: Box, b: Box): number {
  const dx = a.x + a.w / 2 - (b.x + b.w / 2);
  const dy = a.y + a.h / 2 - (b.y + b.h / 2);
  return Math.hypot(dx / ((a.w + b.w) / 2), dy / ((a.h + b.h) / 2));
}

/**
 * Axis-aligned intersection. Touching edges do NOT count (`<`, never `<=`):
 * a card flush against another is not "stacked" in the sense the player sees
 * (doc-03 §13.1).
 */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * One relationship phrase for `subject` as seen from `anchor`.
 *
 * Thresholds (doc-03 §5.4): both axis gaps within half an average box →
 * `right on top of` (d ≤ 0.4) or `overlapping`; d ≤ 1 → `next to`; otherwise
 * `<above|below>[-<left|right>] of`, with a `far ` prefix past d > 2.5.
 */
export function dirPhrase(subject: Box, anchor: Box): string {
  const dx = subject.x + subject.w / 2 - (anchor.x + anchor.w / 2);
  const dy = subject.y + subject.h / 2 - (anchor.y + anchor.h / 2);
  const avgW = (subject.w + anchor.w) / 2;
  const avgH = (subject.h + anchor.h) / 2;

  const horizontal = dx > 0.5 * avgW ? 'right' : dx < -0.5 * avgW ? 'left' : '';
  const vertical = dy > 0.5 * avgH ? 'below' : dy < -0.5 * avgH ? 'above' : '';
  const d = Math.hypot(dx / avgW, dy / avgH);

  if (!horizontal && !vertical) return d <= 0.4 ? 'right on top of' : 'overlapping';
  if (d <= 1.0) return 'next to';

  const direction = vertical && horizontal ? `${vertical}-${horizontal}` : vertical || horizontal;
  return `${d > 2.5 ? 'far ' : ''}${direction} of`;
}

/**
 * One line per item, pointing at its nearest neighbour. O(n) output — never the
 * full O(n²) graph, because 12 cards would otherwise produce 66 lines
 * (doc-03 §4.2 rule 8).
 *
 * `dir` reads from `path` toward `other`, so the caller prints
 * `<path> — <dir> <other>` with the subject first (doc-03 §13.1).
 */
export function nearestNeighbours(
  items: Array<{ path: string; box: Box }>
): Array<{ path: string; dir: string; other: string }> {
  const out: Array<{ path: string; dir: string; other: string }> = [];
  for (const item of items) {
    let best: { path: string; box: Box } | null = null;
    let bestDistance = Infinity;
    for (const other of items) {
      if (other.path === item.path) continue;
      const d = normalDistance(item.box, other.box);
      if (d < bestDistance) {
        bestDistance = d;
        best = other;
      }
    }
    if (best) out.push({ path: item.path, dir: dirPhrase(item.box, best.box), other: best.path });
  }
  return out;
}
