// Offline HTTP contract test: fixture receipts are NOT generated story samples.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from '../node_modules/express/index.js';
import { LocalWorldStore } from '../../../packages/shared/dist/index.js';
import { createWorldRouter } from '../dist/routes/world.js';
import { EventBridge } from '../dist/engine/event-bridge.js';

test('First Snow: readable gates, both arrival choices, receipt gate and gated growth', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-snow-contract-'));
  await fs.cp(new URL('../../../archive/templates/pre-bilingual-2026-09-14/first-snow-jp/', import.meta.url), root, { recursive: true });
  const store = new LocalWorldStore(root);
  const calls = [];
  const bridge = new EventBridge();
  const app = express();
  app.use(express.json());
  app.use('/api', createWorldRouter(path.resolve('.'), {
    submitWriter: async (_root, prompt) => calls.push(prompt),
  }, bridge, () => store, () => {}));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (route, data) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  try {
    const main = 'world/tonight';
    const ending = `${main}/first-snow`;
    assert.equal((await post('/enter-layer', { layer: main })).status, 409);
    assert.equal((await post('/move', { from: 'world/request-sheet.md', to: 'player/request-sheet.md' })).status, 200);
    assert.equal((await post('/enter-layer', { layer: main })).status, 200);
    assert.equal((await post('/enter-layer', { layer: ending })).status, 409);
    assert.equal(calls.length, 0, 'browsing prewritten rooms must not start generation');
    // Choices only dispatch once the world opts in (docs/settings/00). Turn the
    // switch on before the arrival choices so their prompts are produced.
    await fs.writeFile(path.join(root, '.airpworld/settings.json'), '{"autoWrite":"scenes-and-choices"}\n');
    for (const scene of ['radio-studio', 'amber-cafe']) {
      const layer = `${main}/${scene}`;
      await post('/enter-layer', { layer });
      const page = await (await fetch(`${base}/layer?layer=${encodeURIComponent(layer)}`)).json();
      assert.ok(page.scene, 'scene README must be exposed as the scene Chalk');
      assert.equal((await post('/choice', { path: `${layer}/README.md`, choice: 1 })).status, 200);
      assert.match(calls.at(-1), /一緒/);
      assert.ok(calls.at(-1).includes(`${layer}/README.md`));
    }
    assert.equal(calls.length, 2);
    assert.equal((await post('/enter-layer', { layer: ending })).status, 409,
      'a submitted choice is not a completed result');
    const beforeInvalid = (await store.getEvents()).length;
    assert.equal((await post('/choice', { path: `${main}/radio-studio/README.md`, choice: 99 })).status, 422);
    assert.equal((await store.getEvents()).length, beforeInvalid);
    // A mechanical fixture verifies the existing file gate only. No AI claim.
    await store.writeFile('player/tonight-letter.md', '---\ntype: letter\ntitle: テスト専用の手紙\n---\nこれは自動テストの fixture です。');
    assert.equal((await post('/enter-layer', { layer: ending })).status, 200);
    const beforeExplore = calls.length;
    assert.equal((await post('/choice', { path: `${ending}/01-before-snow.md`, choice: 2 })).status, 200);
    assert.equal(calls.length, beforeExplore + 1);
    assert.match(calls.at(-1), /雪宿り/);
    assert.equal(await store.statKind(`${ending}/snow-shelter/README.md`), 'missing',
      'dispatching a request must not fabricate a generated scene');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    bridge.close();
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
