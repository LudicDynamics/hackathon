import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalWorldStore } from '../packages/shared/dist/store/local-store.js';

test('collecting an item cannot overwrite a same-name item already in the bag', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-move-test-'));
  const store = new LocalWorldStore(root);
  try {
    await fs.mkdir(path.join(root, 'world'));
    await fs.mkdir(path.join(root, 'player'));
    await fs.writeFile(path.join(root, 'world/key.md'), 'New key');
    await fs.writeFile(path.join(root, 'player/key.md'), 'Existing key');
    await assert.rejects(store.move('world/key.md', 'player/key.md'), { code: 'EEXIST' });
    assert.equal(await store.readFile('world/key.md'), 'New key');
    assert.equal(await store.readFile('player/key.md'), 'Existing key');
  } finally { store.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('hover controls float outside the entity and use a transparent container', async () => {
  const css = await fs.readFile(new URL('../apps/web/src/scene-shell.css', import.meta.url), 'utf8');
  assert.match(css, /entity-interactions \{ position: absolute; left: 100%;/);
  assert.match(css, /object:hover > \.entity-interactions/);
  assert.match(css, /entity-interactions \.fm-body \{[^}]*background: transparent/);
  const code = await fs.readFile(new URL('../apps/web/src/components/narrative/EntityInteractions.tsx', import.meta.url), 'utf8');
  assert.match(code, /runGatewayAction\s*(?:<[^>]+>)?\s*\(/);
  assert.doesNotMatch(code, /airpGateway\.(choose|move)\(/);
  assert.match(code, /setSide\(best.side\)/);
  assert.match(code, /side: 'below'/);
  assert.match(code, /candidate.side === placement/);
  assert.doesNotMatch(code, /observer.observe\(el\)/);
  assert.doesNotMatch(code, /addEventListener\('pointermove'/);
});

test('canvas uses the merged action and event contracts', async () => {
  const read = file => fs.readFile(new URL(`../apps/web/src/${file}`, import.meta.url), 'utf8');
  assert.match(await read('lib/airp-gateway.ts'), /choose:[\s\S]*\/api\/choice/);
  assert.match(await read('components/narrative/DiceRoller.tsx'), /path: filePath/);
  assert.match(await read('state/useWorld.ts'), /case 'world_event':/);
  const widgets = await read('lib/fm.tsx');
  assert.match(widgets, /visibleChoiceOptions\(interactive.choice\)/);
  assert.match(widgets, /choice.id \?\? choice.label/);
});
