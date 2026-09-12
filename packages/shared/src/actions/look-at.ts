/**
 * doc-03 `look_at` + `view_canvas` — the two read-only eyes.
 *
 * `look_at` is the text eye: "what is here, what does it look like, what can I do
 * with it". `view_canvas` is the composition eye: "does this layer read as a
 * scene". Both read only; neither writes a file, a canvas row, or an event
 * (doc-03 §8: all three admission questions fail, so nothing is appended).
 *
 * The page membership question is NOT answered here — `store.pageOfLayer` wraps
 * `cardsOfLayer` / `childLayers`, the same pair `GET /api/layer` reads, so the
 * agent's text view and the player's canvas can never diverge (doc-03 §4.3).
 */
import type { WorldStore } from '../store/world-store.js';
import { cardKindOf } from '../schemas/forms.js';
import {
  cardsOfLayer,
  childLayers,
  deriveLayers,
  dirOfLayer,
  layerOfDir,
  MAP_LAYER,
  WORLD_DIR,
} from '../store/layers.js';
import type { LayerConfig } from '../schemas/world.js';
import { parseFrontmatter } from '../schemas/frontmatter.js';
import { formatInteractiveText } from '../rules/interactive.js';
import { fail } from './errors.js';
import { registerAction } from './service.js';
import type { ActionContext, ActionResult } from './types.js';
import {
  renderCanvasBlock,
  renderEntityBlock,
  renderLayerBlock,
  type CanvasComposition,
  type LayerItem,
} from '../render/layer-page.js';
import { boxesOverlap } from '../render/spatial.js';

export interface LookAtInput {
  /**
   * World-relative POSIX path of a single `.md` entity, OR a directory (= a
   * layer / the map / `player` / `characters/<id>`), OR an array of both.
   * Omitted → the caller's current layer (doc-03 §2.1).
   * No leading `./`, no absolute path, no trailing `/` (00 §2.1).
   */
  path?: string | string[];
}

export interface LookAtDetails {
  /** Normalized paths actually resolved, in output order. */
  paths: string[];
  /** Which rendering each entry used. */
  entries: Array<{ path: string; mode: 'entity' | 'directory'; title: string }>;
  /** True when at least one entity body was cut by the body cap (doc-03 §5.4). */
  truncated: boolean;
  /** Total characters of `text` — lets a test assert size without re-measuring. */
  textLength: number;
  /** Never present: read-only (01 §4.1). Declared so the type is explicit. */
  event?: never;
}

export interface ViewCanvasInput {
  /** Layer to look at. Omitted → same default chain as look_at (doc-03 §2.1). */
  layer?: string;
  /**
   * 'auto' (default) — structured composition summary (B1's implementation).
   * 'image'          — a real screenshot. Declared legal, NOT implemented in B1
   *                    → ActionError('unsupported', …) (00 §7 anti-pattern 4:
   *                    no silent downgrade). Full plan + cost in doc-03 §6.
   */
  mode?: 'auto' | 'image';
  /** 'image' only: viewport in CSS px. Clamped to [320,2560]×[240,1600]. */
  viewport?: { width: number; height: number };
}

export interface ViewCanvasDetails {
  layer: string;
  /** What actually happened. 'summary' today; 'image' only when a shot was returned. */
  mode: 'summary' | 'image';
  /** Viewport the summary describes / the shot was taken at. */
  viewport: { width: number; height: number };
  /** Composition numbers the summary was rendered from (stable, for probes). */
  items: Array<{ path: string; kind: string; x: number; y: number; w: number; h: number; z: number }>;
  /** Pairs whose boxes intersect — the player sees these stacked. */
  overlaps: Array<[string, string]>;
  /** Items with no row in `canvas.db` yet. */
  unplaced: string[];
  /** Characters on this layer (canvas.db `presence`). */
  presence: Array<{ characterId: string; x: number; y: number; following: boolean }>;
  /** 'image' only, when implemented (doc-03 §6.3): `.airpworld/eye/<hash>.png`. */
  shot?: string;
  event?: never;
}

