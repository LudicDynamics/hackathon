/**
 * Phantom seating — the ONE seater for provisional cards (contract §5, ruling D).
 *
 * Owner: docs/perform/03. 01's chalk phantoms MUST call `phantomSeatFor`; nobody
 * builds a second seater (`nextInkSeat` was deleted in review). It mirrors the
 * server's `seatUnplaced` algorithm via `lib/seat.ts` (same Ulam spiral, same
 * anchor/step), but the INPUT SET differs — front-end = items ∪ phantoms,
 * server = its own view. Isomorphism of the algorithm does not imply identical
 * output, so phantoms are placed "optimistically": the real refetched seat wins
 * on handover (docs/perform/00 §5).
 */

import { makeBox, overlap, type Box } from './collide.js';
import { SEAT_ANCHOR, seatSpiral } from './seat.js';
import { getPhantomsSnapshot, type PhantomSeat } from './phantom.js';

/** Measure complete provisional text before paint. Only its own DOM moves;
 * real card seats remain server-owned and win when the file arrives. */
export function fitPhantom(el: HTMLElement): void {
  const siblings = el.parentElement?.querySelectorAll<HTMLElement>('.object[data-path], .object--ghost') ?? [];
  const occupied = [...siblings].filter(other => other !== el)
    .map(other => makeBox(other.offsetLeft, other.offsetTop, other.offsetWidth, other.offsetHeight));
  const box = makeBox(el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight);
  if (!occupied.some(other => overlap(box, other))) return;
  const seat = seatSpiral(SEAT_ANCHOR, occupied, box.w, box.h);
  el.style.left = `${seat.x}px`;
  el.style.top = `${seat.y}px`;
}

/** Current layer's rows, published by `useWorld` after each successful fetch. */
interface SeatItem {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

let seatLayer: string | undefined;
let seatItems: readonly SeatItem[] = [];

/**
 * `useWorld` publishes the current layer's rows after `fetchLayer` succeeds.
 * The layer is recorded: if `phantomSeatFor` is asked about a different layer,
 * the stale rows are ignored (better overlapping phantoms than phantom boxes
 * pushing real cards around).
 */
export function publishSeatItems(layer: string, items: readonly SeatItem[]): void {
  seatLayer = layer;
  seatItems = items;
}

function isVisibleIn(entryLayer: string | undefined, layer: string): boolean {
  return entryLayer === undefined || entryLayer === layer;
}

/**
 * Local seat for a new phantom: the spiral over (current items ∪ visible
 * phantoms) so two concurrent generations never overlap. Returns the seat plus
 * the occupied boxes it considered.
 */
export function phantomSeatFor(
  size: { w: number; h: number },
  layer: string
): { seat: PhantomSeat; occupied: Box[] } {
  const items = seatLayer === layer ? seatItems : [];
  const occupied = [
    ...items.map((it) => makeBox(it.x, it.y, it.w, it.h)),
    ...getPhantomsSnapshot()
      .filter((p) => p.phase !== 'evicted' && isVisibleIn(p.layer, layer))
      .map((p) => makeBox(p.seat.x, p.seat.y, p.seat.w, p.seat.h)),
  ];
  const { x, y } = seatSpiral(SEAT_ANCHOR, occupied, size.w, size.h);
  const z = 1 + items.reduce((m, it) => Math.max(m, it.z), 0);
  return { seat: { x, y, w: size.w, h: size.h, z }, occupied };
}
