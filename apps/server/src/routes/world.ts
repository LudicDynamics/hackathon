import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalWorldStore, parseFrontmatter, stringifyChalk } from '@airp/shared';
import type { AgentLifecycleManager } from '../engine/lifecycle.js';
import type { EventBridge } from '../engine/event-bridge.js';

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

      const items = await Promise.all(
        layerFiles.map(async (file) => {
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

      res.json({ layer, items, worldFrozen });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      eventBridge.broadcast({ type: 'item_moved', result });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
