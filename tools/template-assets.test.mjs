// Historical fixtures; current bilingual coverage is in world-editions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mappings, jobsFor } from './sync-template-assets.mjs';

for (const [id, config] of Object.entries(mappings)) {
  test(`${id}: all source images are tracked and scene/character references resolve`, async () => {
    const root = new URL(`../archive/templates/pre-bilingual-2026-09-14/${id}/`, import.meta.url);
    const manifest = JSON.parse(await fs.readFile(new URL('world.json', root), 'utf8'));
    const inventory = JSON.parse(await fs.readFile(new URL('assets/source-manifest.json', root), 'utf8'));
    assert.equal(inventory.assets.length, jobsFor(config).length);
    for (const asset of inventory.assets) {
      const bytes = await fs.readFile(new URL(asset.target, root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.targetSha256);
    }
    for (const job of jobsFor(config)) {
      if (job.scene) assert.ok((await fs.readFile(new URL(`${job.scene}/README.md`, root), 'utf8')).includes(`bg: "${job.target}"`));
      if (job.character && manifest.characters.some(c => c.id === job.character)) {
        const character = manifest.characters.find(c => c.id === job.character);
        if (character.avatarVideo) {
          assert.match(character.avatar, /assets\/motion\/seedance\/characters\/.+-transparent\.webp$/);
          await fs.access(new URL(character.avatar, root));
          await fs.access(new URL(character.avatarVideo, root));
        } else assert.equal(character.avatar, job.target);
      }
    }
    assert.equal(manifest.player.id, config.player[0]);
    await fs.access(new URL(manifest.player.avatar, root));
  });
}
