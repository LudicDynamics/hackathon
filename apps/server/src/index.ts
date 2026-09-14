import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { LocalWorldStore, createActionService, settleTurnCursor } from '@airp/shared';
import { AgentLifecycleManager } from './engine/lifecycle.js';
import { assertCharacterLaunchable } from './engine/launch.js';
import { EventBridge } from './engine/event-bridge.js';
import { createWorldRouter } from './routes/world.js';
import { LiveCallRegistry } from './engine/live-session.js';
import { createTtsRouter } from './routes/tts.js';
import { createLiveRouter } from './routes/live.js';
import { createConnectionSettingsRouter } from './routes/connection-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor/pi-rp/packages/coding-agent/dist/cli.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');
const localEnv = path.join(REPO_ROOT, '.env.local');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

// Load .env before ANY AIRP_* / DASHSCOPE_* read. Node native, no dotenv
// dependency (docs/tts/00 §3.3). A missing file is normal (CI / first checkout),
// and a malformed one degrades to the ambient env rather than refusing to boot.
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  /* no .env → ambient env */
}

// Config is read per request and the failure reaches the client as 503, so this
// startup warn is a convenience, not the only signal (docs/tts/00 §4.5).
if (!process.env.DASHSCOPE_API_KEY) {
  console.warn(
    '[AIRP TTS] DASHSCOPE_API_KEY not set; /api/tts returns 503 (character voice disabled).'
  );
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

let activeStore: LocalWorldStore | null = null;
const eventBridge = new EventBridge();
eventBridge.setWss(wss);

// Character overlay open-time high-water marks (03 §4.3). Module-level and
// in-process (server + lifecycle share this process); NOT persisted — an open
// overlay is transient, so a restart legitimately forgets it. `character_stop`
// pins the cursor to the value recorded at `character_start`, so events that
// happened to OTHER readers while the overlay was open are not swallowed.
const characterOpenHighWater = new Map<string, number>();
let warnedMissingHighWater = false;

const lifecycle = new AgentLifecycleManager({
  repoRoot: REPO_ROOT,
  vendorCliPath: VENDOR_CLI,
  eventSink: (source, event, characterId, turnId) => eventBridge.emitEngine(source, event, characterId, turnId),
  activityFailureSink: (source, characterId, turnId, reason) => eventBridge.failActivity(source, characterId, turnId, reason),
  frameSink: (message) => eventBridge.broadcast(message),
});

// Live voice calls (docs/live-voice/00). The registry is built here — the
// composition root — because two routers need it: `createLiveRouter` opens and
// closes calls, and `createWorldRouter` closes them all on world switch / save
// deletion (§2.4 freeze 3). Building it in either router would force the other
// to import it.
//
// `onVisibleFailure` rides the EXISTING character `error` frame rather than a
// new WS frame (§2.8): `useWorld` already forwards it to `airp:character-frame`
// (useWorld.ts:583), so a failed delegation reaches the browser visibly instead
// of stalling silently (docs/tools/00 hard rule 4).
const liveCalls = new LiveCallRegistry({
  repoRoot: REPO_ROOT,
  lifecycle,
  readCharacterReadme: async (characterId) => {
    const store = activeStore;
    if (!store) return null;
    try {
      return await store.readFile(`characters/${characterId}/README.md`);
    } catch {
      return null;
    }
  },
  onVisibleFailure: (characterId, reason) => {
    eventBridge.broadcast({ type: 'error', source: 'character', characterId, message: reason });
  },
});

// Open the first curated world and start its writer.
const DEFAULT_WORLD = path.resolve(REPO_ROOT, process.env.AIRP_WORLD ?? 'templates/wuwu');
try {
  if (!existsSync(path.join(DEFAULT_WORLD, 'world.json'))) throw new Error('Default world is unavailable');
  activeStore = new LocalWorldStore(DEFAULT_WORLD);
  // Align the tail cursor BEFORE watching — the watcher kicks `drain()`, and
  // aligning first keeps "align, then listen" unambiguous (docs/tools/12 §8.6).
  eventBridge.startTailReader(activeStore);
  eventBridge.watchWorld(DEFAULT_WORLD);
  console.log(`[AIRP Server] Default world loaded: ${DEFAULT_WORLD}`);
  // The frontend never calls /api/worlds/load, so without this the writer process
  // simply would not exist on the default path.
  lifecycle.startWriter(DEFAULT_WORLD).catch((err) => {
    console.warn('[AIRP Server] writer start failed:', err);
  });
} catch (err) {
  console.warn('[AIRP Server] No default world found, waiting for user selection.');
}

// API Routes
app.use(
  '/api',
  createWorldRouter(
    REPO_ROOT,
    lifecycle,
    eventBridge,
    () => activeStore,
    (s) => { activeStore = s; },
    liveCalls
  )
);

// TTS rides the same /api prefix. Express matches in order and the two routers
// own disjoint paths (/api/tts* vs /api/worlds… /api/asset…), so the second
// never shadows the first. Only getActiveStore is shared: TTS is HTTP-only and
// must never touch the WS fan-out (docs/tts/00 §10.1).
app.use('/api', createTtsRouter(REPO_ROOT, () => activeStore));
// Realtime voice calls (docs/live-voice/00). Mounted after `createWorldRouter`
// on purpose: that router's `needsWorld` middleware is scoped to its own paths
// (world.ts:407-422), so `/api/live/config` stays answerable with no world
// while `/api/live/session` does its own nook check.
app.use('/api', createLiveRouter(() => activeStore, liveCalls));
app.use('/api', createConnectionSettingsRouter(REPO_ROOT));

// Serve static frontend files from apps/web/dist
app.use(express.static(WEB_DIST));

// SPA fallback for frontend client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(WEB_DIST, 'index.html'));
});

