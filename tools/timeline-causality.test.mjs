import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { experiences } from './experiences/index.mjs';
import { installExperience } from './install-experiences.mjs';
import { LocalWorldStore, createActionService, parseFrontmatter } from '../packages/shared/dist/index.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
const express = require('express');

const pack = experiences.find(p => p.base === 'divergence');
const scene = time => `world/time-map/${time}/tokiwa-electronics`;
const text = file => pack.files[file];
const rules = text('skills/divergence-playtest-play/SKILL.md');

test('same shop image, distinct dates, people and readable causal evidence', () => {
  const fm = file => parseFrontmatter(text(file)).frontmatter;
  assert.equal(fm(`${scene('1994')}/README.md`).bg, fm(`${scene('tonight')}/README.md`).bg);
  assert.match(text(`${scene('1994')}/collection-slip.md`), /一九九五年一月一日午前十時/);
  assert.match(text(`${scene('1994')}/route-note.md`), /八時半.*東橋/s);
  assert.match(text('world/accident-notice.md'), /午前九時.*転落/s);
  assert.match(text(`${scene('tonight')}/fax-machine.md`), /同じ日の午前八時/);
  assert.match(text(`${scene('thirty-years-later')}/shop-record.md`), /店を閉めた.*取り壊された/s);
  assert.doesNotMatch(Object.values(pack.files).join('\n'), /2011|二〇一一年|1994-11-02|new-present/);
});

test('prompt contract: draft is not sending; missing draft and failed intervention have exits', () => {
  assert.match(rules, /なければ即座に一枚の Chalk/);
  assert.match(rules, /確認・読む・道具を使うだけでは送らない/);
  assert.match(rules, /1995-01-01T08:00/);
  assert.match(rules, /1995-01-01T20:00/);
  assert.match(rules, /ＦＡＸは唯一の正解ではない/);
  assert.match(rules, /intervention.md/);
  assert.match(rules, /草稿を書き直す.*昨日の受け取りを相談する/s);
  assert.match(rules, /同じファイルの不足だけ補う/);
  assert.match(rules, /generate_image を呼ばず/);
  assert.match(rules, /adult-ryo.md/);
  assert.match(rules, /別場面の Chalk を同じ回合で edit しない/);
  assert.match(rules, /未登録 characterId や幼年立ち絵を使わない/);
  assert.match(rules, /救った代償として必ず店やＦＡＸを失わせる条件はない/);
});

test('isolated real store: frog unlocks exactly three time nodes, each with a place; no pre-issued ending', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-timeline-contract-'));
  const result = await installExperience(process.cwd(), pack, { outputRoot: tmp });
  const store = new LocalWorldStore(result.path);
  const app = express(); app.use(express.json());
  app.use('/api', createWorldRouter(process.cwd(), { submitWriter: async () => { throw new Error('Authored entry must not dispatch Writer'); } }, { broadcast() {} }, () => store, () => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const enter = layer => fetch(`http://127.0.0.1:${server.address().port}/api/enter-layer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layer }) });
  try {
    const player = createActionService(store, { type: 'player' });
    const blocked = await enter('world/time-map');
    assert.equal(blocked.status, 409);
    assert.deepEqual((await blocked.json()).missing, ['player/clockwork-frog.md']);
    await player.moveEntity({ from: 'world/clockwork-frog.md', to: 'player/clockwork-frog.md' });
    assert.equal((await enter('world/time-map')).status, 200);
    const { layers, characters } = await store.getManifest();
    assert.deepEqual(Object.entries(layers).filter(([, l]) => l.parent === 'world/time-map').map(([id]) => id).sort(),
      ['1994', 'thirty-years-later', 'tonight'].map(t => `world/time-map/${t}`));
    for (const time of ['1994', 'tonight', 'thirty-years-later']) {
      assert.equal(layers[scene(time)].parent, `world/time-map/${time}`);
      assert.equal((await enter(`world/time-map/${time}`)).status, 200);
      assert.equal((await enter(scene(time))).status, 200);
      assert.equal((await enter('world/time-map')).status, 200);
    }
    assert.equal(characters[0].home, scene('1994'));
    assert.match(characters[0].avatar, /ryo-transparent.webp$/, 'Reuse reviewed child art only for the child');
    assert.equal(characters[0].name, '幼いリョウ');
    for (const file of ['player/fax-draft.md', 'world/time-map/fax-receipt.md', `${scene('thirty-years-later')}/adult-ryo.md`]) {
      await assert.rejects(() => fs.access(path.join(result.path, file)), { code: 'ENOENT' });
    }
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
