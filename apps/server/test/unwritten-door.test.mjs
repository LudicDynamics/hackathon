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
import { AgentLifecycleManager } from '../dist/engine/lifecycle.js';

test('cabin choices dispatch to the writer and a single authored door opens a stub', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-cabin-test-'));
  await fs.cp(new URL('../../../templates/unwritten-door/', import.meta.url), root, { recursive: true });
  const store = new LocalWorldStore(root);
  const calls = [];
  const lifecycle = { submitWriter: async (world, prompt) => calls.push({ world, prompt }) };
  const app = express();
  app.use(express.json());
  app.use('/api', createWorldRouter(path.resolve('.'), lifecycle, new EventBridge(), () => store, () => {}));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (route, data) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    const page = await (await fetch(base + '/layer?layer=map')).json();
    assert.equal(page.items.filter(item => item.frontmatter?.type === 'gate' || item.filename === 'README.md').length, 1);
    assert.equal(page.items.length, 4);
    const chosen = await (await post('/choice', { path: 'world/letter.md', choice: 'Open the envelope' })).json();
    assert.equal(chosen.ok, true);
    assert.match(calls[0].prompt, /Open the envelope/);
    assert.match(calls[0].prompt, /world\/letter.md/);
    const entered = await (await post('/enter-layer', { layer: 'world/outside' })).json();
    assert.equal(entered.first, true);
    assert.match(calls[1].prompt, /Preserve all revealed context/);
    assert.equal((await post('/enter-layer', { layer: '../escape' })).status, 404);
    await store.writeFile('world/outside/README.md', '---\ntype: readme\nname: Fixed Outside\n---\nRain beyond the cabin.');
    await post('/enter-layer', { layer: 'world/outside' });
    assert.equal(calls.length, 2, 're-entry must not regenerate a written scene');
    assert.equal((await store.getEvents()).filter(event => event.type === 'choice_selected').length, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('writer queue completes prop updates before starting the door beat', async () => {
  const listeners = new Set();
  const trace = [];
  const manager = new AgentLifecycleManager({ repoRoot: '.', vendorCliPath: 'unused' });
  const client = {
    onEvent(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    async prompt(message) {
      trace.push(`start:${message}`);
      setTimeout(() => {
        trace.push(`write:${message}`);
        for (const handler of [...listeners]) handler({ type: 'agent_settled' });
      }, 5);
    },
  };
  manager.startWriter = async () => client;
  await Promise.all([manager.submitWriter('/demo', 'letter'), manager.submitWriter('/demo', 'door')]);
  assert.deepEqual(trace, ['start:letter', 'write:letter', 'start:door', 'write:door']);
});
