// Historical fixtures; current bilingual coverage is in world-editions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseFrontmatter } from '../packages/shared/dist/index.js';
test('cabin props and animated scenes reference shipped files with static fallbacks', async () => {
  for (const [world, files] of [
    ['unwritten-door', ['world/README.md', 'world/letter.md', 'world/phone.md', 'world/door.md']],
    ['firstsnow', ['world/README.md', 'world/winter-schedule/README.md']],
    ['first-snow-jp', ['world/README.md', 'world/tonight/README.md']],
  ]) {
    for (const file of files) {
      const { frontmatter: fm } = parseFrontmatter(await fs.readFile(`archive/templates/pre-bilingual-2026-09-14/${world}/${file}`, 'utf8'));
      assert.ok(fm.bg || fm.image);
      for (const ref of [fm.bg, fm.image, fm.bgVideo].filter(Boolean)) assert.ok((await fs.stat(`archive/templates/pre-bilingual-2026-09-14/${world}/${ref}`)).size > 1000);
      if (world !== 'unwritten-door') { assert.match(fm.bgVideo, /\.(webm|mp4)$/); assert.match(fm.bg, /\.webp$/); }
    }
  }
});
