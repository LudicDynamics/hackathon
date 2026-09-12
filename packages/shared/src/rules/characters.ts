/**
 * Character-id rules (docs/nook/00 §5.2 — the ONE implementation).
 *
 * Zero dependencies on purpose: no zod, no yaml, no node builtins. Any consumer
 * may import this safely — the server (route validation), the agent-process
 * extension (`airp-init`), and the unit tests (node --test, no build).
 *
 * The character id is the directory name under `characters/` (AGENTS.md §1.1:
 * ASCII lowercase kebab-case; the directory IS the id). Three callers need the
 * same three operations, so they live here and nowhere else:
 *   - `GET /api/nook`                (docs/nook/00 §3.2)
 *   - `arrangeCards` nook branch      (docs/nook/00 §3.7)
 *   - `POST /api/card/footprint`      (docs/nook/00 §3.3)
 * plus this batch's `airp-init` command.
 */

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
