import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { editionFamilies, editionId } from './world-editions.mjs';
import { checkEditions } from './check-world-editions.mjs';
import { filesUnder, protect, restore } from './localize-world-editions.mjs';
import { LocalWorldStore, parseFrontmatter } from '../packages/shared/dist/index.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
import { readWorldShelf } from '../apps/server/dist/world-shelf.js';
const repo = process.cwd();
const staged = process.env.AIRP_TEST_STAGED_EDITIONS === '1';
const templates = path.join(repo, staged ? '.artifacts/bilingual-worlds/editions' : 'templates');

test('fourteen editions preserve every file, executable field, character profile and asset', async () => { await checkEditions({ staged }); });
test('translation guards reject changed or missing paths and dice numbers', () => {
  const text = 'Read world/test/README.md and roll 2d10, >=11.';
  const p = protect(text); assert.equal(restore(p.masked, p.literals), text);
  assert.throws(() => restore(p.masked.replace('⟪0⟫', ''), p.literals), /protected/);
  assert.throws(() => restore(p.masked + '⟪0⟫', p.literals), /protected/);
});
test('the world shelf exposes only paired canonical templates', async () => {
  if (staged) return;
  const shelf = await readWorldShelf(repo);
  assert.deepEqual(shelf.templates.sort(), editionFamilies.flatMap(f => ['en', 'ja'].map(l => editionId(f, l))).sort());
});

test('fresh English and Japanese saves resolve the same layers and direct choices without calling an Agent', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-edition-test-'));
  const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
  for (const family of editionFamilies) {
    let englishLayers;
    for (const locale of ['en', 'ja']) {
      const id = editionId(family, locale), root = path.join(tmp, id);
      await fs.cp(path.join(templates, id), root, { recursive: true, filter: f => !['assets', '.airpworld', '.pi'].includes(path.basename(f)) });
      const store = new LocalWorldStore(root);
      let dispatches = 0;
      const lifecycle = new Proxy({}, { get: () => () => { dispatches++; throw new Error('Unexpected model call'); } });
      const app = require('express')(); app.use(require('express').json());
      app.use('/api', createWorldRouter(repo, lifecycle, { broadcast() {} }, () => store, () => {}));
      const server = app.listen(0, '127.0.0.1');
      await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      const post = async (route, body) => {
        const r = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        return { status: r.status, body: await r.json() };
      };
      try {
        const manifest = await store.getManifest();
        const layers = Object.keys(manifest.layers).sort();
        if (locale === 'en') englishLayers = layers; else assert.deepEqual(layers, englishLayers, `${id}: identical scene topology`);
        assert.ok(manifest.layers[manifest.entry]);
        for (const c of manifest.characters) assert.ok(manifest.layers[c.home], c.id);
        if (family.base === 'wuwu') assert.equal((await post('enter-layer', { layer: 'world/harbor-chart' })).status, 409);
        let choices = 0;
        for (const file of (await filesUnder(path.join(templates, id))).filter(f => f.startsWith('world/') && f.endsWith('.md') && !f.endsWith('/README.md'))) {
          const p = parseFrontmatter(await fs.readFile(path.join(templates, id, file), 'utf8'));
          for (const option of p.interactive.choice?.options ?? []) {
            const action = p.frontmatter.choice_actions?.[option.id];
            if (!action) continue;
            const result = await post('choice', { path: file, choice: option.label });
            assert.equal(result.status, 200, `${id}/${file}: ${JSON.stringify(result.body)}`);
            assert.equal(result.body.action.kind, action.kind); choices++;
          }
        }
        if (family.base !== 'moonlit-contract') assert.ok(choices > 0);
        if (family.base === 'wuwu') assert.equal((await post('enter-layer', { layer: 'world/harbor-chart' })).status, 200);
        assert.equal(dispatches, 0, `${id}: direct choices must not start an Agent`);
        console.log(`Playable ${id}: ${layers.length} layers, ${choices} declared choices`);
      } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
    }
  }
});
