import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { experiences } from './experiences/index.mjs';
import { NOOK_FIELDS, characterNookFiles } from './experiences/character-nooks.mjs';
import { LocalWorldStore, parseFrontmatter, nookCardPaths } from '../packages/shared/dist/index.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';
const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
const express = require('express');
const repo = process.cwd();
const people = experiences.flatMap(pack => pack.characters.map(person => ({ pack, person })));

test('thirteen registered characters, seven distinct cards each; no invented Unwritten Door NPC', () => {
  assert.equal(people.length, 13);
  assert.equal(experiences.find(p => p.base === 'unwritten-door').characters.length, 0);
  const bodies = new Set();
  for (const { pack, person } of people) {
    const entries = characterNookFiles(pack.base, person);
    assert.equal(Object.keys(entries).length, 7);
    for (const [file, text] of Object.entries(entries)) {
      assert.match(file, /^[a-z]+(?:-[a-z]+)*\.md$/);
      const p = parseFrontmatter(text);
      assert.deepEqual(p.errors, []);
      assert.equal(p.frontmatter.portable, false);
      assert.ok(p.body.trim().length >= 45, `${person.id}/${file}`);
      assert.match(p.body, /[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      assert.equal(p.frontmatter.component, file === 'diary.md' ? 'diary' : undefined);
      assert.equal(pack.files[`characters/${person.id}/${file}`], text);
      assert.ok(!bodies.has(p.body), 'Do not use generic repeated filler');
      bodies.add(p.body);
    }
  }
  assert.equal(bodies.size, 91);
});

for (const { pack, person } of people) {
  test(`${pack.id}/${person.id}: shipped cards, relationship targets, profile and untouched memory`, async () => {
    const root = path.join(repo, 'templates', pack.id);
    const nook = `characters/${person.id}`;
    const preset = JSON.parse(await fs.readFile(path.join(root, nook, 'preset.json'), 'utf8'));
    const profile = preset.items.find(i => i.id === 'profile' && i.slot === 'file');
    assert.equal(profile.options.baseDir, nook);
    for (const [file, expected] of Object.entries(characterNookFiles(pack.base, person))) {
      assert.equal(await fs.readFile(path.join(root, nook, file), 'utf8'), expected);
      assert.ok(profile.options.path.includes(file));
      for (const match of expected.matchAll(/\]\((characters\/[^)]+)\)/g)) await fs.access(path.join(root, match[1]));
    }
    assert.equal(parseFrontmatter(await fs.readFile(path.join(root, nook, 'memory.md'), 'utf8')).body.trim(), 'このプレイで交わした新しい約束はまだない。知らない場面の秘密を加えない。');
    const paths = nookCardPaths((await fs.readdir(path.join(root, nook))).map(f => `${nook}/${f}`), nook);
    for (const [key] of NOOK_FIELDS) assert.ok(paths.includes(`${nook}/${key}.md`));
  });
}

test('spoiler boundaries: opening diary is not an already-played ending', () => {
  const all = (base, id) => Object.values(characterNookFiles(base, { id })).join('\n');
  assert.doesNotMatch(all('whitechapel', 'watson'), /ウェイン|犯人は/);
  assert.doesNotMatch(all('divergence', 'young-ryo'), /2024|2011|転落|亡くな|店主の娘/);
  assert.match(all('first-snow-jp', 'nanami'), /今夜も同じ気持ちかは、聞かなくては分からない/);
  assert.match(all('first-snow-jp', 'sumi-yukimura'), /返事の前に失約と決めない/);
});

test('real nook endpoint exposes all 91 cards on isolated saves without adding scene layers', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-nook-content-'));
  let visible = 0;
  for (const pack of experiences.filter(p => p.characters.length)) {
    const root = path.join(tmp, pack.id);
    await fs.cp(path.join(repo, 'templates', pack.id), root, { recursive: true,
      filter: file => !['assets', '.airpworld', '.pi'].includes(path.basename(file)) });
    const store = new LocalWorldStore(root);
    const app = express(); app.use(express.json());
    app.use('/api', createWorldRouter(repo, {}, { broadcast() {} }, () => store, () => {}));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
      for (const c of pack.characters) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/nook?character=${c.id}`);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.layer, `characters/${c.id}`);
        for (const [key] of NOOK_FIELDS) {
          const item = data.items.find(i => i.path === `characters/${c.id}/${key}.md`);
          assert.ok(item?.body.trim().length > 40, `${c.id}/${key}`);
          visible++;
        }
        assert.equal(await store.resolveLayer(`characters/${c.id}/identity.md`), null);
      }
    } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
  }
  assert.equal(visible, 91);
});
