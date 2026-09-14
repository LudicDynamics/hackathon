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

test('doors record the entry; only the auto-write switch starts a turn', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-cabin-test-'));
  await fs.cp(new URL('../../../archive/templates/pre-bilingual-2026-09-14/unwritten-door/', import.meta.url), root, { recursive: true });
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

    // Default settings: `autoWrite` is absent ⟹ `off` (docs/settings/00). A choice
    // lands as an event and MUST NOT start a writer turn (docs/protocols/doc-21 §5.5).
    const chosen = await (await post('/choice', { path: 'world/letter.md', choice: 'Open the envelope' })).json();
    assert.equal(chosen.ok, true);
    assert.equal(calls.length, 0, 'off: a choice must not dispatch the writer');

    // Entering an unwritten door records `layer_entered` and reports `first`, but
    // scene materialisation is the I1 initialiser's job (fired client-side on
    // `first`), never a route-side writer turn (docs/init/03 §3.2).
    const entered = await (await post('/enter-layer', { layer: 'world/outside' })).json();
    assert.equal(entered.first, true);
    assert.equal(calls.length, 0, 'off: entering a stub must not dispatch the writer');
    assert.equal((await post('/enter-layer', { layer: '../escape' })).status, 404);

    // The same door, once written, is not `first` again.
    await store.writeFile('world/outside/README.md', '---\ntype: readme\nname: Fixed Outside\n---\nRain beyond the cabin.');
    const reentry = await (await post('/enter-layer', { layer: 'world/outside' })).json();
    assert.equal(reentry.first, false);

    assert.equal((await store.getEvents()).filter(event => event.type === 'choice_selected').length, 1);
    assert.equal((await store.getEvents()).filter(event => event.type === 'layer_entered').length, 2);

    // `scenes` turns the scene initialiser on but still leaves choices alone.
    await fs.writeFile(path.join(root, '.airpworld/settings.json'), '{"autoWrite":"scenes"}\n');
    await post('/enter-layer', { layer: 'map' });
    await post('/choice', { path: 'world/letter.md', choice: 'Open the envelope' });
    assert.equal(calls.length, 0, 'scenes: a choice must still not dispatch');

    // `scenes-and-choices` is the only state that dispatches a choice turn.
    await fs.writeFile(path.join(root, '.airpworld/settings.json'), '{"autoWrite":"scenes-and-choices"}\n');
    const gated = await (await post('/choice', { path: 'world/letter.md', choice: 'Open the envelope' })).json();
    assert.equal(gated.ok, true);
    assert.equal(calls.length, 1, 'scenes-and-choices: a choice dispatches the writer');
    assert.match(calls[0].prompt, /Open the envelope/);
    assert.match(calls[0].prompt, /world\/letter.md/);
    // Even then, entering a stub is the initialiser's job, not a route dispatch.
    await fs.mkdir(path.join(root, 'world/inside'), { recursive: true });
    await post('/enter-layer', { layer: 'world/inside' });
    assert.equal(calls.length, 1, 'the door never dispatches, whatever the switch');
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a second writer beat is refused while the previous one is still resolving', async () => {
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
  // docs/ux/03 §5.1: a busy writer refuses the next beat instead of queueing it,
  // so the door beat can never overtake an in-flight prop update.
  const first = manager.submitWriter('/demo', 'letter');
  await assert.rejects(manager.submitWriter('/demo', 'door'), /still resolving your previous action/);
  await first;
  assert.deepEqual(trace, ['start:letter', 'write:letter']);
});