// WebSocket client connection handling
wss.on('connection', (ws: WebSocket) => {
  console.log('[AIRP WS] Client connected');

  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

  ws.on('message', async (raw: string) => {
    try {
      const data = JSON.parse(raw.toString());
      if (lifecycle.isModelSwitching() && ['writer_prompt', 'character_start', 'character_prompt'].includes(data.type)) {
        ws.send(JSON.stringify({ type: 'error', source: data.type.startsWith('character') ? 'character' : 'writer', characterId: data.characterId, message: 'Models are switching. Please try again shortly.' }));
        return;
      }

      if (data.type === 'writer_prompt') {
        const writer = lifecycle.getWriter();
        if (!writer) {
          ws.send(JSON.stringify({ type: 'error', source: 'writer', message: 'Writer agent is not running' }));
          return;
        }
        try {
          if (data.mode === 'steer') {
            await writer.steer(data.message);
          } else if (data.mode === 'followUp') {
            await writer.followUp(data.message);
          } else {
            if (!activeStore) throw new Error('No active world');
            void lifecycle.submitWriter(activeStore.worldRoot,
              `[Current Layer] ${typeof data.layer === 'string' ? data.layer : 'map'}\n[Player Request] ${data.message}`
            ).catch(err => ws.send(JSON.stringify({ type: 'error', source: 'writer', message: err.message })));
          }
        } catch (err: unknown) {
          console.error('[AIRP WS] Writer prompt failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'writer', message: err instanceof Error ? err.message : String(err) }));
        }
      } else if (data.type === 'airp_init') {
        // Initialization trigger (docs/init/03): hand the request to the writer
        // process as an extension command. Fire-and-forget: the command returns an
        // ack as soon as it is recognised (pi-rp acknowledges on acceptance, not on
        // handler completion — see docs/rpc.md), but the *result* only exists once
        // the 45–60s generation lands, so blocking this WS handler on it would be
        // wrong regardless. The outcome returns through the events table
        // (`layer_initialized` / `layer_init_failed`), which the client already
        // consumes as a `world_event`.
        const writer = lifecycle.getWriter();
        if (!writer) {
          ws.send(JSON.stringify({ type: 'error', source: 'writer', message: 'Writer agent is not running' }));
          return;
        }
        const initPayload = {
          kind: data.kind,
          target: data.target,
          by: data.by === 'player' ? 'player' : 'engine',
          ...(typeof data.request === 'string' && data.request !== '' ? { request: data.request } : {}),
          ...(data.template === true ? { template: true } : {}),
        };
        void writer
          .prompt(`/airp-init ${JSON.stringify(initPayload)}`)
          .catch((err: unknown) =>
            console.warn('[AIRP WS] airp_init dispatch failed:', err instanceof Error ? err.message : String(err))
          );
      } else if (data.type === 'writer_abort' || data.type === 'abort') {
        const writer = lifecycle.getWriter();
        if (writer) {
          await writer.abort().catch((err) => console.warn('[AIRP WS] Writer abort failed:', err));
        }
      } else if (data.type === 'character_start') {
        try {
          const worldPath = activeStore?.worldRoot;
          if (!worldPath) throw new Error('No active world for the character agent');
          // Pin the open-time high-water BEFORE spawning (03 §4.3): the close
          assertCharacterLaunchable(worldPath, String(data.characterId));
          // path settles the cursor to this seq, so "world changed while the
          // overlay was open" is reported on the NEXT open instead of being
          // swallowed. A failed read must not block opening (doc 00 §11).
          if (activeStore) {
            try {
              characterOpenHighWater.set(String(data.characterId), await activeStore.getMaxSeq());
            } catch (err) {
              console.warn('[AIRP WS] character open high-water read failed:', err);
            }
          }
          await lifecycle.startCharacter(data.characterId, worldPath);
        } catch (err: unknown) {
          console.error('[AIRP WS] Character start failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'character', characterId: data.characterId, message: err instanceof Error ? err.message : String(err) }));
        }
      } else if (data.type === 'character_prompt') {
        const character = lifecycle.getCharacter(data.characterId);
        if (!character) {
          ws.send(JSON.stringify({ type: 'error', source: 'character', characterId: data.characterId, message: `Character agent "${data.characterId}" is not running` }));
          return;
        }
        try {
          if (data.mode === 'steer') {
            await character.steer(data.message);
          } else if (data.mode === 'followUp') {
            await character.followUp(data.message);
          } else {
            await character.prompt(data.message);
          }
        } catch (err: unknown) {
          console.error('[AIRP WS] Character prompt failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'character', characterId: data.characterId, message: err instanceof Error ? err.message : String(err) }));
        }
      } else if (data.type === 'character_abort') {
        const character = lifecycle.getCharacter(data.characterId);
        if (character) {
          await character.abort().catch((err) => console.warn('[AIRP WS] Character abort failed:', err));
        }
      } else if (data.type === 'character_stop') {
        // Record the beat BEFORE retiring the process: the action layer reads
        // characters/<id>/README.md for `detail.name` (doc-21 §3.3), and a
        // stopped client can no longer be asked anything (docs/tools/12 §3.5).
        if (activeStore) {
          try {
            const svc = createActionService(activeStore, { type: 'player' }, { turn: `req:${randomUUID()}` });
            // M-8: no frontend counter exists today, so a missing/0 count is an
            // ESTIMATE — say so via details.turnsEstimated instead of passing a
            // guess off as measured.
            const provided = Number(data.turns) > 0;
            await svc.noteCharacterTalked({
              character: String(data.characterId),
              turns: provided ? Number(data.turns) : 1,
              turnsEstimated: provided ? undefined : true,
            });
          } catch (err) {
            // A missing event is far less bad than a leaked agent process.
            console.warn('[AIRP WS] character_talked event skipped:', err);
          }
        }
        // Settle the character's read cursor on CLOSE (03 §4.3 call point 3) —
        // never on open (a crash / misclick would swallow the span forever).
        // The pinned seq is the open-time high-water; a missing key (e.g. the
        // server restarted mid-overlay) degrades to `getMaxSeq()` + one warn.
        if (activeStore) {
          const key = String(data.characterId);
          const pinned = characterOpenHighWater.get(key);
          if (pinned === undefined && !warnedMissingHighWater) {
            warnedMissingHighWater = true;
            console.warn(
              `[AIRP WS] character_stop for "${key}" has no open high-water; falling back to the max seq`
            );
          }
          const opts = pinned === undefined ? {} : { seq: pinned };
          await settleTurnCursor(activeStore, `character:${key}`, opts);
          // Close consumes the overlay: forget the pinned high-water.
          characterOpenHighWater.delete(key);
        }
        await lifecycle.stopCharacter(data.characterId);
      }
    } catch (err: unknown) {
      console.error('[AIRP WS Error]', err);
    }
  });

  ws.on('close', () => {
    console.log('[AIRP WS] Client disconnected');
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AIRP Server] Listening on http://0.0.0.0:${PORT} and http://localhost:${PORT}`);
});

// Retire every spawned agent on shutdown — otherwise pi-rp processes outlive the server.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void lifecycle.stopAll().finally(() => process.exit(0));
  });
}
