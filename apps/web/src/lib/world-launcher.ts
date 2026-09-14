import type { WorldShelf } from './airp-gateway.js';

/** World launcher helpers (docs/ui/世界Launcher.md). */
export type ShelfGroup = NonNullable<WorldShelf['groups']>[number];

/**
 * One panel per world, in shelf order. Bilingual editions (`<id>` / `<id>-jp`)
 * share a panel; the edition follows the interface language. Save-only groups
 * (no template, no cover) stay in the save manager, not the launcher.
 */
export function launcherWorlds(groups: readonly ShelfGroup[], locale: string): ShelfGroup[] {
  const byWorld = new Map<string, ShelfGroup[]>();
  for (const group of groups) {
    if (!group.templatePath || !group.cover) continue;
    const base = group.id.replace(/-jp$/, '');
    byWorld.set(base, [...(byWorld.get(base) ?? []), group]);
  }
  const wantJa = locale === 'ja';
  return [...byWorld.values()].map(editions => editions.find(group => (group.locale === 'ja') === wantJa) ?? editions[0]);
}

/** "霧埠の町 · 日本語" → "霧埠の町": the edition is implied by the interface language. */
export function worldTitle(name: string): string {
  return name.split(' · ')[0]?.trim() || name;
}
