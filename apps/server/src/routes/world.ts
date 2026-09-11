import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalWorldStore, SEAT_ANCHOR, parseFrontmatter, stringifyChalk } from '@airp/shared';
import type { AgentLifecycleManager } from '../engine/lifecycle.js';
import type { EventBridge } from '../engine/event-bridge.js';

interface LayerItem {
  path: string;
  filename: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
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

/** W/H per card kind; the route computes these from parsed frontmatter and passes them into seating. */
const KIND_SIZES: Record<string, { w: number; h: number }> = {
  chalk: { w: 480, h: 220 },
  gate: { w: 288, h: 150 },
  letter: { w: 264, h: 180 },
  default: { w: 280, h: 180 },
};

function cardSize(item: LayerItem): { w: number; h: number } {
  const fm = item.frontmatter ?? {};
  if (fm.type === 'chalk') return KIND_SIZES.chalk;
  if (item.filename === 'README.md' || fm.type === 'gate') return KIND_SIZES.gate;
  if (fm.component === 'letter' || fm.type === 'letter') return KIND_SIZES.letter;
  return KIND_SIZES.default;
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
  const tone = raw.match(/^\s*tone:\s*(\S+)/m)?.[1] ?? 'warm';
  const grain = raw.match(/^\s*grain:\s*(\S+)/m)?.[1] ?? 'parchment';
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Load a world
  router.post('/worlds/load', async (req, res) => {
    try {
      const { worldPath } = req.body;
      const resolvedPath = path.isAbsolute(worldPath) ? worldPath : path.join(repoRoot, worldPath);

      const current = getActiveStore();
      if (current) current.close();

      const store = new LocalWorldStore(resolvedPath);
      setActiveStore(store);

      const manifest = await store.getManifest();
      eventBridge.watchWorld(resolvedPath);

      // Start writer process
      lifecycle.startWriter(resolvedPath, (evt) => {
        eventBridge.broadcast({ type: 'agent_event', ...evt });
      }).catch((err) => {
        console.warn('[Writer Startup Warning]', err);
      });

      res.json({ ok: true, manifest, path: resolvedPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get active world manifest
  router.get('/manifest', async (_req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const manifest = await store.getManifest();
      res.json(manifest);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get layer contents (cards, files)
  router.get('/layer', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const layer = (req.query.layer as string) || 'map';
      const allFiles = await store.listFiles();
      
      const layerPrefix = layer === 'map' ? 'world/' : `${layer}/`;
      // Find files directly inside layer
      const layerFiles = allFiles.filter((f) => {
        if (layer === 'map') {
          // In map, include world/README.md or items directly in world/
          return f.startsWith('world/') && f.split('/').length <= 3;
        }
        return f.startsWith(layerPrefix) && f.split('/').length <= layerPrefix.split('/').length + 1;
      });

      // Only .md files become cards (images/videos must not occupy a card slot)
      const mdFiles = layerFiles.filter((f) => f.endsWith('.md'));

      const items = await Promise.all(
        mdFiles.map(async (file): Promise<LayerItem> => {
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

      const enriched = items.map((it) => {
        const row = rowByPath.get(it.path);
        const size = cardSize(it);
        return {
          ...it,
          x: row ? row.x : SEAT_ANCHOR.x,
          y: row ? row.y : SEAT_ANCHOR.y,
          w: row ? row.w : size.w,
          h: row ? row.h : size.h,
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Move item (backpack <-> scene, etc.)
  router.post('/move', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const { from, to } = req.body;
      const result = await store.move(from, to);
      // Migrate canvas state so the new path doesn't spawn a second seat (plan §6.4).
      try {
        await store.renameCardPosition(from, to);
      } catch (err) {
        console.warn('[move] card position migration skipped:', err);
      }
      eventBridge.broadcast({ type: 'item_moved', result });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Persist a card's dropped position (UPSERT; z/w/h untouched)
  router.post('/card/position', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const body = req.body as { path?: unknown; x?: unknown; y?: unknown };
      const { path: cardPath, x, y } = body;
      if (typeof cardPath !== 'string' || cardPath === '') {
        return res.status(400).json({ error: 'Invalid path' });
      }
      if (
        typeof x !== 'number' || !Number.isFinite(x) ||
        typeof y !== 'number' || !Number.isFinite(y)
      ) {
        return res.status(400).json({ error: 'Invalid x/y' });
      }
      // Reject zombie rows: the file must actually exist
      try {
        await store.readFile(cardPath);
      } catch {
        return res.status(404).json({ error: `File not found: ${cardPath}` });
      }
      const card = await store.saveCardPosition(cardPath, x, y);
      eventBridge.broadcast({ type: 'card_position', path: cardPath, x, y });
      res.json({
        ok: true,
        card: { path: card.id, layer: card.layer, x: card.x, y: card.y, w: card.w, h: card.h, z: card.z },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Resolve roll_dice
  router.post('/dice', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const { filePath, rollType = '1d100', expect = '>50' } = req.body;
      const raw = await store.readFile(filePath);
      const { frontmatter, body } = parseFrontmatter(raw);

      if (!frontmatter) {
        return res.status(400).json({ error: 'File does not contain frontmatter' });
      }

      // Roll true random 1d100
      const diceMax = rollType.includes('d') ? Number(rollType.split('d')[1]) || 100 : 100;
      const rollResult = Math.floor(Math.random() * diceMax) + 1;

      // Evaluate expect expression (e.g. ">50", "<30", ">=60")
      let passed = false;
      const numMatch = expect.match(/(\d+)/);
      const threshold = numMatch ? Number(numMatch[1]) : 50;

      if (expect.startsWith('>=')) passed = rollResult >= threshold;
      else if (expect.startsWith('>')) passed = rollResult > threshold;
      else if (expect.startsWith('<=')) passed = rollResult <= threshold;
      else if (expect.startsWith('<')) passed = rollResult < threshold;
      else passed = rollResult === threshold;

      frontmatter.roll_dice = {
        ...(frontmatter.roll_dice || {}),
        type: rollType,
        expect,
        result: rollResult,
        passed,
      };

      const updatedContent = stringifyChalk(frontmatter, body);
      await store.writeFile(filePath, updatedContent);

      const event = await store.appendWorldEvent('roll_resolved', {
        filePath,
        rollType,
        expect,
        result: rollResult,
        passed,
      });

      eventBridge.broadcast({ type: 'roll_resolved', event, result: rollResult, passed });

      // Notify writer
      const writer = lifecycle.getWriter();
      if (writer) {
        writer.prompt(`[System notice: the player made a check "${expect}" and rolled ${rollResult} (${passed ? 'success' : 'failure'}). Continue the story and respond in narration accordingly.]`).catch(console.error);
      }

      res.json({ ok: true, result: rollResult, passed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Use item on target (Point-and-Click puzzle)
  router.post('/use-item', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const { itemPath, targetPath, targetType } = req.body;
      const event = await store.appendWorldEvent('use_item_on', {
        itemPath,
        targetPath,
        targetType,
      });

      eventBridge.broadcast({ type: 'use_item_on', event });

      // Inform writer agent
      const writer = lifecycle.getWriter();
      if (writer) {
        writer.prompt(`[System notice: the player used the item "${path.basename(itemPath)}" on "${path.basename(targetPath)}". Advance the scene's evolution and write a narrative response according to the item-interaction logic.]`).catch(console.error);
      }

      res.json({ ok: true, event });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // God mode toggle freeze
  router.post('/freeze', (_req, res) => {
    worldFrozen = !worldFrozen;
    eventBridge.broadcast({
      type: worldFrozen ? 'world_frozen' : 'world_thawed',
      timestamp: new Date().toISOString(),
    });
    res.json({ worldFrozen });
  });

  // God mode entity create/edit/delete
  router.post('/god-action', async (req, res) => {
    const store = getActiveStore();
    if (!store) return res.status(400).json({ error: 'No active world' });
    try {
      const { action, filePath, content } = req.body;
      if (action === 'create' || action === 'update') {
        await store.writeFile(filePath, content);
      } else if (action === 'delete') {
        await store.deleteFile(filePath);
      }

      const event = await store.appendWorldEvent('god_action', { action, filePath });
      eventBridge.broadcast({ type: 'god_action', event });

      // If thawed, inform writer
      if (!worldFrozen) {
        const writer = lifecycle.getWriter();
        writer?.prompt(`[System notice: the god hand modified the world object "${filePath}" (action: ${action}). Please stitch it into the narrative.]`).catch(console.error);
      }

      res.json({ ok: true, event });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
