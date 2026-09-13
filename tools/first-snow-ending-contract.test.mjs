// Historical fixtures; current bilingual coverage is in world-editions.test.mjs.
// Content contracts only; live model compliance requires a separate rehearsal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { experiences } from './experiences/index.mjs';
import { parseFrontmatter } from '../packages/shared/dist/index.js';
import { LocalWorldStore } from '../packages/shared/dist/index.js';
import { isLayerEmpty, cardsOfLayer, childLayers } from '../packages/shared/dist/index.js';
import { md } from './experiences/common.mjs';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
const pack = experiences.find(p => p.base === 'first-snow-jp');
const skillPath = 'skills/first-snow-jp-playtest-play/SKILL.md';
const skill = pack.files[skillPath];
const closing = 'world/tonight-promises/first-snow';

test('real HTTP entry accepts an empty inventory without starting a writer', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airp-snow-closing-'));
  fs.copyFileSync(`archive/templates/pre-bilingual-2026-09-14/${pack.id}/world.json`, path.join(root, 'world.json'));
  for (const [file, text] of Object.entries(pack.files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  const store = new LocalWorldStore(root);
  const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
  const express = require('express');
  const app = express(); app.use(express.json());
  let calls = 0;
  app.use('/api', createWorldRouter(process.cwd(), { submitWriter: async () => { calls++; } }, { broadcast() {} }, () => store, () => {}));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/enter-layer`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layer: closing }),
    });
    assert.equal(res.status, 200, await res.text());
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(path.join(root, 'player/tonight-letter.md')), false);
  } finally {
    await new Promise(resolve => server.close(resolve)); store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('decision night is unlocked and does not offer preselected partner endings', () => {
  for (const name of ['README.md', '01-opening.md']) {
    for (const text of [pack.files[`${closing}/${name}`], fs.readFileSync(`archive/templates/pre-bilingual-2026-09-14/${pack.id}/${closing}/${name}`, 'utf8')]) {
      const { frontmatter, errors } = parseFrontmatter(text);
      assert.deepEqual(errors, []);
      assert.equal(frontmatter.requires, undefined);
      assert.deepEqual(frontmatter.choice, ['今夜を結ぶ', 'まだ話したいことがある']);
      assert.ok(frontmatter.intent.includes('入場だけでは結末を書かない'));
    }
  }
});
test('keepsakes require verified move and are not pre-issued or duplicated', () => {
  for (const id of ['nanami', 'sumi']) assert.ok(skill.includes(`player/${id}-keepsake.md`));
  for (const phrase of ['move(from, to)', '移動成功と宛先の実在', '無断で再発行・回収しない']) assert.ok(skill.includes(phrase));
  assert.ok(!Object.keys(pack.files).some(p => /keepsake\.md|epilogue\.md|after-story\//.test(p)));
});
test('four outcomes follow evidence; read failures never imply solitude', () => {
  for (const phrase of ['nanami', 'sumi', 'entangled', 'solitary', '信物は重要な証拠だが唯一の条件ではない', '記録の読み取りに失敗', '最後のクリックや持ち物の数だけでは決めない', '同じ夜を別ルートへ再抽選しない']) assert.ok(skill.includes(phrase), phrase);
});
test('one narration precedes image generation; failure preserves ending and manual retry', () => {
  for (const phrase of ['一段落、三〜六文、1000文字以内', 'generate_image を一回', '返された実在 asset', 'bgVideo を除く', '画像失敗だけで結末を無効にしない', '自動再試行', '01-opening.md はこの回合では編集しない']) assert.ok(skill.includes(phrase), phrase);
});
test('ending creates the README-only shell before CG; later play expands it', () => {
  for (const phrase of ['結末完成の回合に後日談の本文を続けて生成しない', 'world/tonight-promises/first-snow/after-story', 'この後日談を始める', '孤独ルートに未交流の恋人を足さない', '別名の場面を作らない']) assert.ok(skill.includes(phrase), phrase);
  for (const phrase of ['空殻に含めるファイルは README.md 一つだけ', '画像を待たずに', '独立した入口準備ボタンは要らない', '実際の約束・返事・履行', '信物の現所在と出典パス', 'epilogue.md の frontmatter を edit', '完了した結末をやり直さない', '現在地がこの子フォルダ', 'material: stub だけで I1 の自動生成が始まるとは説明しない']) assert.ok(skill.includes(phrase), phrase);
  const endingRules = skill.slice(skill.indexOf('## 決断の夜'));
  assert.ok(endingRules.indexOf('画像を待たずに') < endingRules.indexOf('generate_image を一回'));
  assert.ok(!skill.includes('「後日談の入口を用意する」が送信された時だけ'));
  assert.equal(fs.readFileSync(`archive/templates/pre-bilingual-2026-09-14/${pack.id}/${skillPath}`, 'utf8'), skill);
});

test('README-only shell is a visible child gate, not an automatically initialized empty layer', async () => {
  // A deterministic protocol fixture, not a claim that a live Writer authored it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airp-snow-shell-'));
  const child = `${closing}/after-story`;
  fs.copyFileSync(`archive/templates/pre-bilingual-2026-09-14/${pack.id}/world.json`, path.join(root, 'world.json'));
  for (const [file, text] of Object.entries(pack.files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  const store = new LocalWorldStore(root);
  try {
    await store.writeFile(`${child}/README.md`, md({
      type: 'gate', name: '後日談', title: '後日談', material: 'stub',
      bg: 'assets/scenes/first-snow.webp',
      intent: 'この子に入り「続ける」を送信したら親の結末を確認して一場面を生成する。',
    }, `この夜の続きは、まだ白紙。\n\n親：${closing}/README.md\n結末：${closing}/epilogue.md\n今夜の約束と信物の出典を引き継ぐ。`));
    assert.deepEqual(fs.readdirSync(path.join(root, child)), ['README.md']);
    const manifest = await store.getManifest();
    assert.equal(manifest.layers[child].parent, closing);
    assert.equal(manifest.layers[child].name, '後日談');
    const files = await store.listFiles(child);
    assert.equal(isLayerEmpty(files, child), false);
    assert.deepEqual(cardsOfLayer(child, files), [], 'No premature after-story Chalk or objects');
    assert.ok(childLayers(closing, manifest.layers).includes(child), 'Child doors are projected separately from ordinary cards');
  } finally { store.close(); }
});
