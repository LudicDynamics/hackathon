// Historical fixtures; current bilingual coverage is in world-editions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { experiences } from './experiences/index.mjs';
import { installExperience } from './install-experiences.mjs';
import { LocalWorldStore, initializeMissingCharacterPresence, parseFrontmatter } from '../packages/shared/dist/index.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
import { HOLMES_SUBMISSION_INTENT, HOLMES_RESOLUTION_RULES } from './experiences/holmes-resolution.mjs';
const pack = experiences.find(p => p.base === 'whitechapel');
const root = 'archive/templates/pre-bilingual-2026-09-14/whitechapel-playtest';
const map = 'world/london-map';
const expectedHomes = {
  watson: map, edith: `${map}/edith-room`, tom: `${map}/print-shop`,
  blackburn: `${map}/print-shop/editor-office`, wayne: `${map}/print-shop/illustration-room`,
};

test('submission always requests visible feedback and offers execution without a hidden correct-answer gate', async () => {
  const source = `${map}/02-deduction-and-plan.md`;
  const board = parseFrontmatter(await fs.readFile(`${root}/${source}`, 'utf8'));
  assert.equal(board.frontmatter.intent, HOLMES_SUBMISSION_INTENT);
  for (const phrase of ['読むだけ・不足という本文だけで終えない', 'この計画を実行する', '計画を直す']) assert.ok(HOLMES_SUBMISSION_INTENT.includes(phrase), phrase);
  for (const phrase of ['二文書目を書いた回合', '提出だけで実行しない', '再確認をループしない', '隠れた正解ゲートにしない', 'Operation aborted は物語上の不正解ではない']) assert.ok(HOLMES_RESOLUTION_RULES.includes(phrase), phrase);
  const shipped = await fs.readFile(`${root}/skills/whitechapel-playtest-play/SKILL.md`, 'utf8');
  assert.ok(shipped.includes(HOLMES_RESOLUTION_RULES));
});

test('wrong, impossible, partial and successful attempts have authored consequences, source clues and a reachable return', () => {
  for (const phrase of ['疑われた人が、次の手掛かりを差し出す', '待ち合わせではなかった住所', '守れたもの、逃したもの', '四枚目にいなかった人', '仮題', '題名や最終文章は現場で書く']) assert.ok(HOLMES_RESOLUTION_RULES.includes(phrase), phrase);
  for (const phrase of ['人物の拒否は拒否として演じる', '不在の人物を勝手に登場させない', '別の真犯人や万能な新アリバイは作らない', '出典を実在する安定パス', '二重に与えない']) assert.ok(HOLMES_RESOLUTION_RULES.includes(phrase), phrase);
  for (const phrase of ['01-outcome.md（type: note）', 'Chalk は現在地の一枚だけ', 'case-result-gate.md', '帰路や閲覧を player/case-receipt.md でロックしない', 'この手掛かりを調べる', '計画を練り直す', 'ここで一幕を終える', 'beyond-the-fourth-02/', '過去の正午を巻き戻さない']) assert.ok(HOLMES_RESOLUTION_RULES.includes(phrase), phrase);
  assert.ok(!Object.keys(pack.files).some(f => f.includes('/beyond-the-fourth/')), 'Endings must not be prewritten into a fresh world');
});

