import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('English First Snow has no Japanese authored text or character prompts', async () => {
  const root = 'templates/firstsnow';
  async function scan(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.(md|json)$/.test(file)) {
        assert.doesNotMatch(await fs.readFile(file, 'utf8'), /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, file);
      }
    }
  }
  await scan(root);
});

test('Japanese First Snow selects the full Canvas theme', async () => {
  const manifest = JSON.parse(await fs.readFile('templates/first-snow-jp/world.json', 'utf8'));
  assert.equal(manifest.audio.theme, 'canvas-firstsnow');
  assert.ok((await fs.stat('assets/audio/themes/canvas-firstsnow.mp3')).size > 100000);
});
