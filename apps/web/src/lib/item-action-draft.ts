type DraftItem = { path: string; filename: string; frontmatter: Record<string, unknown> | null };
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** References live in the editable draft, so deleting them also removes their context. */
export function itemDraftReference(item: DraftItem): string {
  const title = String(item.frontmatter?.title || item.filename).replace(/[\[\]\r\n]/g, ' ');
  return `[${title}](${encodeURI(item.path).replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
}

export function referencedItemPaths(text: string, items: DraftItem[]): string[] {
  const links = new Set<string>();
  for (const match of text.matchAll(/\[[^\]\r\n]*\]\(([^\s)]+)\)/g)) {
    try { links.add(decodeURI(match[1])); } catch { /* Incomplete edits are not references. */ }
  }
  return [...new Set(items.filter(item => links.has(item.path)).map(item => item.path))];
}

/** Selection prepares text only; it never dispatches a turn or moves/consumes an item. */
export function appendItemAction(text: string, item: DraftItem, t: Translate): string {
  if (referencedItemPaths(text, [item]).length) return text;
  const action = t('Use {item}.', { item: itemDraftReference(item) });
  return text.trim() ? `${text.trim()} ${action}` : action;
}

export function buildItemActionPrompt(text: string, items: DraftItem[]): string {
  const paths = referencedItemPaths(text, items);
  if (!paths.length) return text;
  return `${text}\n\nReferenced carried items (exact paths): ${JSON.stringify(paths)}. Read every referenced item and the current scene README before resolving the player's final edited request. These references identify objects, not automatic permission to consume, combine, move them, or bypass scene requirements. If the intended target or combination is unclear, ask in Chalk. For a valid action, use the existing action tools and persist required item/state changes, then provide the result and next available action in Chalk. Resolve only this action, then wait for my next input.`;
}
