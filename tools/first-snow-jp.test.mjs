import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { LocalWorldStore, parseFrontmatter, WorldManifestSchema } from '../packages/shared/dist/index.js';

const root = fileURLToPath(new URL('../templates/first-snow-jp/', import.meta.url));
const legacy = fileURLToPath(new URL('../templates/firstsnow/', import.meta.url));
const japanese = /[ぁ-ゖァ-ヺ]/u;
async function files(dir, prefix = '') {
  const result = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.posix.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await files(path.join(dir, item.name), p));
    else result.push(p);
  }
  return result;
}
const read = (p) => fs.readFile(path.join(root, p), 'utf8');

test('Japanese manifest preserves stable IDs and localized display names', async () => {
  const raw = JSON.parse(await read('world.json'));
  const m = WorldManifestSchema.parse(raw);
  assert.equal(m.id, 'first-snow-jp');
  assert.equal(m.locale, 'ja');
  assert.equal(m.name, '初雪ラジオ');
  assert.deepEqual(m.characters.map(c => c.name), ['七海', '雪村澄']);
  assert.equal('layers' in raw, false);
  for (const p of [m.cover, m.player.avatar, ...m.characters.map(c => c.avatar)]) await fs.access(path.join(root, p));
});

test('all authored Markdown is Japanese, including choices and visible labels', async () => {
  const docs = (await files(root)).filter(p => p.endsWith('.md'));
  assert.ok(docs.length >= 37);
  for (const p of docs) {
    const text = await read(p);
    const { frontmatter: fm, body } = parseFrontmatter(text);
    assert.ok(japanese.test(body), p);
    for (const key of ['title', 'preview', 'sign', 'blocked']) {
      if (fm?.[key]) assert.ok(japanese.test(fm[key]) || /[七海澄雪]/u.test(fm[key]), p + ':' + key);
    }
    if (Array.isArray(fm?.choice)) for (const choice of fm.choice) assert.ok(japanese.test(choice), p);
    assert.doesNotMatch(text, /First Snow Radio|Voice and boundaries|Persistent memory|No shared experience/);
  }
});

test('arrival choices and result gate use real world documents, not a pre-issued ending', async () => {
  const main = parseFrontmatter(await read('world/tonight/README.md')).frontmatter;
  const ending = parseFrontmatter(await read('world/tonight/first-snow/README.md')).frontmatter;
  assert.deepEqual(main.requires.items, ['player/request-sheet.md']);
  assert.deepEqual(ending.requires.items, ['player/tonight-letter.md']);
  assert.ok(japanese.test(ending.blocked));
  assert.equal((await files(root)).includes('player/tonight-letter.md'), false);
  for (const scene of ['radio-studio', 'amber-cafe']) {
    const fm = parseFrontmatter(await read(`world/tonight/${scene}/README.md`)).frontmatter;
    assert.equal(fm.choice.length, 2);
    assert.match(fm.choice[0], /一緒/);
  }
  assert.doesNotMatch(await read('world/tonight/campus-rooftop/01-city-lights.md'), /ポケットの中で/);
});

test('optional growth is player-led and writes playable text before a single image', async () => {
  const skill = await read('skills/first-snow-jp-continuity/SKILL.md');
  const growth = skill.slice(skill.indexOf('## 任意の一〜二分'));
  assert.match(growth, /頼まれたときだけ/);
  assert.match(growth, /resident\.md/);
  assert.match(growth, /arrival\.md/);
  assert.match(growth, /generate_image を一度だけ/);
  assert.match(growth, /文字が揃ってから/);
  assert.match(growth, /未登録の characterId/);
  assert.match(growth, /自動再試行しない/);
  assert.equal((await files(root)).some(p => p.includes('snow-shelter/')), false);
});

test('original graphics and approved motion posters are reused without runtime files', async () => {
  const all = await files(root);
  assert.ok(all.every(p => !p.split('/').some(part => ['.pi', '.airpworld'].includes(part))));
  const images = all.filter(p => p.endsWith('.webp') && !p.startsWith('assets/motion/'));
  // The Japanese entry reuses firstsnow's graphics byte-for-byte. The durable
  // contract is SUBSET identity: every image jp ships must exist in firstsnow
  // with identical bytes. jp deliberately carries no extra images, but it need
  // not mirror firstsnow's legacy leftovers (e.g. the old `sumi.webp`), so a
  // raw count equality would be wrong.
  const hash = b => createHash('sha256').update(b).digest('hex');
  for (const p of images) assert.equal(hash(await fs.readFile(path.join(root, p))), hash(await fs.readFile(path.join(legacy, p))), p);
  for (const p of all.filter(p => p.startsWith('assets/motion/seedance/') && /\.(webm|webp)$/.test(p))) {
    assert.equal(hash(await fs.readFile(path.join(root, p))), hash(await fs.readFile(path.join(legacy, p))), p);
  }
  for (const p of all.filter(p => p.endsWith('README.md'))) {
    const { frontmatter: fm } = parseFrontmatter(await read(p));
    if (fm?.bg) await fs.access(path.join(root, fm.bg));
  }
});

test('each character preset reads Japanese language and existing profile files', async () => {
  for (const id of ['nanami', 'sumi-yukimura']) {
    const preset = JSON.parse(await read('characters/' + id + '/preset.json'));
    assert.equal(preset.schemaVersion, 1);
    assert.equal('system' in preset, false);
    assert.ok(preset.items.some(i => i.slot === 'system-char'));
    assert.ok(preset.items.some(i => i.id === 'world-language' && i.options.path === 'language.md'));
    for (const item of preset.items.filter(i => i.slot === 'file')) {
      const base = item.options.baseDir === 'cwd' ? '' : item.options.baseDir;
      for (const p of [item.options.path].flat()) {
        assert.ok(japanese.test(await read(path.join(base, p))));
      }
    }
  }
});

test('root introduction precedes the relationship view and four nested places', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'first-snow-jp-test-'));
  let store;
  try {
    await fs.cp(root, temp, { recursive: true });
    store = new LocalWorldStore(temp);
    const manifest = await store.getManifest();
    assert.equal(manifest.layers['world/tonight'].parent, 'map');
    for (const id of ['radio-studio', 'amber-cafe', 'campus-rooftop', 'first-snow']) {
      assert.equal(manifest.layers['world/tonight/' + id].parent, 'world/tonight');
    }
    assert.equal(Object.keys(manifest.layers).length, 6);
    for (const c of manifest.characters) assert.ok(manifest.layers[c.home]);
  } finally {
    store?.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
