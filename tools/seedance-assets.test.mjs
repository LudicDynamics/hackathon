import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mediaWorlds } from './sync-seedance.mjs';

test('mapped templates ship intact clips and transparent still fallbacks', async () => {
  const sources = new Set();
  for (const [id, config] of Object.entries(mediaWorlds)) {
    const root = path.resolve('templates', id);
    const inventory = JSON.parse(await fs.readFile(path.join(root, 'assets/motion/seedance/manifest.json')));
    assert.equal(inventory.assets.length, Object.keys(config.scenes).length + Object.keys(config.characters).length);
    for (const asset of inventory.assets) {
      const bytes = await fs.readFile(path.join(root, asset.target));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      sources.add(asset.source);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'world.json')));
    for (const aliases of Object.values(config.characters)) {
      const character = manifest.characters.find(c => aliases.includes(c.id));
      assert.ok(character, `${id}: missing mapped character`);
      assert.match(character.avatarVideo, /-transparent\.webm$/);
      assert.match(character.avatar, /-transparent\.webp$/);
      assert.ok((await fs.stat(path.join(root, character.avatar))).size < 300_000);
    }
  }
  assert.equal(sources.size, 31);
});
