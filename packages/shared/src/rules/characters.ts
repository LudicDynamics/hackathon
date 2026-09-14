/**
 * Character-id rules (docs/nook/00 §5.2 — the ONE implementation).
 *
 * Zero dependencies on purpose: no zod, no yaml, no node builtins. Any consumer
 * may import this safely — the server (route validation), the agent-process
 * extension (`airp-init`), and the unit tests (node --test, no build).
 *
 * The character id is the directory name under `characters/` (AGENTS.md §1.1:
 * ASCII lowercase kebab-case; the directory IS the id). The server route, the
 * `arrangeCards` action, `POST /api/card/footprint` and this batch's `airp-init`
 * command all need the same operations, so they live here and nowhere else:
 *   - `GET /api/nook`                (docs/nook/00 §3.2)
 *   - `arrangeCards` nook branch      (docs/nook/00 §3.7)
 *   - `POST /api/card/footprint`      (docs/nook/00 §3.3)
 * plus this batch's `airp-init` command.
 */

import { directChildrenOf } from './emptiness.js';

/** A valid character id: lowercase ASCII kebab-case, no path separators. */
const CHARACTER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** True when `id` is a legal character id (docs/nook/00 §5.2). */
export function isValidCharacterId(id: string): boolean {
  return CHARACTER_ID_RE.test(id);
}

/**
 * The nook id for a character: `characters/<id>` (world-root relative, no
 * leading or trailing slash — docs/nook/00 §3.2), or null when `id` is illegal.
 *
 * This is the ONLY place that builds the nook path shape; callers must not
 * concatenate it themselves (docs/nook/00 anti-pattern 2).
 */
export function nookIdOf(id: string): string | null {
  return isValidCharacterId(id) ? `characters/${id}` : null;
}

/**
 * The character id a path belongs to: `characters/<id>` or `characters/<id>/…`
 * → `<id>`; anything else, or an illegal id, → null.
 *
 * The id segment must contain no `/`, so traversal (`characters/a/../..`) never
 * matches — the guard is the id regex, not a path normalise (docs/nook/00 §3.2).
 */
export function characterIdOfPath(path: string): string | null {
  const PREFIX = 'characters/';
  if (!path.startsWith(PREFIX)) return null;
  const rest = path.slice(PREFIX.length);
  const slash = rest.indexOf('/');
  const id = slash === -1 ? rest : rest.slice(0, slash);
  return isValidCharacterId(id) ? id : null;
}

/**
 * The four immutable configuration files at a character nook root.
 *
 * This deliberately accepts world-root-relative paths only and reuses the
 * canonical character path parser; nested files with the same basename are
 * ordinary lived traces, not configuration.
 */
export function characterRootConfigOf(
  path: string
): 'README.md' | 'identity.md' | 'personality.md' | 'memory.md' | null {
  const characterId = characterIdOfPath(path);
  if (characterId === null) return null;
  const prefix = `characters/${characterId}/`;
  if (!path.startsWith(prefix)) return null;
  const filename = path.slice(prefix.length);
  if (filename.includes('/')) return null;
  if (
    filename === 'README.md' ||
    filename === 'identity.md' ||
    filename === 'personality.md' ||
    filename === 'memory.md'
  ) {
    return filename;
  }
  return null;
}

/**
 * The markdown a nook page shows: direct-child `.md` under
 * `characters/<id>/`, minus the four root configuration files.
 *
 * Distinct question from `characterIdOfPath`: this one answers "what does the
 * page display" (direct children only), that one answers "which character owns
 * this path" (subdirectories included). Do not merge them.
 */
export function nookCardPaths(allFiles: readonly string[], nookId: string): string[] {
  return directChildrenOf(allFiles, nookId)
    .filter(
      (name) =>
        name.endsWith('.md') &&
        characterRootConfigOf(`${nookId}/${name}`) === null
    )
    .map((name) => `${nookId}/${name}`);
}