/** doc-03 §7.1 row 16: the clamp band for a declared viewport. */
const VIEWPORT_MIN = { width: 320, height: 240 };
const VIEWPORT_MAX = { width: 2560, height: 1600 };
/** The default when a summary runs with no declared viewport (doc-03 §6.1 row 4: the measured shot size). */
const VIEWPORT_DEFAULT = { width: 1440, height: 900 };

/**
 * doc-03 §7.2 layer 2 — the action layer re-checks the path discipline before
 * trusting the store. `resolvePath` is shared code with a known hole until
 * 01 §7.3's tightening lands, and a tool fed by model input must not outsource
 * its own safety.
 */
function assertSafePath(path: string): void {
  if (path === '') fail('invalid_argument', 'Path must not be empty');
  if (path.startsWith('/')) {
    fail('invalid_path', `Path must be world-relative, got "${path}"`);
  }
  if (path.includes('\\') || path.split('/').some((seg) => seg === '..')) {
    fail('invalid_path', `Path must not contain "..", got "${path}"`);
  }
  const first = path.replace(/^\.\//, '').split('/')[0];
  if (first.startsWith('.') || first === 'node_modules') {
    // `.airpworld/assets/**` is the one allowed hidden root (00 §2.5), but no
    // look_at target lives there: it is binary content, not an entity.
    fail('invalid_path', `Path is inside a reserved directory: "${path}"`);
  }
}

/** A parsed `.md` file, or `null` when the path is not a readable file. */
interface LoadedFile {
  fm: Record<string, any> | null;
  body: string;
}

async function loadFile(ctx: ActionContext, path: string): Promise<LoadedFile | null> {
  if ((await ctx.store.statKind(path)) !== 'file') return null;
  const parsed = parseFrontmatter(await ctx.store.readFile(path));
  return { fm: parsed.frontmatter, body: parsed.body };
}

/** The derived layer map, from one directory scan (doc-03 §5.1 boundary: 03 owns directories). */
async function layerConfigs(ctx: ActionContext): Promise<Record<string, LayerConfig>> {
  const files = await ctx.store.listFiles(WORLD_DIR);
  const dirs = new Set<string>([WORLD_DIR]);
  for (const file of files) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const fmByDir = new Map<string, Record<string, any> | null>();
  for (const dir of dirs) fmByDir.set(dir, (await loadFile(ctx, `${dir}/README.md`))?.fm ?? null);
  return deriveLayers([...dirs], (dir) => fmByDir.get(dir) ?? null);
}

/** Card boxes by path, for the layout/overlap sections. */
async function boxesOf(ctx: ActionContext, paths: string[]) {
  const rows = ctx.store.getLayerCards(paths);
  return new Map(rows.map((row) => [row.id, { x: row.x, y: row.y, w: row.w, h: row.h, z: row.z }]));
}

/** One file item, with its box attached when `cards` has a row (doc-03 §3.1). */
async function itemOf(
  ctx: ActionContext,
  path: string,
  box: { x: number; y: number; w: number; h: number; z: number } | undefined
): Promise<LayerItem | null> {
  const loaded = await loadFile(ctx, path);
  if (!loaded) return null;
  const item: LayerItem = { path, fm: loaded.fm, body: loaded.body, z: box?.z ?? 0 };
  if (box) item.box = { x: box.x, y: box.y, w: box.w, h: box.h };
  return item;
}

/**
 * B1 default chain (doc-03 §2.1): an omitted path means the player's current
 * layer. The viewpoint row now lives in `canvas.db` (B2 / 05 §2.6) — read it
 * through the store method rather than probing `sqlite_master` here. No row,
 * an empty row, or an expired one all degrade to `map`, which is what the old
 * probe did when the table was absent.
 */
async function resolveDefaultLayer(ctx: ActionContext): Promise<string> {
  return ctx.store.readViewpoint()?.layer || MAP_LAYER;
}

/** The entity block: path, title, body, then 06's interactive text (doc-03 §4.1). */
async function renderEntity(ctx: ActionContext, path: string): Promise<{ text: string; truncated: boolean }> {
  const loaded = await loadFile(ctx, path);
  if (!loaded) fail('not_found', `Nothing at "${path}" in this world`);
  return renderEntityBlock(path, loaded.fm, loaded.body, formatInteractiveText(loaded.fm));
}

/** The directory block: this layer's files + its direct child doors (doc-03 §4.2). */
async function renderDirectory(ctx: ActionContext, dir: string): Promise<string> {
  const layerId = layerOfDir(dir);
  const allFiles = await ctx.store.listFiles(WORLD_DIR);
  const layers = await layerConfigs(ctx);
  const cardPaths = cardsOfLayer(layerId, allFiles);
  const doorPaths = childLayers(layerId, layers).map((child) => `${child}/README.md`);
  const boxes = await boxesOf(ctx, [...cardPaths, ...doorPaths]);

  const cards: LayerItem[] = [];
  for (const cardPath of cardPaths) {
    const item = await itemOf(ctx, cardPath, boxes.get(cardPath));
    if (item) cards.push(item);
  }
  const doors: LayerItem[] = [];
  for (const doorPath of doorPaths) {
    const loaded = await loadFile(ctx, doorPath);
    if (!loaded) {
      // Stub layer: the door exists, the scene does not (doc-03 §4.2 rule 4).
      const item: LayerItem = { path: doorPath, fm: null, body: '', z: 0 };
      const box = boxes.get(doorPath);
      if (box) item.box = { x: box.x, y: box.y, w: box.w, h: box.h };
      doors.push(item);
      continue;
    }
    const item: LayerItem = { path: doorPath, fm: loaded.fm, body: loaded.body, z: 0 };
    const box = boxes.get(doorPath);
    if (box) item.box = { x: box.x, y: box.y, w: box.w, h: box.h };
    doors.push(item);
  }

  const config = layers[layerId];
  return renderLayerBlock({
    layerId,
    dir,
    layerName: config?.name ?? dir.split('/').pop() ?? layerId,
    stub: config?.stub === true,
    cards,
    doors,
    readmeFm: (await loadFile(ctx, `${dir}/README.md`))?.fm ?? null,
  });
}

export async function lookAt(ctx: ActionContext, input: LookAtInput): Promise<ActionResult<LookAtDetails>> {
  const raw = input?.path;
  if (Array.isArray(raw) && raw.length === 0) {
    fail('invalid_argument', 'Cannot look at an empty path list');
  }
  const targets =
    raw === undefined ? [await resolveDefaultLayer(ctx)] : Array.isArray(raw) ? [...raw] : [raw];

  // Deduplicate while preserving order: a repeated path must not print twice
  // (doc-03 §3.1 step 1 — the same discipline 10 §3.2 step 1 applies).
  const ordered: string[] = [];
  for (const target of targets) {
    const path = String(target).replace(/\/+$/, '');
    assertSafePath(path);
    if (!ordered.includes(path)) ordered.push(path);
  }

  const blocks: string[] = [];
  const entries: LookAtDetails['entries'] = [];
  let truncated = false;

  for (const path of ordered) {
    const kind = await ctx.store.statKind(path);
    if (kind === 'missing') fail('not_found', `Nothing at "${path}" in this world`);
    if (kind === 'dir') {
      const text = await renderDirectory(ctx, path);
      blocks.push(text);
      entries.push({ path, mode: 'directory', title: text.split('\n')[1] ?? path });
      continue;
    }
    const rendered = await renderEntity(ctx, path);
    if (rendered.truncated) truncated = true;
    blocks.push(rendered.text);
    entries.push({ path, mode: 'entity', title: rendered.text.split('\n')[1] ?? path });
  }

  const text = blocks.join('\n\n');
  return { text, details: { paths: ordered, entries, truncated, textLength: text.length } };
}

/** doc-03 §7.1 row 16: clamp, never fail. */
function clampViewport(viewport?: { width: number; height: number }): { width: number; height: number } {
  if (!viewport) return { ...VIEWPORT_DEFAULT };
  const width = Math.min(Math.max(Math.round(viewport.width), VIEWPORT_MIN.width), VIEWPORT_MAX.width);
  const height = Math.min(
    Math.max(Math.round(viewport.height), VIEWPORT_MIN.height),
    VIEWPORT_MAX.height
  );
  return { width, height };
}

/** Presence rows for a layer (doc-03 §6.2 "Characters present"). */
async function readPresence(
  ctx: ActionContext,
  layerId: string
): Promise<Array<{ characterId: string; x: number; y: number; following: boolean }>> {
  try {
    const rows = ctx.store.queryCanvas(
      'SELECT character_id, x, y, following FROM presence WHERE layer = ?',
      [layerId]
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      characterId: String(row.character_id),
      x: Number(row.x),
      y: Number(row.y),
      following: row.following === 1 || row.following === true,
    }));
  } catch {
    // No presence table yet (a world that never seated anyone): be honest with
    // an empty list rather than failing the read.
    return [];
  }
}

