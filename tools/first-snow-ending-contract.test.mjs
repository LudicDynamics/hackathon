// Historical fixture contract; current bilingual coverage is in world-editions.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiences } from './experiences/index.mjs';
import { parseFrontmatter } from '../packages/shared/dist/index.js';

const pack = experiences.find(p => p.base === 'first-snow-jp');
const skill = pack.files['skills/first-snow-jp-playtest-play/SKILL.md'];
const closing = 'world/tonight-promises/first-snow';

test('both fallback choices remain available on the scene README and Chalk', () => {
  for (const name of ['README.md', '01-opening.md']) {
    const { frontmatter, errors } = parseFrontmatter(pack.files[`${closing}/${name}`]);
    assert.deepEqual(errors, []);
    assert.deepEqual(frontmatter.choice, ['七海との今夜を結ぶ', '澄との今夜を結ぶ', 'まだ話したいことがある']);
    assert.match(frontmatter.intent, /第三以降の結末/);
  }
});

test('zero interaction keeps guidance and a real-record gate, not a pre-issued ending', () => {
  const gate = parseFrontmatter(pack.files[`${closing}/README.md`]).frontmatter;
  assert.deepEqual(gate.requires.items, ['player/tonight-letter.md']);
  assert.match(gate.blocked, /七海[\s\S]*澄/);
  assert.match(skill, /読むだけ・通り過ぎるだけなら player\/tonight-letter.md を発行しない/);
  assert.ok(!Object.keys(pack.files).some(p => /tonight-letter.md|epilogue.md|absence-trace.md/.test(p)));
});

test('a first promise records experience without locking out the second person', () => {
  assert.match(skill, /既に手紙があっても次の相手との RP を処理する/);
  assert.match(skill, /両方と約束しても、もう片方の道を閉じない/);
  assert.match(skill, /質問への返事も有効な交流/);
  assert.match(skill, /毎回もう一人の欠席物を強制生成しない/);
  assert.doesNotMatch(skill, /七海を選べばカフェの椅子と冷めたカップ/);
  for (const place of ['radio-studio', 'amber-cafe']) {
    for (const name of ['README.md', '01-opening.md']) {
      const fm = parseFrontmatter(pack.files[`world/tonight-promises/${place}/${name}`]).frontmatter;
      assert.match(fm.intent, /結末の自動確定にしない/);
    }
  }
});

test('additional outcomes follow actual RP, not an automatic third route or fixed punishment', () => {
  assert.match(skill, /単純な流れは上の二つの fallback/);
  assert.match(skill, /第三の固定ルートをあらかじめ作らず/);
  assert.match(skill, /二人に会っただけで必ず特殊結末にしない/);
  assert.match(skill, /fallback を選んでも他方の約束や反応を消してはいけない/);
  assert.match(skill, /二人に約束したら必ず罰されるとも決めない/);
  assert.match(skill, /片方の約束を告げていない相手に全てを知らせない/);
});

test('the short ending is written on closure, CG follows the facts and revisits reuse it', () => {
  assert.match(skill, /三〜六文の短い結末/);
  assert.match(skill, /ここが結末本体/);
  assert.match(skill, /テンプレートに結末の台詞や完成稿を用意しない/);
  assert.match(skill, /CG は結末の数や相手を決める表ではない/);
  assert.match(skill, /既に complete なら同じ結末を読み/);
  assert.match(skill, /手紙の存在だけを完結判定に使わない/);
  assert.ok(Object.keys(pack.files).every(file => /^[a-zA-Z0-9/_.-]+$/.test(file)));
});
