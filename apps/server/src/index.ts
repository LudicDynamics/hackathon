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
});

// Open the first curated world on a cold start.
(async () => {
  const defaultWorld = path.join(REPO_ROOT, 'templates/wuwu');
  try {
    activeStore = new LocalWorldStore(defaultWorld);
    eventBridge.watchWorld(defaultWorld);
    console.log(`[AIRP Server] Default world loaded: ${defaultWorld}`);
  } catch (err) {
    console.warn('[AIRP Server] No default world found, waiting for user selection.');
  }
})();

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
          ws.send(JSON.stringify({ type: 'error', message: 'Writer agent is not running' }));
          return;
        }
        await writer.prompt(data.message);
      } else if (data.type === 'character_start') {
        const { characterId, recentContext } = data;
        if (!activeStore) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active world' }));
          return;
        }
        await lifecycle.startCharacter(characterId, activeStore.worldRoot, String(recentContext || ''), (evt) => {
          ws.send(JSON.stringify(evt));
        });
      } else if (data.type === 'character_prompt') {
        const running = await lifecycle.promptCharacter(data.characterId, data.message);
        if (!running) {
          ws.send(JSON.stringify({ type: 'error', message: 'Character agent is not running' }));
        }
      } else if (data.type === 'character_stop') {
        lifecycle.stopCharacter(data.characterId);
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
