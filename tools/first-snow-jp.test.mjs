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
  assert.equal(docs.length, 35);
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

test('only the nine graphics are reused; no runtime or English asset docs are copied', async () => {
  const all = await files(root);
  assert.ok(all.every(p => !p.split('/').some(part => ['.pi', '.airpworld'].includes(part))));
  const images = all.filter(p => p.endsWith('.webp'));
  assert.equal(images.length, 9);
  const hash = b => createHash('sha256').update(b).digest('hex');
  for (const p of images) assert.equal(hash(await fs.readFile(path.join(root, p))), hash(await fs.readFile(path.join(legacy, p))), p);
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
