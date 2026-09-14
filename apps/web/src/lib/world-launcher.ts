import type { WorldShelf } from './airp-gateway.js';

/** World launcher helpers (docs/ui/世界Launcher.md). */
export type ShelfGroup = NonNullable<WorldShelf['groups']>[number];

/**
 * The launcher's own music: niko's Suno track 「弹幕翻页夜」, looped seamlessly
 * and turned down to sit behind the wall. It lives only locally in
 * `assets/audio/licensed/` (gitignored); where it is absent the launcher is
 * silent. LAUNCHER_CREDIT is shown when a track's terms require a credit
 * (e.g. 「音楽：魔王魂」 for a 魔王魂 track); this one needs none.
 */
export const LAUNCHER_THEME = '/api/audio?path=licensed%2Flauncher.mp3';
export const LAUNCHER_CREDIT = '';

/** Edition suffixes (tools/world-editions.mjs): English `<id>`, Japanese `<id>-jp`, Chinese `<id>-zh`. */
const EDITION_SUFFIX = /-(jp|zh)$/;
const editionLocale = (group: ShelfGroup) => group.locale ?? 'en';

/**
 * One entry per world, in shelf order. The editions of a world share an entry;
 * the edition follows the interface language, falling back to English when that
 * language has no edition yet. Save-only groups (no template, no cover) stay in
 * the save manager, not the launcher.
 */
export function launcherWorlds(groups: readonly ShelfGroup[], locale: string): ShelfGroup[] {
  const byWorld = new Map<string, ShelfGroup[]>();
  for (const group of groups) {
    if (!group.templatePath || !group.cover) continue;
    const base = group.id.replace(EDITION_SUFFIX, '');
    byWorld.set(base, [...(byWorld.get(base) ?? []), group]);
  }
  const want = locale === 'ja' || locale === 'zh-CN' ? locale : 'en';
  return [...byWorld.values()].map(editions =>
    editions.find(group => editionLocale(group) === want)
      ?? editions.find(group => editionLocale(group) === 'en')
      ?? editions[0]);
}

/** Edition label on a brick. */
export function editionLabel(locale: string | null | undefined): string {
  return locale === 'ja' ? '日本語' : locale === 'zh-CN' ? '中文' : 'English';
}

/** "霧埠の町 · 日本語" → "霧埠の町": the edition is implied by the interface language. */
export function worldTitle(name: string): string {
  return name.split(' · ')[0]?.trim() || name;
}

/**
 * Which world sits in brick (col, row) of the endless wall. Odd rows are shifted
 * half a brick, so a brick touches ±1 in its row and +2/+3 (or −2/−3) across
 * rows: with five or more worlds, no two touching bricks repeat.
 */
export function brickWorld(col: number, row: number, count: number): number {
  if (count <= 0) return 0;
  return (((col + 3 * row) % count) + count) % count;
}

export interface BrickGeometry { w: number; h: number; gap: number }

/** Brick size for a viewport width: about three bricks across, 280–520px wide. */
export function brickGeometry(viewportWidth: number): BrickGeometry {
  const w = Math.round(Math.min(520, Math.max(280, viewportWidth * 0.3)));
  return { w, h: Math.round(w * 0.6), gap: Math.round(w * 0.05) };
}

export interface Brick { col: number; row: number; left: number; top: number }

/** Every brick overlapping the rectangle (x, y, width, height) of the wall, plus `margin` bricks around it. */
export function visibleBricks(x: number, y: number, width: number, height: number, geometry: BrickGeometry, margin = 1): Brick[] {
  const cellW = geometry.w + geometry.gap;
  const cellH = geometry.h + geometry.gap;
  const bricks: Brick[] = [];
  for (let row = Math.floor(y / cellH) - margin; row <= Math.floor((y + height) / cellH) + margin; row++) {
    const shift = (row & 1) ? cellW / 2 : 0;
    for (let col = Math.floor((x - shift) / cellW) - margin; col <= Math.floor((x + width - shift) / cellW) + margin; col++) {
      bricks.push({ col, row, left: col * cellW + shift, top: row * cellH });
    }
  }
  return bricks;
}
