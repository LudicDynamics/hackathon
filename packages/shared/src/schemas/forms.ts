/**
 * Card forms — the ONE source of truth for every canvas object's footprint and
 * visual identity. The server seats cards by these; the web layer renders by
 * these. Because both read this table, a kind's box can never drift between the
 * seating math and the painted box (the "two size tables" bug).
 *
 * Form vocabulary borrowed from the v2 prototype (canvas-stack-mingyue.html /
 * hearth.html) and NoDesign's `chrome: card | bare` axis (board-kinds.js):
 *
 *   'bare'  — a stroke of ink on the canvas: no card surface, no border, no
 *             shadow. Narrations (`chalk`) and character presences are ink.
 *   'paper' — a sheet: paper tone + hairline + soft shadow.
 *   'cover' — a scene gate: paper sheet with a material cover band on top,
 *             a hand-drawn ordinal seal and a pin.
 *   'note'  — a sticky note: yellow stock + ruled lines + a paperclip.
 */

export type CardChrome = 'bare' | 'paper' | 'cover' | 'note';

export interface CardForm {
  /** English label (the repo is public; UI copy is English). */
  label: string;
  w: number;
  h: number;
  chrome: CardChrome;
}

export const CARD_FORMS: Record<string, CardForm> = {
  chalk: { label: 'Narration', w: 460, h: 190, chrome: 'bare' },
  gate: { label: 'Scene', w: 288, h: 240, chrome: 'cover' },
  letter: { label: 'Letter', w: 224, h: 176, chrome: 'paper' },
  note: { label: 'Note', w: 200, h: 168, chrome: 'note' },
  sprite: { label: 'Presence', w: 176, h: 196, chrome: 'bare' },
  default: { label: 'File', w: 240, h: 168, chrome: 'paper' },
};

/** Resolve a card's kind from parsed frontmatter + filename. Order matters. */
export function cardKindOf(
  frontmatter: Record<string, any> | null | undefined,
  filename: string
): string {
  const fm = frontmatter || {};
  if (fm.type === 'chalk') return 'chalk';
  if (fm.type === 'gate' || filename === 'README.md') return 'gate';
  if (fm.component === 'letter' || fm.type === 'letter') return 'letter';
  if (fm.type === 'note') return 'note';
  if (fm.type === 'sprite' || fm.type === 'character') return 'sprite';
  return 'default';
}

/** Footprint for a card. Server seating and the web box BOTH call this. */
export function cardFormOf(
  frontmatter: Record<string, any> | null | undefined,
  filename: string
): CardForm {
  return CARD_FORMS[cardKindOf(frontmatter, filename)] ?? CARD_FORMS.default;
}

/**
 * Chalk style variants — narration is the one kind with "many styles". Every
 * field is optional; the default is bare serif ink (transparent background, no
 * card surface). Special styles are opt-in via frontmatter:
 *
 *   font: hand            → hand-written stroke (Caveat / Long Cang)
 *   big: true | size: big → display scale
 *   color/tone: rust|blue|sage → ink colour variant
 *   card: true            → force a paper card surface (rare)
 *   collapsed: true       → folded to a one-line summary
 *   aged: true            → faded / weathered (a memory going quiet)
 */
export interface ChalkStyle {
  hand: boolean;
  big: boolean;
  tone: 'ink' | 'rust' | 'blue' | 'sage';
  card: boolean;
  collapsed: boolean;
  aged: boolean;
}

const CHALK_TONES = ['ink', 'rust', 'blue', 'sage'] as const;

export function chalkStyleOf(fm: Record<string, any> | null | undefined): ChalkStyle {
  const f = fm || {};
  const rawTone = f.color ?? f.tone;
  const tone = (CHALK_TONES as readonly string[]).includes(rawTone)
    ? (rawTone as ChalkStyle['tone'])
    : 'ink';
  return {
    hand: f.font === 'hand' || f.hand === true,
    big: f.big === true || f.size === 'big' || f.size === 'large',
    tone,
    card: f.card === true || f.chrome === 'paper',
    collapsed: f.collapsed === true,
    aged: f.aged === true,
  };
}

/** Layer material skins (the world tapestry). Drives the scene backdrop. */
export const MATERIAL_SKINS: Record<string, string> = {
  parchment: 'mat-parchment',
  warm: 'mat-warm',
  stub: 'mat-stub',
  kraft: 'mat-kraft',
};

export function materialSkinOf(material: string | null | undefined): string {
  return MATERIAL_SKINS[material || ''] ?? 'mat-warm';
}
