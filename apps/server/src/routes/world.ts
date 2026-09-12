import { Router } from 'express';
import { readWorldShelf, trashWorldSave, ShelfError } from '../world-shelf.js';
import type { Response } from 'express';
import fs from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  ActionError,
  LocalWorldStore,
  SEAT_ANCHOR,
  createActionService,
  parseFrontmatter,
  cardFormOf,
  cardKindOf,
  type Actor,
} from '@airp/shared';
import type { AgentLifecycleManager } from '../engine/lifecycle.js';
import type { EventBridge } from '../engine/event-bridge.js';

interface LayerItem {
  path: string;
  filename: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
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

/** Card footprint — the shared CARD_FORMS table is the single source
 *  (packages/shared/src/schemas/forms.ts), so the seated box and the painted
 *  box can never drift. */
function cardSize(item: LayerItem): { w: number; h: number } {
  const { w, h } = cardFormOf(item.frontmatter, item.filename);
  return { w, h };
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
  const dispatch = (store: LocalWorldStore, prompt: string) => {
    void lifecycle.submitWriter(store.worldRoot, prompt).catch(error => {
      eventBridge.broadcast({ type: 'error', source: 'writer', message: error instanceof Error ? error.message : String(error) });
    });
  };
  let worldFrozen = false;
  // Platform audio root: <REPO_ROOT>/assets/audio. `repoRoot` (index.ts:15) is the
  // repo root in both dev and prod, so this always points at the 31 produced clips.
  const AUDIO_ROOT = path.resolve(repoRoot, 'assets/audio');

  let shelfBusy = false;
  // List available templates and worlds
  router.get('/worlds', async (_req, res) => {
    try {
      res.json(await readWorldShelf(repoRoot, getActiveStore()?.worldRoot));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Load a world
  router.post('/worlds/load', async (req, res) => {
    if (shelfBusy) return res.status(409).json({ error: 'A world operation is in progress.' });
    shelfBusy = true;
    try {
      const { worldPath } = req.body;
      let resolvedPath = path.isAbsolute(worldPath) ? worldPath : path.join(repoRoot, worldPath);
      const templatesRoot = path.join(repoRoot, 'templates') + path.sep;
      if (resolvedPath.startsWith(templatesRoot)) {
        const playPath = path.join(repoRoot, 'worlds', `${path.basename(resolvedPath)}-${randomUUID().slice(0, 8)}`);
        await fs.cp(resolvedPath, playPath, { recursive: true });
        resolvedPath = playPath;
      }

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
    } finally {
      shelfBusy = false;
    }
  });

  router.delete('/worlds/save', async (req, res) => {
    if (shelfBusy) return res.status(409).json({ error: 'A world operation is in progress.' });
    shelfBusy = true;
    try {
      res.json(await trashWorldSave(repoRoot, req.body?.worldPath, getActiveStore()?.worldRoot));
    } catch (err) {
      res.status(err instanceof ShelfError ? err.status : 500).json({ error: err instanceof Error ? err.message : String(err) });
    } finally { shelfBusy = false; }
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
      const allItems: LayerItem[] = await Promise.all([
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
      // An authored gate replaces the automatic child directory sign.
      const targets = new Set(allItems.filter(it => it.frontmatter?.type === 'gate').map(it => it.frontmatter?.target));
      const items = allItems.filter(it => it.filename !== 'README.md' || !targets.has(it.path.replace(/\/README\.md$/, '')));
      const mdFiles = items.map((it) => it.path);

      // Card rows keyed by path (never by layer column - a nested layer README
      // appears in both its parent layer list and its own list).
      const rowByPath = new Map(store.getLayerCards(mdFiles).map((r) => [r.id, r]));

      // Seat and persist any card that has no row yet (placed cards never re-seat).
      const unseated = items
        .filter((it) => !rowByPath.has(it.path))
        .map((it) => ({ path: it.path, ...cardSize(it) }));
      if (unseated.length > 0) {
        for (const row of await store.seatUnplaced(layer, unseated)) {
          rowByPath.set(row.id, row);
        }
      }

      // Re-flow any card whose stored box drifted from the current form table
      // (a kind was resized in code). Without this the old seats overlap.
      for (const row of await store.reseatLayer(
        layer,
        items.map((it) => ({ path: it.path, ...cardSize(it) }))
      )) {
        rowByPath.set(row.id, row);
      }

      const enriched = items.map((it) => {
        const row = rowByPath.get(it.path);
        const form = cardFormOf(it.frontmatter, it.filename);
        return {
          ...it,
          kind: cardKindOf(it.frontmatter, it.filename),
          x: row ? row.x : SEAT_ANCHOR.x,
          y: row ? row.y : SEAT_ANCHOR.y,
          // w/h are a pure function of kind, so they always come from the form
          // table — never from the stored row. Resizing a kind re-flows every
          // card of that kind on the next paint (rows only persist x/y).
          w: form.w,
          h: form.h,
          z: row ? row.z : 1,
          rot: rotOf(it.path), // derived, never persisted
        };
      });

      // bg + audio from the layer README frontmatter (doc-10 E0; docs/audio/00 §3).
      let bg: { src: string | null; tone: string; grain: string } = { src: null, tone: 'warm', grain: 'parchment' };
      let audio: { ambient: string | null; bgm: string | null } = { ambient: null, bgm: null };
      try {
        const readmePath = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
        const raw = await store.readFile(readmePath);
        bg = readLayerBg(raw);
        const ownFm = parseFrontmatter(raw).frontmatter;
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

      res.json({ layer, bg, audio, items: enriched, links, presence, worldFrozen });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get backpack items (player/ directory)
  router.get('/backpack', async (_req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const allFiles = await store.listFiles('player');
      const items = await Promise.all(
        allFiles.map(async (file) => {
          const raw = await store.readFile(file);
          const { frontmatter, body } = parseFrontmatter(raw);
          return {
            path: file,
            filename: path.basename(file),
            frontmatter,
            body,
          };
        })
      );
      res.json({ items });
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
    await reply(res, async () => {
      const result = await serviceFor(store, { type: 'player' }).chooseOption({ path: choicePath, choice });
      dispatch(store, `[Player Event] ${JSON.stringify(result.details.event)}\nRead ${JSON.stringify(choicePath)} and the world skill. Resolve this choice, update the source file, and write a chalk response. Do not record the choice a second time.`);
      return result;
    });
  });

  // Player walks through a door into another layer (05 §3.6.2 / 12 §2.4).
  router.post('/enter-layer', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    const { layer } = req.body as { layer?: unknown };
    if (typeof layer !== 'string' || layer === '') {
      return res.status(400).json({ ok: false, code: 'invalid_argument', error: 'layer must be a non-empty layer id' });
    }
    await reply(res, async () => {
      const layers = (await store.getManifest()).layers;
      if (!layers[layer]) throw new ActionError({ code: 'not_found', message: 'Scene does not exist.' });
      const result = await serviceFor(store, { type: 'player' }).enterLayer({ layer });
      if (result.details.first) {
        dispatch(store, `[Player Event] ${JSON.stringify(result.details.event)}\n[Target Path] ${layer === 'map' ? 'world' : layer}\nThe player opens a door into an unwritten scene. Read world.json, the world skill, the parent README and its props before writing. Preserve all revealed context. If the target README now exists, continue it without regenerating. Otherwise write its README, two objects, and opening chalk. Then generate and attach one background image if available. Use the world skill's door procedure when present.`);
      }
      return result;
    });
  });

  /**
   * `/api/viewpoint` belongs to B2 / doc-22 §9 (a `viewpoint` row in canvas.db).
   * B1 deliberately ships no route and no table: a placeholder table now would
   * create a second source of truth (docs/tools/12 §2.4).
   */

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
