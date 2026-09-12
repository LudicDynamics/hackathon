/**
 * Emptiness rules for initialisation (docs/doc-11 §3.1 / §4.1 / §3.3).
 *
 * Zero dependencies on purpose: the caller passes a file list (`store.listFiles`
 * output), so these are pure and unit-testable without a store (docs/doc-11
 * §9.1 item 3: "pure function, unit-testable").
 *
 * `files` semantics (LocalWorldStore.listFiles, local-store.ts:210-233): paths
 * are world-root relative, dotfiles and `node_modules` are skipped, and
 * directories themselves are never returned. "Direct child of `dir`" therefore
 * means: the part of the path after `dir + '/'` contains no `/`.
 */

/**
 * Names of `files` that are direct children of `dir` (no `/` in the remainder).
 * Exported because `nookCardPaths` (rules/characters.ts) needs the same notion —
 * one implementation, not three (docs/init/00 §3.4 discipline).
 */
export function directChildrenOf(files: readonly string[], dir: string): string[] {
  const prefix = dir === '' ? '' : `${dir}/`;
  const out: string[] = [];
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    if (rest === '' || rest.includes('/')) continue;
    out.push(rest);
  }
  return out;
}

/**
 * A layer is a stub ⟺ its directory has no `README.md` (docs/doc-11 §3.1).
 * The check is exact and case-sensitive: `README.md`, not `readme.md`.
 *
 * `dir` is world-root relative (e.g. `world/baker-street/crime-scene`).
 */
export function isLayerEmpty(files: readonly string[], dir: string): boolean {
  return !directChildrenOf(files, dir).includes('README.md');
}

/**
 * A nook is empty ⟺ it holds nothing but `preset.json` / `*.json` (docs/doc-11
 * §4.1). `preset.json` is configuration, not content, so it does not count.
 *
 * Only DIRECT children count: content spilled into a subdirectory does not fill
 * the nook, matching the produce-spec where all nook files sit in the root.
 */
export function isNookEmpty(files: readonly string[], dir: string): boolean {
  return directChildrenOf(files, dir).every((name) => name.endsWith('.json'));
}

/**
 * Did the initialiser actually leave a product on disk? `status === 'completed'`
 * from `spawnAgent` does NOT imply this — the model may have written nothing.
 *
 * A failed product is treated as a failure so W2 can fall back: if the layer's
 * README never lands, the layer stays a stub and every later entry re-triggers
 * initialisation, forever (docs/doc-11 §3.1).
 *
 * - `scene`: the direct children include `README.md`.
 * - `nook`: the direct children include any non-`*.json` file.
 */
export function hasInitProduct(
  files: readonly string[],
  dir: string,
  kind: 'scene' | 'nook'
): boolean {
  const children = directChildrenOf(files, dir);
  return kind === 'scene'
    ? children.includes('README.md')
    : children.some((name) => !name.endsWith('.json'));
}
