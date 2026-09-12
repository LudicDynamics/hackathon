/**
 * Process-level dependencies for every tool shell.
 *
 * The two processes (server / agent) each build ONE WorldStore — docs/tools/00
 * §1: "动作实现 MUST 以『传入一个 WorldStore』为形状，两个进程各自 new 一个".
 * Inside the agent process we still only want ONE store: a store per tool call
 * would open two SQLite connections per call (docs/tools/02 §8.1).
 *
 * `worldRoot` comes from `ctx.cwd` (never `process.cwd()`): launch.ts pins the
 * spawned process cwd to the world root, and `ctx.cwd` is the API that keeps
 * being right if that ever changes (docs/tools/00 §1).
 *
 * Shared code is imported by RELATIVE path (`../../packages/shared/dist/index.js`):
 * `extensions/` is outside the pnpm workspace, so `@airp/shared` does not resolve
 * here (docs/tools/00 §6.1). A change under `packages/shared/src/` therefore
 * requires `pnpm --filter @airp/shared build` before it is visible (AGENTS.md §6.5).
 */
import { LocalWorldStore, createActionService, type ActionService } from '../../packages/shared/dist/index.js';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { agentActor, resetActorForTests } from './actor.js';
import { currentTurnAnchor } from './turn.js';

let store: LocalWorldStore | null = null;
let storeRoot: string | null = null;

/** Lazily open (once) the store for the given world root. */
export function worldStore(ctx: ExtensionContext): LocalWorldStore {
  const root = ctx.cwd;
  if (store && storeRoot !== root) {
    // A session can switch cwd (world switch in a long-lived process). Reopening
    // is correct here: the old root's connection would silently write the wrong world.
    store.close();
    store = null;
  }
  if (!store) {
    storeRoot = root;
    store = new LocalWorldStore(root);
  }
  return store;
}

/**
 * The caller's current layer, or null when nothing reports it.
 *
 * Same source the action layer's `look_at` default chain reads (doc-tools/03
 * §2.1): a `viewpoint` row in `canvas.db`. That table belongs to B2/doc-22, so
 * the query simply finds nothing in every B1 world and returns null — the
 * `chalk` shell then requires an explicit `path` instead of inventing a layer
 * (doc-tools/02 §12 item 1: guessing would put the file in the wrong scene).
 */
export function currentLayer(ctx: ExtensionContext): string | null {
  const store = worldStore(ctx);
  const tables = store.queryCanvas(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'viewpoint'"
  );
  if (tables.length === 0) return null;
  const rows = store.queryCanvas('SELECT layer FROM viewpoint LIMIT 1');
  const layer = rows.length > 0 && rows[0] ? String(rows[0].layer ?? '') : '';
  return layer === '' ? null : layer;
}

// Agent identity lives in ./actor.ts (docs/tools/00 §6.1 lists the file): the
// role env is read once per process, and only one module should own that cache.
export { agentActor };

/** The bound action service for this tool call. One instance per call: it carries the turn anchor. */
export function getActionService(ctx: ExtensionContext): ActionService {
  return createActionService(worldStore(ctx), agentActor(), { turn: currentTurnAnchor(ctx) });
}

/** Test seam — the probe / unit tests reset the cached store and actor. */
export function resetDepsForTests(): void {
  store?.close();
  store = null;
  storeRoot = null;
  resetActorForTests();
}