export async function viewCanvas(
  ctx: ActionContext,
  input: ViewCanvasInput
): Promise<ActionResult<ViewCanvasDetails>> {
  if (input?.mode === 'image') {
    fail(
      'unsupported',
      'view_canvas image mode is not implemented in B1; use mode "auto" for a structured composition summary'
    );
  }

  const rawLayer = input?.layer;
  const layerId =
    rawLayer === undefined ? await resolveDefaultLayer(ctx) : layerOfDir(String(rawLayer).replace(/\/+$/, '').replace(/^\.\//, ''));
  assertSafePath(layerId);

  const dir = dirOfLayer(layerId);
  if ((await ctx.store.statKind(dir)) !== 'dir') {
    fail('not_found', `No layer "${rawLayer ?? layerId}" in this world`);
  }

  const viewport = clampViewport(input?.viewport);
  const allFiles = await ctx.store.listFiles(WORLD_DIR);
  const layers = await layerConfigs(ctx);
  const cardPaths = cardsOfLayer(layerId, allFiles);
  const doorPaths = childLayers(layerId, layers).map((child) => `${child}/README.md`);
  const boxes = await boxesOf(ctx, [...cardPaths, ...doorPaths]);

  const items: LayerItem[] = [];
  for (const cardPath of cardPaths) {
    const item = await itemOf(ctx, cardPath, boxes.get(cardPath));
    if (item) items.push(item);
  }
  for (const doorPath of doorPaths) {
    const loaded = await loadFile(ctx, doorPath);
    const box = boxes.get(doorPath);
    const item: LayerItem = { path: doorPath, fm: loaded?.fm ?? null, body: loaded?.body ?? '', z: box?.z ?? 0 };
    if (box) item.box = { x: box.x, y: box.y, w: box.w, h: box.h };
    items.push(item);
  }

  const links = await ctx.store.getLayerLinks(layerId);
  const presence = await readPresence(ctx, layerId);
  const composition: CanvasComposition = {
    layerId,
    dir,
    layerName: layers[layerId]?.name ?? dir.split('/').pop() ?? layerId,
    stub: layers[layerId]?.stub === true,
    readmeFm: (await loadFile(ctx, `${dir}/README.md`))?.fm ?? null,
    items,
    links: links.map((link) => ({
      from: link.from,
      to: link.to,
      style: link.style,
      label: link.label,
    })),
    presence,
    viewport,
  };

  const placed = items.filter((item): item is LayerItem & { box: NonNullable<LayerItem['box']> } =>
    item.box !== undefined
  );
  const overlaps: Array<[string, string]> = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (boxesOverlap(placed[i].box, placed[j].box)) {
        overlaps.push([placed[i].path, placed[j].path]);
      }
    }
  }

  return {
    text: renderCanvasBlock(composition),
    details: {
      layer: layerId,
      mode: 'summary',
      viewport,
      items: placed.map((item) => ({
        path: item.path,
        kind: cardKindOf(item.fm, item.path.split('/').pop() ?? item.path),
        x: item.box.x,
        y: item.box.y,
        w: item.box.w,
        h: item.box.h,
        z: item.z,
      })),
      overlaps,
      unplaced: items.filter((item) => item.box === undefined).map((item) => item.path),
      presence,
    },
  };
}

registerAction('lookAt', (ctx, input) => lookAt(ctx, input as unknown as LookAtInput));
registerAction('viewCanvas', (ctx, input) => viewCanvas(ctx, input as unknown as ViewCanvasInput));
