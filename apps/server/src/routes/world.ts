import { Router } from 'express';
import type { Response } from 'express';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  ActionError,
  LocalWorldStore,
  SEAT_ANCHOR,
  boxSizeOf,
  dirOfLayer,
  createActionService,
  listBackpack,
  parseFrontmatter,
  cardFormOf,
  cardKindOf,
  sanitiseForBlock,
  type Actor,
  type CardRecord,
  type ViewRect,
} from '@airp/shared';
import type { AgentLifecycleManager } from '../engine/lifecycle.js';
import type { EventBridge } from '../engine/event-bridge.js';

interface LayerItem {
  path: string;
  filename: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
}

interface SceneReadme extends LayerItem {
  kind: 'scene';
}

/**
 * One HTTP request = one `turn` anchor (docs/tools/01 §3.7, C entry).
 *
 * `randomUUID()` and not a counter: the server and every agent process each
 * keep their own counter, so the two would collide. A request id only has to
 * be unique and stable, never ordered (docs/tools/12 §2.4).
 */
function serviceFor(store: LocalWorldStore, actor: Actor) {
  return createActionService(store, actor, { turn: `req:${randomUUID()}` });
}

/**
 * ActionError → HTTP; anything else → 500. The status code comes from the ONE
 * table in docs/tools/01 §7.1 (`ActionError.toHttp()`); this layer MUST NOT
 * invent its own (docs/tools/12 §7.1).
 *
 * The response body is always `{ ok: true, ...details }` or
 * `{ ok: false, code, error }`.
 */
