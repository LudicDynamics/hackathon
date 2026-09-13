// Historical fixtures; current bilingual coverage is in world-editions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { experiences } from './experiences/index.mjs';
import { installExperience } from './install-experiences.mjs';
import { parseFrontmatter } from '../packages/shared/dist/index.js';
import { divergenceMedia } from './experiences/divergence-media.mjs';

test('published and freshly compiled divergence media match provenance and do not reveal the ending', async () => {
  const pack = experiences.find(p => p.base === 'divergence');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-divergence-media-'));
  const result = await installExperience(process.cwd(), pack, { outputRoot: tmp });
  for (const root of ['archive/templates/pre-bilingual-2026-09-14/divergence', 'archive/templates/pre-bilingual-2026-09-14/divergence-playtest', result.path]) {
    for (const asset of divergenceMedia.assets) {
      const bytes = await fs.readFile(path.join(root, asset.target));
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    }
  }
  for (const root of ['archive/templates/pre-bilingual-2026-09-14/divergence-playtest', result.path]) {
    const read = f => fs.readFile(path.join(root, f), 'utf8');
    const fm = async f => parseFrontmatter(await read(f)).frontmatter;
    assert.deepEqual(JSON.parse(await read('assets/three-times-media.json')), divergenceMedia);
    const intro = await fm('world/README.md');
    assert.equal(intro.bg, 'assets/scenes/intro.webp');
    assert.equal(intro.bgVideo, 'assets/motion/seedance/backgrounds/intro.webm');
    assert.equal((await fm('world/time-map/1994/tokiwa-electronics/README.md')).bg, 'assets/scenes/shop-daylight.webp');
    for (const layer of ['world/time-map/thirty-years-later', 'world/time-map/thirty-years-later/tokiwa-electronics']) {
      const scene = await fm(`${layer}/README.md`);
      assert.equal(scene.bg, 'assets/scenes/future-original.webp');
      assert.equal(scene.bgVideo, undefined, 'Old indoor video must not cover the new exterior');
    }
    await assert.rejects(read('world/time-map/thirty-years-later/tokiwa-electronics/adult-ryo.md'), { code: 'ENOENT' });
    const rules = await read('skills/divergence-playtest-play/SKILL.md');
    for (const ref of ['assets/scenes/future-restored.webp', 'assets/scenes/tonight.webp', 'image: assets/characters/ryo-adult.webp']) assert.ok(rules.includes(ref));
    assert.match(rules, /成功時だけ時間階層/);
    assert.doesNotMatch(rules, /文字 Mock|後から制作/);
  }
});