test('clear opening motive, distributed evidence and no public culprit declaration', async () => {
  for (const file of ['world/README.md', 'world/01-opening.md']) {
    const text = await fs.readFile(`${root}/${file}`, 'utf8');
    assert.match(text, /患者のイーディスは小説家/);
    assert.match(text, /三件続けて起きた/);
    assert.match(text, /今日の四件目を防ぐ/);
    assert.doesNotMatch(text, /犯人は.*ウェイン/);
  }
  for (const file of ['third-crime-scene/pigment-record.md', 'morgue/time-record.md', 'print-shop/receipt.md', 'print-shop/shift-ledger.md', 'print-shop/editor-office/correction-log.md', 'print-shop/illustration-room/visible-details.md', 'edith-room/address-correction.md', 'unnamed-street/meeting-options.md']) assert.ok(pack.files[`${map}/${file}`]);
  const rules = pack.files['skills/whitechapel-playtest-play/SKILL.md'];
  for (const phrase of ['犯人は挿絵画家ウェイン', '提出だけで実行しない', '抜けた一点だけ質問', '架空の住所の場所へ待ち伏せしない', 'player/deduction.md', 'player/operation-plan.md']) assert.ok(rules.includes(phrase));
  assert.doesNotMatch(pack.files[`${map}/02-deduction-and-plan.md`], /推論を書く|作戦計画を書く|二つの文章を提出する/);
});

test('all five NPCs retain profiles/media and are initialized as presence, not sprites', async () => {
  const manifest = JSON.parse(await fs.readFile(`${root}/world.json`, 'utf8'));
  assert.deepEqual(manifest.characters.map(c => c.id).sort(), Object.keys(expectedHomes).sort());
  for (const c of manifest.characters) {
    assert.equal(c.home, expectedHomes[c.id]);
    const fm = parseFrontmatter(await fs.readFile(`${root}/characters/${c.id}/README.md`, 'utf8')).frontmatter;
    assert.equal(fm.type, 'readme');
    assert.equal(fm.name, c.name);
    if (c.avatar) assert.equal(fm.avatar, c.avatar);
    await fs.access(`${root}/${c.avatar}`);
    const preset = JSON.parse(await fs.readFile(`${root}/characters/${c.id}/preset.json`, 'utf8'));
    assert.equal(preset.items.find(i => i.id === 'profile').options.baseDir, `characters/${c.id}`);
    if (c.id !== 'watson') assert.ok(preset.items.find(i => i.id === 'role-context')?.content);
    const intro = await fs.readFile(`${root}/characters/${c.id}/README.md`, 'utf8');
    assert.doesNotMatch(intro, /非公開演技指示|事件を起こしている/);
  }
  const wayne = JSON.parse(await fs.readFile(`${root}/characters/wayne/preset.json`, 'utf8'));
  assert.match(wayne.items.find(i => i.id === 'role-context').content, /あなたが挿絵の構図に合わせて事件を起こしている/);
  for (const key of ['identity', 'relationships', 'diary', 'unspoken', 'likes-and-fears', 'near-term', 'long-term']) assert.doesNotMatch(await fs.readFile(`${root}/characters/wayne/${key}.md`, 'utf8'), /非公開演技指示|犯人は|事件を起こしている/);
});

test('fresh compile and isolated layer API expose presence in their own rooms, not sprites', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-holmes-npcs-'));
  const result = await installExperience(process.cwd(), pack, { outputRoot: tmp });
  // The archive under `root` is a declared historical fixture (see
  // archive/templates/pre-bilingual-2026-09-14/README.md); the compiler has moved
  // on since (the Holmes investigation card migrated 2d10 → 1d100), so comparing
  // a fresh compile against that frozen snapshot is not a contract.
  const store = new LocalWorldStore(result.path);
  await initializeMissingCharacterPresence(store, { turn: 'init:holmes-test' });
  const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
  const app = require('express')();
  app.use('/api', createWorldRouter(process.cwd(), {}, { broadcast() {} }, () => store, () => {}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    for (const [id, home] of Object.entries(expectedHomes)) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/layer?layer=${encodeURIComponent(home)}`);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.items.some(i => i.frontmatter?.type === 'character'), false);
      const row = data.presence.find(p => p.characterId === id);
      assert.ok(row, `${id} must be initialized in its home layer`);
      assert.equal(typeof row.x, 'number');
      assert.equal(typeof row.y, 'number');
      assert.equal(row.following, false);
    }
    assert.equal((await store.getManifest()).layers[expectedHomes.wayne].parent, `${map}/print-shop`);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