async function reply(
  res: Response,
  run: () => Promise<{ details: Record<string, unknown> }>
): Promise<void> {
  try {
    res.json({ ok: true, ...(await run()).details });
  } catch (err) {
    if (err instanceof ActionError) {
      const http = err.toHttp();
      res.status(http.status).json(http.body);
      return;
    }
    res.status(500).json({
      ok: false,
      code: 'internal',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Deterministic pseudorandom hash (doc-04 §4) - mirror of the frontend lib/camera hashInt. */
function hashInt(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Integer degrees in [-3, 3], derived per card path, never persisted. */
function rotOf(cardPath: string): number {
  return (hashInt(cardPath) % 7) - 3;
}

/** SHAPE gate only (00 §14.1 rule 4): the value must LOOK like a layer id.
 *  NOT dot-relative like `assertWorldPath` (presence.ts:29) — relative paths are
 *  meaningless outside the action layer. This is NECESSARY, NOT SUFFICIENT: it
 *  does not reject newlines / quotes / backticks / injected prose, and the value
 *  is echoed verbatim into the state block, so every accepted value MUST then
 *  pass `sanitiseForBlock` (00 §14). */
function isPlausibleLayer(layer: string): boolean {
  if (layer === 'map') return true; // MAP_LAYER, store/layers.ts
  if (!layer.startsWith('world/')) return false;
  const segs = layer.split('/');
  return segs.every((s) => s !== '' && s !== '.' && s !== '..');
}

/** Clamp a numeric field, or null when it is not a real finite number.
 *  NOT Nodesign's `Number(v)`: `Number(null)`/`Number('')` are 0 and would let a
 *  null camera component through — 00 §11 requires the whole report be refused. */
function num(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}

/** The one NEW browser-direct input on the injection path (00 §5.2). Rejects
 *  the WHOLE report on a malformed camera — a half-believed rect is worse than
 *  none. Every accepted STRING is then folded through `sanitiseForBlock`
 *  (00 §14). `at` is NOT produced here: it is the server clock's stamp (05 §4.1
 *  table's last row), applied by `writeViewpoint`. */
function sanitizeViewpoint(raw: unknown): {
  layer: string;
  focus: ViewRect | null;
  selected: string[];
  bagCount: number;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  const rawLayer = typeof body.layer === 'string' && body.layer.length <= 300 ? body.layer : '';
  if (rawLayer !== '' && !isPlausibleLayer(rawLayer)) return null;
  // Content-level pass (00 §14.1 rules 1-3): fold newlines / control chars /
  // quotes and cap length. The shape gate above is NOT enough (INJ-01).
  const layer = sanitiseForBlock(rawLayer, { maxLength: 300 });

  let focus: ViewRect | null = null;
  if (body.camera !== undefined && body.camera !== null) {
    if (typeof body.camera !== 'object') return null;
    const c = body.camera as Record<string, unknown>;
    const x = num(c.x, -1e6, 1e6);
    const y = num(c.y, -1e6, 1e6);
    const w = num(c.w, 1, 1e5);
    const h = num(c.h, 1, 1e5);
    if (x === null || y === null || w === null || h === null) return null;
    // The wire sends the world-space visible rect's TOP-LEFT. `focus` is the
    // CENTRE in WORLD coords (ViewpointRecord's contract): `camera.x` already
    // equals `cam.x - vw / (2 * z)`, so the centre is x + w / 2.
    focus = { x: x + w / 2, y: y + h / 2, w, h };
  }

  const rawBag = num(body.bagCount, 0, 999);
  const bagCount = rawBag === null ? 0 : Math.trunc(rawBag);

  const selected = (Array.isArray(body.selected) ? body.selected : [])
    .filter((s): s is string => typeof s === 'string' && s.length <= 300)
    .slice(0, 24)
    .map((s) => sanitiseForBlock(s, { maxLength: 300 }));

  return { layer, focus, selected, bagCount };
}

/**
 * DECLARED footprint of a kind — `reseatLayer` judges "was this kind resized in
 * code?" by hashing `kind + w + h`, so `kind` is part of the payload (00 §5.1
 * 第 4 条 / §9 第 8 条). MUST NOT be used for a collision test: since F1 the
 * stored row is the card's real footprint (00 §3.1).
 */
function declaredSizeOf(item: LayerItem): { kind: string; w: number; h: number } {
  const form = cardFormOf(item.frontmatter, item.filename);
  return { kind: cardKindOf(item.frontmatter, item.filename), w: form.w, h: form.h };
}

/**
 * STORED footprint — the row is the truth; declared is only the first-paint
 * default for a card that has no row yet (00 §3.4). This is what `seatUnplaced`
 * seats a brand-new card with, so a long chalk gets a seat that fits it.
 */
function storedSizeOf(
  item: LayerItem,
  row: CardRecord | undefined
): { kind: string; w: number; h: number } {
  const declared = declaredSizeOf(item);
  if (row && (row.w <= 0 || row.h <= 0)) {
    // Degenerate row is corruption, not a normal state: never silent (00 §7).
    console.warn(`/api/layer: card "${item.path}" has a degenerate row (w=${row.w}, h=${row.h}); using the declared form.`);
  }
  const { w, h } = boxSizeOf(row, declared);
  return { kind: declared.kind, w, h };
}

/**
 * Layer background config from the layer README (doc-10 E0: bg is a README field).
 * `bgStyle` is a NESTED block (templates/holmes-world/world/README.md:6-8); a bare
 * regex on the raw text also matched prose lines (docs/audio/01 §8.1), so tone/grain
 * now come from the structured frontmatter. `bg.src` cleaning is unchanged.
 */
function readLayerBg(raw: string): { src: string | null; tone: string; grain: string } {
  let src: string | null = null;
  let tone = 'warm';
  let grain = 'parchment';
  try {
    const fm = parseFrontmatter(raw).frontmatter;
    const bgValue = fm?.bg;
    if (typeof bgValue === 'string' && bgValue.trim() !== '') {
      // Strip trailing inline comments and quotes (parser keeps them verbatim).
      const cleaned = bgValue.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '').trim();
      src = cleaned === '' ? null : cleaned;
    }
    if (typeof fm?.bgStyle?.tone === 'string') tone = fm.bgStyle.tone;
    if (typeof fm?.bgStyle?.grain === 'string') grain = fm.bgStyle.grain;
  } catch {
    src = null;
  }
  return { src, tone, grain };
}

/**
 * Bare-name candidate table, order = priority (docs/audio/00 §2.3).
 * Probing is LEVEL-MAJOR: every WORLD-level candidate is tried before any
 * PLATFORM-level one, so a world's private `ambient/pool/X` beats a platform
 * `ambient/X` — world overrides platform (docs/audio/01 §3.2 step 4).
 */
const AUDIO_POOL: Record<'ambient' | 'bgm', readonly string[]> = {
  ambient: ['ambient/{n}.mp3', 'ambient/pool/{n}.mp3'],
  bgm: ['bgm/{n}.mp3', 'themes/{n}.mp3'],
};

/**
 * One audio value → URL. Three shapes (docs/audio/00 §1/§3.1):
 *   - `assets/…` → direct world-relative file → `/api/asset?path=<enc>` (missing → null)
 *   - a value containing `/` that is NOT `assets/`-prefixed → contract violation:
 *     warn + null (fail-loud, response shape unchanged)
 *   - a bare name → the 5-step override chain: world-level (all candidates, override)
 *     then platform-level (all candidates, fallback); nothing found → null
 */
function resolveAudioRef(
  v: string,
  kind: 'ambient' | 'bgm',
  store: LocalWorldStore,
  audioRoot: string
): string | null {
  const val = v.trim();
  if (val === '') return null;

  if (val.startsWith('assets/')) {
    const abs = path.resolve(store.worldRoot, val);
    if (abs !== store.worldRoot && !abs.startsWith(store.worldRoot + path.sep)) {
      console.warn('[audio] ref escapes world root:', val);
      return null;
    }
    // A declared-but-absent world path folds to null (declared silence), NOT a
    // frontend fetch failure (which would fall back to synthesis, 00 §7).
    if (!existsSync(abs)) return null;
    return `/api/asset?path=${encodeURIComponent(val)}`;
  }

  if (val.includes('/')) {
    console.warn('[audio] ref must be a bare pool key or start with assets/:', val);
    return null;
  }

  for (const level of ['world', 'platform'] as const) {
    for (const tpl of AUDIO_POOL[kind]) {
      const cand = tpl.replace('{n}', val);
      if (level === 'world') {
        if (existsSync(path.resolve(store.worldRoot, 'assets/audio', cand))) {
          return `/api/asset?path=${encodeURIComponent(`assets/audio/${cand}`)}`;
        }
      } else if (existsSync(path.join(audioRoot, cand))) {
        return `/api/audio?path=${encodeURIComponent(cand)}`;
      }
    }
  }
  return null;
}

/**
 * Translate one README's top-level `ambient` / `bgm` into URLs (docs/audio/00 §3.1).
 * Pure translation of THIS file — inheritance across READMEs lives in `/api/layer`.
 */
function readLayerAudio(
  fm: Record<string, any> | null,
  store: LocalWorldStore,
  audioRoot: string
): { ambient: string | null; bgm: string | null } {
  const out: { ambient: string | null; bgm: string | null } = { ambient: null, bgm: null };
  for (const kind of ['ambient', 'bgm'] as const) {
    const raw = fm?.[kind];
    if (typeof raw === 'string' && raw.trim() !== '') {
      out[kind] = resolveAudioRef(raw, kind, store, audioRoot);
    }
  }
  return out;
}

export function createWorldRouter(
  repoRoot: string,
  lifecycle: AgentLifecycleManager,
  eventBridge: EventBridge,
  getActiveStore: () => LocalWorldStore | null,
  setActiveStore: (store: LocalWorldStore | null) => void
): Router {
  const router = Router();
  let worldFrozen = false;
  // Platform audio root: <REPO_ROOT>/assets/audio. `repoRoot` (index.ts:15) is the
  // repo root in both dev and prod, so this always points at the 31 produced clips.
  const AUDIO_ROOT = path.resolve(repoRoot, 'assets/audio');

  // List available templates and worlds
  router.get('/worlds', async (_req, res) => {
    try {
      const templatesDir = path.join(repoRoot, 'templates');
      const templates = await fs.readdir(templatesDir);

      const worldsDir = path.join(repoRoot, 'worlds');
      let worlds: string[] = [];
      try {
        worlds = await fs.readdir(worldsDir);
      } catch {}

      res.json({ templates, worlds });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Load a world
  router.post('/worlds/load', async (req, res) => {
    try {
      const { worldPath } = req.body;
      const resolvedPath = path.isAbsolute(worldPath) ? worldPath : path.join(repoRoot, worldPath);

      worldFrozen = false;
      await lifecycle.stopCharacters();

      const current = getActiveStore();
      if (current) current.close();

      const store = new LocalWorldStore(resolvedPath);
      setActiveStore(store);

      const manifest = await store.getManifest();
      // Re-align lastSeq against the NEW history.db before watching: the old
      // cursor belongs to another sequence and could permanently skip events
      // (docs/tools/12 §8.6 / §8 "index.ts 的接线").
      eventBridge.startTailReader(store);
      eventBridge.watchWorld(resolvedPath);

      // Start writer process (reused when the same world is already loaded)
      lifecycle.startWriter(resolvedPath).catch((err) => {
        console.warn('[Writer Startup Warning]', err);
      });

      res.json({ ok: true, manifest, path: resolvedPath });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get active world manifest
  router.get('/manifest', async (_req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const manifest = await store.getManifest();
      // Resolve the world theme key to a URL here — the frontend never resolves
      // README/manifest audio values (docs/audio/00 §4.1/§9.2). `themes` lives in
      // the `bgm` pool table (00 §2.3).
      const themeKey = manifest.audio?.theme;
      const theme =
        typeof themeKey === 'string' && themeKey.trim() !== ''
          ? resolveAudioRef(themeKey, 'bgm', store, AUDIO_ROOT)
          : null;
      res.json({ ...manifest, audio: { theme } });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get layer contents (cards, files)
  router.get('/layer', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const layer = (req.query.layer as string) || 'map';
      const { cards: cardFiles, doorIds } = await store.pageOfLayer(layer);
      // Each door = the child layer's README if it exists (a written scene), or
      // a synthesised stub door when the child has no README yet (doc-11 §3).
      const items: LayerItem[] = await Promise.all([
        ...cardFiles.map(async (file): Promise<LayerItem> => {
          const raw = await store.readFile(file);
          const { frontmatter, body } = parseFrontmatter(raw);
          return { path: file, filename: path.basename(file), frontmatter, body };
        }),
        ...doorIds.map(async (id): Promise<LayerItem> => {
          const readme = `${id}/README.md`;
          try {
            const { frontmatter, body } = parseFrontmatter(await store.readFile(readme));
            return { path: readme, filename: 'README.md', frontmatter, body };
          } catch {
            return {
              path: readme,
              filename: 'README.md',
              frontmatter: { type: 'readme', stub: true, name: id.split('/').pop() },
              body: 'This scene has not been written yet.',
            };
          }
        }),
      ]);
      const mdFiles = items.map((it) => it.path);

      // Card rows keyed by path (never by layer column - a nested layer README
      // appears in both its parent layer list and its own list).
      const rowByPath = new Map(store.getLayerCards(mdFiles).map((r) => [r.id, r]));

      // Seat and persist any card that has no row yet (placed cards never re-seat).
      const unseated = items
        .filter((it) => !rowByPath.has(it.path))
        .map((it) => ({ path: it.path, ...storedSizeOf(it, rowByPath.get(it.path)) }));
      if (unseated.length > 0) {
        for (const row of await store.seatUnplaced(layer, unseated)) {
          rowByPath.set(row.id, row);
        }
      }

      // Re-flow any card whose stored footprint drifted: a kind was resized in
      // code (declared hash mismatch) or the front end measured a new size.
      // Both live in `reseatLayer` (00 §5.1); without this the old seats overlap.
      for (const row of await store.reseatLayer(
        layer,
        items.map((it) => ({ path: it.path, ...declaredSizeOf(it) }))
      )) {
        rowByPath.set(row.id, row);
      }

      const enriched = items.map((it) => {
        const row = rowByPath.get(it.path);
        const { kind, w, h } = storedSizeOf(it, row);
        return {
          ...it,
          kind,
          x: row ? row.x : SEAT_ANCHOR.x,
          y: row ? row.y : SEAT_ANCHOR.y,
          // w/h come from the stored row: since F1 those columns are the card's
          // REAL footprint, written by POST /api/card/footprint once the front
          // end measures it (00 §3.1). The form table is only the first-paint
          // default for a row that is missing or degenerate.
          w,
          h,
          z: row ? row.z : 1,
          rot: rotOf(it.path), // derived, never persisted
        };
      });

      // The layer's own README is its entry Chalk as well as its scene config.
      // It is returned separately from `items`: the same README is a gate on
      // the parent page, so seating it again here would create one path with two
      // incompatible positions.
      let scene: SceneReadme | null = null;

      // bg + audio from the layer README frontmatter (doc-10 E0; docs/audio/00 §3).
      let bg: { src: string | null; tone: string; grain: string } = { src: null, tone: 'warm', grain: 'parchment' };
      let audio: { ambient: string | null; bgm: string | null } = { ambient: null, bgm: null };
      try {
        const readmePath = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
        const raw = await store.readFile(readmePath);
        const parsedReadme = parseFrontmatter(raw);
        scene = {
          path: readmePath,
          filename: 'README.md',
          frontmatter: parsedReadme.frontmatter,
          body: parsedReadme.body,
          kind: 'scene',
        };
        bg = readLayerBg(raw);
        const ownFm = parsedReadme.frontmatter;
        const own = readLayerAudio(ownFm, store, AUDIO_ROOT);
        audio = own;
        // Inheritance is keyed on DECLARATION, not on resolution: `??` cannot tell
        // "key absent" from "key present but null" — and the latter is declared
        // silence that MUST NOT fall back (docs/audio/00 §3.3, three-state table).
        if (layer !== 'map') {
          // Only the map README read is guarded — a failure here must not swallow
          // the layer's own `audio` resolved above.
          try {
            const mapFm = parseFrontmatter(await store.readFile('world/README.md')).frontmatter;
            const inh = readLayerAudio(mapFm, store, AUDIO_ROOT);
            // `k in ownFm` = "declared" (docs/audio/00 §3.3); resolution result is
            // separate — a declared key that resolves to null stays null (silence).
            audio = {
              ambient: ownFm != null && 'ambient' in ownFm ? own.ambient : (inh.ambient ?? null),
              bgm: ownFm != null && 'bgm' in ownFm ? own.bgm : (inh.bgm ?? null),
            };
          } catch {
            // map README missing -> no inheritance, keep own
          }
        }
      } catch {
        // README missing -> defaults (audio stays the declared-silence default)
      }

      const links = (store.queryCanvas(
        'SELECT id, from_id, to_id, style, label FROM links WHERE layer = ?',
        [layer]
      ) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        from: String(row.from_id),
        to: String(row.to_id),
        style: row.style ? String(row.style) : 'solid',
        label: row.label == null ? null : String(row.label),
      }));

      const presence = (store.queryCanvas(
        'SELECT character_id, x, y, following FROM presence WHERE layer = ?',
        [layer]
      ) as Array<Record<string, unknown>>).map((row) => ({
        characterId: String(row.character_id),
        y: Number(row.y),
        following: Number(row.following) === 1,
      }));

      res.json({ layer, scene, bg, audio, items: enriched, links, presence, worldFrozen });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get backpack items (player/ directory). The scan lives in shared so the
  // injection-side `bag` section and this route name one fact once
  // (docs/hooks/02 §3.1/§4.2); `BagItem`'s field names are the contract the
  // sidebar reads (`RightSidebar.tsx`), so they are not this route's to change.
  router.get('/backpack', async (_req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      res.json({ items: await listBackpack(store) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get characters and presence
  router.get('/characters', async (_req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const manifest = await store.getManifest();
      const chars = await Promise.all(
        (manifest.characters || []).map(async (c) => {
          let avatar = c.avatar;
          let bio = c.description;
          try {
            const raw = await store.readFile(`characters/${c.id}/README.md`);
            const { frontmatter, body } = parseFrontmatter(raw);
            if (frontmatter?.avatar) avatar = frontmatter.avatar;
            if (!bio) bio = body.slice(0, 100);
          } catch {}
          return {
            ...c,
            avatar: avatar || '/assets/characters/portraits/fella_1.png',
            bio,
          };
        })
      );
      res.json({ characters: chars });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Move item (backpack <-> scene, etc.) — the single action, no local rules.
  // The router used to call `store.move` + `renameCardPosition` and broadcast an
  // `item_moved` frame; the frame is deleted (docs/tools/12 §6.2) and the event
  // reaches the frontend as `world_event{entity_moved}` via the tail reader.
  router.post('/move', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { from, to, near } = req.body as { from?: unknown; to?: unknown; near?: unknown };
    if (typeof from !== 'string' || from === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'from must be a non-empty world-relative path' });
    }
    if (typeof to !== 'string' || to === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'to must be a non-empty world-relative path' });
    }
    await reply(res, () =>
      serviceFor(store, { type: 'player' }).moveEntity({
        from,
        to,
        ...(typeof near === 'string' && near !== '' ? { near } : {}),
      })
    );
  });

  /**
   * Persist a card's dropped position.
   *
   * The state write goes through `arrangeCards({ place })` (09 §8.3: one action
   * semantics), but the frame is `card_position` — NOT `canvas_patched`, which is
   * reserved for the tool path (docs/tools/12 §6.5). Broadcasting has to happen
   * after the action succeeded, so this route cannot use `reply` (which swallows
   * the error).
   */
  router.post('/card/position', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { path: cardPath, x, y } = req.body as { path?: unknown; x?: unknown; y?: unknown };
    if (typeof cardPath !== 'string' || cardPath === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'path must be a non-empty string' });
    }
    if (
      typeof x !== 'number' || !Number.isFinite(x) ||
      typeof y !== 'number' || !Number.isFinite(y)
    ) {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'x and y must be finite numbers' });
    }
    try {
      const r = await serviceFor(store, { type: 'player' }).arrangeCards({ place: { path: cardPath, x, y } });
      eventBridge.broadcast({ type: 'card_position', path: cardPath, x, y });
      res.json({ ok: true, ...r.details });
    } catch (err) {
      if (err instanceof ActionError) {
        const h = err.toHttp();
        return res.status(h.status).json(h.body);
      }
      res.status(500).json({ ok: false, code: 'internal', error: err instanceof Error ? err.message : String(err) });
    }
  });

  /**
   * Persist measured card footprints (docs/footprint/03 §3.1, contract §3.3).
   *
   * The second "card state HTTP write", deliberately asymmetric with
   * `/card/position`: a player may never resize a card through `arrange`, but
   * the renderer's measured fact may overwrite the stored box (contract §5.3).
   *
   * Writes ONLY `cards.width/height` (+ `metadata.measuredAt`) via the store,
   * keyed by `id = path` alone. It MUST NOT write an event (contract §3.6 — a
   * derived render fact, not world content) and MUST NOT broadcast a frame:
   * the caller IS the measurer, so a frame would only echo stale data back.
   *
   * 200 → { ok: true, updated, unchanged }   (unknown path/row → skipped, counted in `unchanged`)
   * 404 → { ok: false, code: 'not_found' }   (layer name does not exist)
   * 400 → { ok: false, code: 'invalid_argument' } (malformed layer/boxes)
   */
  router.post('/card/footprint', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { layer, boxes } = req.body as { layer?: unknown; boxes?: unknown };
    if (typeof layer !== 'string' || layer === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'layer must be a non-empty layer id' });
    }
    // L3: the store matches rows by `id = path` ONLY, so this layer check is the
    // single gate that keeps a mistyped layer name from silently writing rows
    // that live in another layer. 404 (not 400): an unknown layer is "not found".
    if ((await store.resolveLayer(dirOfLayer(layer))) !== layer) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'layer must be an existing layer id' });
    }
    if (!Array.isArray(boxes)) {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'boxes must be an array' });
    }
    if (boxes.length === 0) return res.json({ ok: true, updated: 0, unchanged: 0 });
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i] as { path?: unknown; w?: unknown; h?: unknown } | null;
      // Whole-request 400, never "skip the bad ones": the only caller is our own
      // frontend, so a bad box is a bug and partial writes would hide it (03 L6).
      if (b === null || typeof b !== 'object') {
        return res.status(400).json({ ok: false, code: 'invalid_argument', error: `boxes[${i}] must be an object` });
      }
      if (typeof b.path !== 'string' || b.path === '') {
        return res.status(400).json({ ok: false, code: 'invalid_argument', error: `boxes[${i}].path must be a non-empty string` });
      }
      if (typeof b.w !== 'number' || !Number.isFinite(b.w) || b.w <= 0 || b.w > 1e6) {
        return res.status(400).json({ ok: false, code: 'invalid_argument', error: `boxes[${i}].w must be a finite positive number` });
      }
      if (typeof b.h !== 'number' || !Number.isFinite(b.h) || b.h <= 0 || b.h > 1e6) {
        return res.status(400).json({ ok: false, code: 'invalid_argument', error: `boxes[${i}].h must be a finite positive number` });
      }
    }
    await reply(res, async () => ({
      details: await store.writeFootprints(layer, boxes as Array<{ path: string; w: number; h: number }>),
    }));
  });

  // Resolve roll_dice — `rollDice` is the ONE adjudicator (doc-20 §2.2). The old
  // body rolled, parsed `expect` and wrote the file back here, a second rule set.
  // The HTTP path sends NO presentation frame (§3.3 step 5): the frontend drives
  // the animation from this response; `dice_result` belongs to the tool path.
  router.post('/dice', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { path: dicePath, forcedResult } = req.body as { path?: unknown; forcedResult?: unknown };
    if (typeof dicePath !== 'string' || dicePath === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'path must be a non-empty world-relative path' });
    }
    if (forcedResult !== undefined && (typeof forcedResult !== 'number' || !Number.isFinite(forcedResult))) {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'forcedResult must be a finite number' });
    }
    // Only a forged score is a god action; a plain click is the player's (07 §5.2).
    const actor: Actor = typeof forcedResult === 'number' ? { type: 'god' } : { type: 'player' };
    await reply(res, () =>
      serviceFor(store, actor).rollDice({
        path: dicePath,
        ...(typeof forcedResult === 'number' ? { forcedResult } : {}),
      })
    );
  });

  // Use item on target (point-and-click puzzle). No bare frame: the event goes
  // out as `world_event{use_item_on}` (docs/tools/08 §6.2 / 12 §6.2).
  router.post('/use-item', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { item, target } = req.body as { item?: unknown; target?: unknown };
    if (typeof item !== 'string' || item === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'item must be a non-empty world-relative path' });
    }
    if (typeof target !== 'string' || target === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'target must be a non-empty world-relative path' });
    }
    await reply(res, () => serviceFor(store, { type: 'player' }).useItemOn({ item, target }));
  });

  // Player picks one of the public options an entity declares (06 §2.5).
  router.post('/choice', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { path: choicePath, choice } = req.body as { path?: unknown; choice?: unknown };
    if (typeof choicePath !== 'string' || choicePath === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'path must be a non-empty world-relative path' });
    }
    if (!((typeof choice === 'string' && choice !== '') || (typeof choice === 'number' && Number.isFinite(choice)))) {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'choice must be a string label or a 1-based number' });
    }
    await reply(res, () => serviceFor(store, { type: 'player' }).chooseOption({ path: choicePath, choice }));
  });

  // Player walks through a door into another layer (05 §3.6.2 / 12 §2.4).
  router.post('/enter-layer', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { layer } = req.body as { layer?: unknown };
    if (typeof layer !== 'string' || layer === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'layer must be a non-empty layer id' });
    }
    // P0 gate contract: a target README may require exact backpack paths.
    // Later requirement axes (facts / companions / adjudicated RP) will extend
    // this block without changing the README-as-gate source of truth.
    const readmePath = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
    if ((await store.statKind(readmePath)) === 'file') {
      const parsed = parseFrontmatter(await store.readFile(readmePath));
      if (parsed.errors.length > 0) {
        return res.status(409).json({
          ok: false,
          code: 'invalid_gate',
          error: `This scene cannot be entered because its README is invalid: ${parsed.errors[0]}`,
        });
      }
      const rawItems = parsed.frontmatter?.requires?.items;
      const requiredItems = Array.isArray(rawItems)
        ? rawItems.filter((item): item is string => typeof item === 'string' && item !== '')
        : [];
      const invalidItem = requiredItems.find(
        (item) => !item.startsWith('player/') || !item.endsWith('.md') || item.split('/').includes('..')
      );
      if (invalidItem) {
        return res.status(409).json({
          ok: false,
          code: 'invalid_gate',
          error: `Gate requirements must name player/*.md backpack paths, got: ${invalidItem}`,
        });
      }
      const missing: string[] = [];
      for (const item of requiredItems) {
        if ((await store.statKind(item)) !== 'file') missing.push(item);
      }
      if (missing.length > 0) {
        const blocked = parsed.frontmatter?.blocked;
        return res.status(409).json({
          ok: false,
          code: 'requirements_not_met',
          error:
            typeof blocked === 'string' && blocked.trim() !== ''
              ? blocked
              : `This scene is still locked. Missing: ${missing.join(', ')}`,
          missing,
        });
      }
    }
    // A stub has no README yet; entering it is what asks the world to
    // materialise one, so absence must not become an artificial lock.
    await reply(res, () => serviceFor(store, { type: 'player' }).enterLayer({ layer }));
  });

  // The player's viewpoint (00 §5). No event, no WS frame: this is a
  // current-value report, not a world change (there is no `state_changed`; the
  // row is not the world). Synchronous: `writeViewpoint` uses `execCanvas`, and
  // this is not an action, so it does not go through `reply()`.
  router.post('/viewpoint', (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const v = sanitizeViewpoint(req.body);
    if (!v) {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'viewpoint report rejected' });
    }
    const at = store.writeViewpoint(v); // the ONE writer; returns the server-stamped `at`
    res.json({ ok: true, at });
  });

  // God mode toggle freeze — a presentation toggle, not an action: it writes no
  // event and broadcasts a演出 frame directly (docs/tools/12 §2.4).
  router.post('/freeze', (_req, res) => {
    worldFrozen = !worldFrozen;
    eventBridge.broadcast({
      type: worldFrozen ? 'world_frozen' : 'world_thawed',
      timestamp: new Date().toISOString(),
    });
    res.json({ worldFrozen });
  });

  /**
   * God mode entity create/edit/delete — actor `god`, through the same actions
   * the tools use. `content` stays as an escape hatch for a whole-file god
   * rewrite; it is parsed into frontmatter + body so the single action path
   * still owns the event (docs/tools/12 §2.4.1).
   */
  router.post('/god-action', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const body = req.body as {
      action?: unknown;
      path?: unknown;
      frontmatter?: unknown;
      body?: unknown;
      content?: unknown;
    };
    const action = body.action;
    if (action !== 'create' && action !== 'update' && action !== 'delete') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'action must be one of: create, update, delete' });
    }
    const targetPath = body.path;
    if (typeof targetPath !== 'string' || targetPath === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'path must be a non-empty world-relative path' });
    }

    let frontmatter = (typeof body.frontmatter === 'object' && body.frontmatter !== null
      ? (body.frontmatter as Record<string, unknown>)
      : undefined);
    let content = typeof body.body === 'string' ? body.body : undefined;
    if (typeof body.content === 'string') {
      const parsed = parseFrontmatter(body.content);
      frontmatter = frontmatter ?? (parsed.frontmatter ?? undefined);
      content = content ?? parsed.body;
    }

    const svc = serviceFor(store, { type: 'god' });
    if (action === 'delete') {
      await reply(res, () => svc.removeEntity({ path: targetPath }));
      return;
    }
    if (action === 'create') {
      await reply(res, () =>
        svc.createEntity({
          path: targetPath,
          body: content ?? '',
          ...(frontmatter ? { frontmatter } : {}),
        })
      );
      return;
    }
    await reply(res, () =>
      svc.editEntity({
        path: targetPath,
        ...(frontmatter ? { frontmatter } : {}),
        ...(content !== undefined ? { body: content } : {}),
      })
    );
  });

  /**
   * Serve a world asset (scene backdrop, portrait, …) from the active world root.
   * The frontend requests `/api/asset?path=<world-relative>`; the store path
   * resolver strips any `../` traversal, and we refuse anything outside the
   * world root as a second belt. Assets are frequently absent in templates, so
   * a miss is a plain 404 — the client degrades to the material skin.
   */
  router.get('/asset', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const rel = String(req.query.path || '').replace(/^\/+/, '');
    if (!rel) return res.status(400).json({ error: 'path required' });
    try {
      const abs = path.resolve(store.worldRoot, rel);
      if (!abs.startsWith(store.worldRoot + path.sep)) {
        return res.status(403).json({ error: 'path escapes world root' });
      }
      res.sendFile(abs);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /**
   * Serve a platform audio clip from `<REPO_ROOT>/assets/audio` (the 31 produced
   * files). Same double traversal belt as `/asset`, plus a symlink re-check since
   * only the first check inspects the unresolved string. Clips are immutable build
   * artifacts, so they get a year-long `immutable` cache (docs/audio/01 §3.1).
   */
  router.get('/audio', (req, res) => {
    const rel = String(req.query.path || '').replace(/^\/+/, '');
    if (!rel) return res.status(400).json({ error: 'path required' });
    if (rel.split('/').includes('..')) {
      return res.status(403).json({ error: 'path must not contain ..' });
    }
    try {
      const abs = path.resolve(AUDIO_ROOT, rel);
      if (!abs.startsWith(AUDIO_ROOT + path.sep)) {
        return res.status(403).json({ error: 'path escapes audio root' });
      }
      const real = realpathSync(abs);
      if (!real.startsWith(realpathSync(AUDIO_ROOT) + path.sep)) {
        return res.status(403).json({ error: 'path escapes audio root (symlink)' });
      }
      res.sendFile(
        abs,
        { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        (err) => {
          if (err && !res.headersSent) {
            res.status(404).json({ error: err.message });
          }
        }
      );
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
