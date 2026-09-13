import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { experiences } from './experiences/index.mjs';
import { installExperience } from './install-experiences.mjs';
import { md } from './experiences/common.mjs';
import { LocalWorldStore, parseFrontmatter, createActionService } from '../packages/shared/dist/index.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
const express = require('express');
const repo = fileURLToPath(new URL('../', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-six-world-tests-'));
const installed = new Map();
const read = (root, file) => fs.readFile(path.join(root, file), 'utf8');

for (const pack of experiences) {
  await test(`${pack.base}: install, parse, scan localized layers and assets`, async () => {
    const result = await installExperience(repo, pack, { outputRoot: tmp });
    installed.set(pack.base, result.path);
    const store = new LocalWorldStore(result.path);
    try {
      const manifest = await store.getManifest();
      assert.equal(manifest.locale, pack.locale);
      assert.equal(manifest.entry, 'map');
      for (const scene of pack.scenes) {
        const id = scene === 'world' ? 'map' : scene;
        assert.ok(manifest.layers[id], id);
        if (scene !== 'world') assert.ok(manifest.layers[id].parent);
      }
      for (const [file, text] of Object.entries(pack.files)) {
        if (!file.endsWith('.md')) continue;
        const parsed = parseFrontmatter(text);
        assert.deepEqual(parsed.errors, [], file);
        if (pack.locale === 'ja') {
          assert.match(file, /^[a-zA-Z0-9/_.-]+$/, file);
          assert.match(parsed.body, /[\p{Script=Hiragana}\p{Script=Katakana}]/u, file);
        } else assert.doesNotMatch(parsed.body, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
        assert.equal(parsed.frontmatter?.roll_dice, undefined, 'No roll available before preparation and consent');
        assert.notEqual(parsed.frontmatter?.choice?.mode, 'multi');
        for (const key of ['bg', 'image', 'avatar', 'bgVideo']) if (parsed.frontmatter?.[key]) await fs.access(path.join(result.path, parsed.frontmatter[key]));
      }
      for (const c of manifest.characters) {
        assert.ok(manifest.layers[c.home], c.id);
        const preset = JSON.parse(await read(result.path, `characters/${c.id}/preset.json`));
        assert.ok(preset.items.every(i => ['block', 'slot'].includes(i.kind)));
        for (const item of preset.items.filter(i => i.slot === 'file')) for (const file of item.options.path) await fs.access(path.join(result.path, item.options.baseDir, file));
        const common = JSON.parse(await read(repo, 'presets/character.json'));
        assert.deepEqual(preset.hiddenOverrides, common.hiddenOverrides);
      }
      assert.equal((await fs.readdir(path.join(result.path, 'player'))).length, 0, 'No pre-issued endings or player-authored conclusions');
      await assert.rejects(() => installExperience(repo, pack, { outputRoot: tmp }), /Refusing to overwrite/);
    } finally { store.close(); }
  });
}

await test('time is the primary view, and places belong to each time', async () => {
  const store = new LocalWorldStore(installed.get('divergence'));
  try {
    const { layers } = await store.getManifest();
    for (const time of ['1994', 'tonight', 'thirty-years-later']) {
      assert.equal(layers[`world/time-map/${time}`].parent, 'world/time-map');
      assert.equal(layers[`world/time-map/${time}/tokiwa-electronics`].parent, `world/time-map/${time}`);
    }
  } finally { store.close(); }
});

await test('real HTTP gate: neither, badge only, commission only, both; stable-ID moves', async () => {
  const store = new LocalWorldStore(installed.get('wuwu'));
  const app = express(); app.use(express.json());
  const dispatches = [];
  const lifecycle = { submitWriter: async (...args) => dispatches.push(args) };
  app.use('/api', createWorldRouter(repo, lifecycle, { broadcast() {} }, () => store, () => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}/api/enter-layer`;
  const enter = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layer: 'world/harbor-chart' }) });
  const action = createActionService(store, { type: 'player' });
  try {
    assert.equal((await enter()).status, 409);
    await action.moveEntity({ from: 'world/investigator-badge.md', to: 'player/investigator-badge.md' });
    let response = await enter(); assert.equal(response.status, 409); assert.deepEqual((await response.json()).missing, ['player/commission-letter.md']);
    await action.moveEntity({ from: 'player/investigator-badge.md', to: 'world/investigator-badge.md' });
    await action.moveEntity({ from: 'world/commission-letter.md', to: 'player/commission-letter.md' });
    response = await enter(); assert.equal(response.status, 409); assert.deepEqual((await response.json()).missing, ['player/investigator-badge.md']);
    await action.moveEntity({ from: 'world/investigator-badge.md', to: 'player/investigator-badge.md' });
    assert.equal((await enter()).status, 200);
    assert.equal(dispatches.length, 0, 'An authored map should not dispatch stub generation');
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

await test('candidate 2d6 probabilities cover all 36 outcomes; native roll cannot repeat', async () => {
  const counts = [0, 0, 0, 0];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { const n = a + b; counts[n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : 3]++; }
  assert.deepEqual(counts, [3, 12, 18, 3]);
  const store = new LocalWorldStore(installed.get('wuwu'));
  try {
    // Deliberate test fixture, not a generated or player-earned check.
    await store.writeFile('world/test-roll.md', md({ type: 'chalk', title: '試験', roll_dice: { type: '2d6', expect: '>=7', desc: '試験用の不確実な投光' } }, 'これは離線試験。'));
    const player = createActionService(store, { type: 'player' });
    await assert.rejects(() => player.rollDice({ path: 'world/test-roll.md', forcedResult: 12 }));
    const outcome = await player.rollDice({ path: 'world/test-roll.md' });
    assert.ok(outcome.details.result >= 2 && outcome.details.result <= 12);
    assert.equal(outcome.details.passed, outcome.details.result >= 7);
    await assert.rejects(() => player.rollDice({ path: 'world/test-roll.md' }), /already/);
  } finally { store.close(); }
});

await test('six specific payoff and repair contracts are shipped, not pre-generated outcomes', async () => {
  const body = base => Object.values(experiences.find(p => p.base === base).files).join('\n');
  assert.match(body('whitechapel'), /player\/deduction.md/);
  assert.match(body('whitechapel'), /player\/operation-plan.md/);
  assert.match(body('whitechapel'), /提出だけで実行しない/);
  assert.match(body('divergence'), /before-transmission.md/);
  assert.match(body('first-snow-jp'), /最後に player\/tonight-letter.md/);
  assert.match(body('first-snow-jp'), /既訪問場面/);
  assert.match(body('magic-academy'), /天文台へは入れない/);
  assert.match(body('unwritten-door'), /even when README already exists/);
  const store = new LocalWorldStore(installed.get('unwritten-door'));
  try { assert.equal((await store.getManifest()).layers['world/outside'].stub, true); } finally { store.close(); }
});
console.log(`Isolated fixtures retained: ${tmp}`);
