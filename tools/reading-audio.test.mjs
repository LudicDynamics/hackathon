import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('canvas sound mappings exist and suppress overlapping and late playback', async () => {
  const source = await fs.readFile('apps/web/src/lib/audio.ts', 'utf8');
  for (const name of ['card', 'get', 'dice', 'success', 'write', 'door', 'paper', 'bell']) {
    assert.ok((await fs.stat(`assets/audio/foley/canvas/se-${name}.mp3`)).size > 0);
  }
  assert.match(source, /foleyBusyUntil\.set\(name, performance\.now\(\) \+ Math\.max\(500, buf\.duration \* 1000\)\)/);
  assert.match(source, /performance\.now\(\) - now > 500/);
});
test('reader supports keyboard and ignores drag; save picker closes before loading', async () => {
  const object = await fs.readFile('apps/web/src/components/canvas/CanvasObject.tsx', 'utf8');
  assert.match(object, /event\.key === 'Enter'/);
  assert.match(object, /Math\.hypot/);
  const app = await fs.readFile('apps/web/src/App.tsx', 'utf8');
  const load = app.slice(app.indexOf('const loadWorld ='), app.indexOf('const submitWriter ='));
  assert.ok(load.indexOf('setWorldPickerOpen(false)') < load.indexOf('await airpGateway.loadWorld'));
});
