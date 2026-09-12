import { Router } from 'express';
import type { Response } from 'express';
import fs from 'node:fs/promises';
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
 * shared's parseFrontmatter only resolves status/choice/roll_dice, so tone/grain are
 * extracted with a light regex from the raw text (plan §6.11).
 */
function readLayerBg(raw: string): { src: string | null; tone: string; grain: string } {
  let src: string | null = null;
  try {
    const parsed = parseFrontmatter(raw);
    const bgValue = parsed.frontmatter?.bg;
    if (typeof bgValue === 'string' && bgValue.trim() !== '') {
      // Strip trailing inline comments and quotes (parser keeps them verbatim).
      const cleaned = bgValue.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '').trim();
      src = cleaned === '' ? null : cleaned;
    }
  } catch {
    src = null;
  }
  const yamlScalar = (value: string | undefined, fallback: string) =>
    value?.trim().replace(/^['"]|['"]$/g, '') || fallback;
  const tone = yamlScalar(raw.match(/^\s*tone:\s*(\S+)/m)?.[1], 'warm');
  const grain = yamlScalar(raw.match(/^\s*grain:\s*(\S+)/m)?.[1], 'parchment');
  return { src, tone, grain };
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
      res.json(manifest);
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

      // bg from the layer README frontmatter (doc-10 E0); tone/grain via light regex
      let bg: { src: string | null; tone: string; grain: string } = { src: null, tone: 'warm', grain: 'parchment' };
      try {
        const readmePath = layer === 'map' ? 'world/README.md' : `${layer}/README.md`;
        const raw = await store.readFile(readmePath);
        bg = readLayerBg(raw);
      } catch {
        // README missing -> defaults
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
        x: Number(row.x),
        y: Number(row.y),
        following: Number(row.following) === 1,
      }));

      res.json({ layer, bg, items: enriched, links, presence, worldFrozen });
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
    await reply(res, () => serviceFor(store, { type: 'player' }).enterLayer({ layer }));
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

  return router;
}
