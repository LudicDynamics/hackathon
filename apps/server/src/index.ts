import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { LocalWorldStore } from '@airp/shared';
import { AgentLifecycleManager } from './engine/lifecycle.js';
import { EventBridge } from './engine/event-bridge.js';
import { createWorldRouter } from './routes/world.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor/pi-rp/packages/coding-agent/dist/cli.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

let activeStore: LocalWorldStore | null = null;
const eventBridge = new EventBridge();
eventBridge.setWss(wss);

const lifecycle = new AgentLifecycleManager({
  repoRoot: REPO_ROOT,
  vendorCliPath: VENDOR_CLI,
  eventSink: (source, event) => eventBridge.emitEngine(source, event),
  frameSink: (message) => eventBridge.broadcast(message),
});

// Auto-load default holmes-world if available
const DEFAULT_WORLD = path.join(REPO_ROOT, 'templates/holmes-world');
try {
  activeStore = new LocalWorldStore(DEFAULT_WORLD);
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
    (s) => { activeStore = s; }
  )
);

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
            await writer.prompt(data.message);
          }
        } catch (err: any) {
          console.error('[AIRP WS] Writer prompt failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'writer', message: err?.message || String(err) }));
        }
      } else if (data.type === 'writer_abort' || data.type === 'abort') {
        const writer = lifecycle.getWriter();
        if (writer) {
          await writer.abort().catch((err) => console.warn('[AIRP WS] Writer abort failed:', err));
        }
      } else if (data.type === 'character_start') {
        try {
          await lifecycle.startCharacter(data.characterId, data.worldPath);
        } catch (err: any) {
          console.error('[AIRP WS] Character start failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'character', characterId: data.characterId, message: err?.message || String(err) }));
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
        } catch (err: any) {
          console.error('[AIRP WS] Character prompt failed:', err);
          ws.send(JSON.stringify({ type: 'error', source: 'character', characterId: data.characterId, message: err?.message || String(err) }));
        }
      } else if (data.type === 'character_abort') {
        const character = lifecycle.getCharacter(data.characterId);
        if (character) {
          await character.abort().catch((err) => console.warn('[AIRP WS] Character abort failed:', err));
        }
      } else if (data.type === 'character_stop') {
        await lifecycle.stopCharacter(data.characterId);
      }
    } catch (err: any) {
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
