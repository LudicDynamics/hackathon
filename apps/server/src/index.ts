import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { cpSync, existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { LocalWorldStore, createActionService, initializeMissingCharacterPresence, settleTurnCursor } from '@airp/shared';
import { PROTOCOL_VERSION, WS_CLOSE } from '@airp/shared';
import { AgentLifecycleManager } from './engine/lifecycle.js';
import { assertCharacterLaunchable } from './engine/launch.js';
import { EventBridge } from './engine/event-bridge.js';
import { createWorldRouter } from './routes/world.js';
import { LiveCallRegistry } from './engine/live-session.js';
import { createTtsRouter } from './routes/tts.js';
import { createLiveRouter } from './routes/live.js';
import { createConnectionSettingsRouter } from './routes/connection-settings.js';
import { createSttRouter } from './routes/stt.js';
import { handleSttStream, STT_STREAM_PATH } from './engine/stt-stream.js';
import { startHeartbeat } from './gateway/heartbeat.js';
import { closeCanvasBrowser } from './engine/canvas-browser.js';
import { createCanvasPerceptionRouter } from './routes/canvas-perception.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = process.env.AIRP_REPO_ROOT || path.resolve(__dirname, '../../..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor/pi-rp/packages/coding-agent/dist/cli.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');
// Explicit local overrides precede the legacy local file; ambient env still wins.
const localOverrides = path.join(REPO_ROOT, '.local.env');
if (existsSync(localOverrides)) process.loadEnvFile(localOverrides);
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
    '[AIRP TTS] DASHSCOPE_API_KEY not set; online TTS and local voice fallback are unavailable.'
  );
}

const app = express();
const server = http.createServer(app);
// `noServer` + an explicit upgrade hook, because a rejected upgrade must still
// complete the handshake to carry a close CODE: a bare `socket.destroy()` leaves
// the client with an HTTP 400 / 1006 and `closeKind` has nothing to classify
// (docs/gateway/03 §3.1 step 2). The `/ws/stt` branch MUST call `handleUpgrade`
// + `emit('connection')` too — under `noServer` the implicit upgrade handler is
// gone, so returning early would never open the socket and voice input dies
// (§3.1 step 4).
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // `/ws/stt` shares this wss and is split by path inside `wss.on('connection')`
  // below — same semantics as the old `startsWith(STT_STREAM_PATH)` branch.
  if (url.pathname === '/ws' || url.pathname.startsWith(STT_STREAM_PATH)) {
    if (url.pathname === '/ws' && url.searchParams.get('v') !== PROTOCOL_VERSION) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(WS_CLOSE.PROTOCOL_MISMATCH, 'protocol version mismatch');
      });
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    return;
  }
  // Unknown path: no upgrade — `express.static` / the SPA fallback own it.
});

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

// Open the first curated world and start its writer. A template is never played
// in place (that wrote play state into the repo): like `/api/worlds/load`, boot
// plays a copy under worlds/. The copy is stable per template so dev restarts
// keep progress instead of piling up saves.
const DEFAULT_SOURCE = path.resolve(REPO_ROOT, process.env.AIRP_WORLD ?? 'templates/wuwu');
const TEMPLATES_ROOT = path.join(REPO_ROOT, 'templates') + path.sep;
const DEFAULT_WORLD = DEFAULT_SOURCE.startsWith(TEMPLATES_ROOT)
  ? path.join(REPO_ROOT, 'worlds', `${path.basename(DEFAULT_SOURCE)}-default`)
  : DEFAULT_SOURCE;
let bootStore: LocalWorldStore | null = null;
try {
  if (!existsSync(path.join(DEFAULT_SOURCE, 'world.json'))) throw new Error('Default world is unavailable');
  if (DEFAULT_WORLD !== DEFAULT_SOURCE && !existsSync(path.join(DEFAULT_WORLD, 'world.json'))) {
    cpSync(DEFAULT_SOURCE, DEFAULT_WORLD, {
      recursive: true,
      filter: (source) => !['.airpworld', '.pi'].includes(path.relative(DEFAULT_SOURCE, source).split(path.sep)[0]),
    });
  }
  bootStore = new LocalWorldStore(DEFAULT_WORLD);
  await initializeMissingCharacterPresence(bootStore, { turn: `init:${randomUUID()}` });
  // Align the tail cursor BEFORE exposing or watching the store. Initial
  // presence events stay in history and are not replayed to the old world.
  eventBridge.startTailReader(bootStore);
  eventBridge.watchWorld(DEFAULT_WORLD);
  activeStore = bootStore;
  bootStore = null;
  console.log(`[AIRP Server] Default world loaded: ${DEFAULT_WORLD}`);
  // The frontend never calls /api/worlds/load, so without this the writer process
  // simply would not exist on the default path.
  lifecycle.startWriter(DEFAULT_WORLD).catch((err) => {
    console.warn('[AIRP Server] writer start failed:', err);
  });
} catch (err) {
  if (bootStore) {
    try { bootStore.close(); } catch { /* The startup failure is already reported below. */ }
    bootStore = null;
  }
  eventBridge.close();
  activeStore = null;
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
app.use('/api', createConnectionSettingsRouter(REPO_ROOT, {
  // The self-test probes the models the agents actually run on; `modelStatus`
  // starts the writer if needed, exactly as the Agents panel does.
  agentModels: async () => {
    if (!activeStore) return null;
    const status = await lifecycle.modelStatus(activeStore.worldRoot, false);
    return { writer: status.writer.model, characters: status.characters };
  },
}));
// Player voice input (docs/live-voice/语音输入（STT）.md): HTTP-only, no world needed.
app.use('/api', createSttRouter());
// Server-side Canvas DOM screenshots: active-world/read-only only, no WS transport.
app.use('/api', createCanvasPerceptionRouter(() => activeStore));

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
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  // Connection-scoped liveness wiring (docs/gateway/03 §3.2 step 7 / §8, REVIEW
  // M2): it MUST live here, not in `startHeartbeat`, because the sweeper only
  // walks `wss.clients` when its timer fires and would never seed a connection
  // created after the last sweep. Applies to `/ws/stt` too — harmless, since
  // RFC 6455 answers protocol pings automatically. Without the pong reset a live
  // socket stays `false` and is terminated on the next sweep (~every 60s).
  // `ws` types do not declare `isAlive` (the rivet idiom); a structural alias
  // keeps the annotation local instead of augmenting the global `ws` module.
  const liveness = ws as WebSocket & { isAlive?: boolean };
  liveness.isAlive = true;
  ws.on('pong', () => {
    liveness.isAlive = true;
  });
  // Live voice input has its own socket; it never joins the event fan-out.
  if (req.url?.startsWith(STT_STREAM_PATH)) {
    handleSttStream(ws);
    return;
  }
  console.log('[AIRP WS] Client connected');

  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

  // Replay the last complete turns to this client before live frames flow
  // (docs/gateway/02 §6.1). Synchronous by design: no frame can interleave
  // between the ring snapshot and `replay_done`.
  eventBridge.replayTo(ws);

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

// 30s protocol-level ping + one-missed-pong terminate (docs/gateway/03 §3.2).
// Started after the connection handler is registered and before `listen`, so no
// connection can be created without the liveness wiring above.
const heartbeat = startHeartbeat(wss);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const HOST = process.env.AIRP_HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[AIRP Server] Listening on http://${HOST}:${PORT} and http://localhost:${PORT}`);
});

// Retire every spawned agent and browser on shutdown.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    heartbeat.stop();
    void lifecycle.stopAll().finally(async () => {
      await closeCanvasBrowser();
      process.exit(0);
    });
  });
}
