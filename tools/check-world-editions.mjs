#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, WorldManifestSchema, LocalWorldStore } from '../packages/shared/dist/index.js';
import { editionFamilies, editionId, templateArchive } from './world-editions.mjs';
import { filesUnder, mapText } from './localize-world-editions.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async f => JSON.parse(await fs.readFile(f, 'utf8'));
const isText = f => /\.(md|json)$/.test(f) && !(f.startsWith('assets/') && f.endsWith('.json'));
const isCjk = s => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
const readDoc = async (root, f) => {
  const text = await fs.readFile(path.join(root, f), 'utf8');
  if (f.endsWith('.json')) return JSON.parse(text);
  const p = parseFrontmatter(text); assert.deepEqual(p.errors, [], `${root}/${f}`);
  return { fm: p.frontmatter ?? {}, body: p.body };
};
// Compare all executable data, ignoring only prose and edition metadata.
const structure = (f, input) => {
  const doc = mapText(structuredClone(input), () => '<localized>');
  if (f.endsWith('.md')) doc.body = '<localized>';
  if (f === 'world.json') { delete doc.id; delete doc.version; delete doc.locale; delete doc.tags; }
  if (f.endsWith('/preset.json')) delete doc.id;
  return doc;
};
async function media(root, value) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (['bg', 'bgVideo', 'avatar', 'avatarVideo', 'image', 'cover', 'video', 'poster'].includes(k) && typeof v === 'string' && v.startsWith('assets/')) {
      assert.ok(!v.includes('..'), v); await fs.access(path.join(root, v));
    } else if (typeof v === 'object') await media(root, v);
  }
}

export async function checkEditions({ staged = false } = {}) {
  const base = path.join(repo, staged ? '.artifacts/bilingual-worlds/editions' : 'templates');
  const sources = path.join(repo, staged ? '.artifacts/bilingual-worlds/sources' : templateArchive);
  const expectedIds = editionFamilies.flatMap(f => ['en', 'ja'].map(l => editionId(f, l))).sort();
  const actualIds = [];
  for (const d of await fs.readdir(base)) if (await fs.access(path.join(base, d, 'world.json')).then(() => true).catch(() => false)) actualIds.push(d);
  assert.deepEqual(actualIds.sort(), expectedIds, 'Exactly one English and one Japanese edition per family');
  const skills = new Set(); let files = 0; let dice = 0;
  const digest = {};
  for (const family of editionFamilies) {
    const source = path.join(sources, family.source); const sourceFiles = await filesUnder(source);
    for (const locale of ['en', 'ja']) {
      const id = editionId(family, locale), root = path.join(base, id);
      const targetFile = f => f.replace(/^(skills\/)([^/]+)(\/)/, (_, a, n, b) => a + n.replace(family.source, id) + b);
      assert.deepEqual((await filesUnder(root)).sort(), sourceFiles.map(targetFile).sort(), `${id}: no lost or extra content`);
      const manifest = WorldManifestSchema.parse(await json(path.join(root, 'world.json')));
      assert.equal(manifest.id, id); assert.equal(manifest.locale, locale);
      assert.doesNotMatch(manifest.name, /playtest|体験版/i);
      await media(root, manifest);
      for (const f of sourceFiles) {
        const target = targetFile(f), absolute = path.join(root, target);
        assert.match(target, /^[a-zA-Z0-9/_.-]+$/, `${id}: ASCII stable path`);
        digest[`${id}/${target}`] = sha(await fs.readFile(absolute)); files++;
        if (!isText(f)) { assert.equal(digest[`${id}/${target}`], sha(await fs.readFile(path.join(source, f))), `${id}/${f}: shared asset bytes`); continue; }
        const a = await readDoc(source, f), b = await readDoc(root, target);
        assert.deepEqual(structure(f, b), structure(f, a), `${id}/${f}: executable contract drift`);
        if (locale === 'en') mapText(b, text => { assert.ok(!isCjk(text), `${id}/${f}: untranslated text: ${text.slice(0, 70)}`); return text; });
        if (f.endsWith('.md')) {
          await media(root, b.fm);
          if (b.fm.roll_dice) { dice++; assert.ok(['1d10', '2d10', '1d100'].includes(b.fm.roll_dice.type), `${id}/${f}: supported dice`); }
          if (f.endsWith('/SKILL.md')) {
            assert.equal(b.fm.name, path.basename(path.dirname(target))); assert.ok(!skills.has(b.fm.name), `Duplicate skill ${b.fm.name}`); skills.add(b.fm.name);
            assert.ok(typeof b.fm.description === 'string' && b.fm.description.length > 0);
            if (locale === 'ja') assert.ok(isCjk(b.body), `${id}: Japanese world skill`);
          }
        }
      }
      for (const c of manifest.characters) {
        await fs.access(path.join(root, c.home, 'README.md'));
        for (const f of ['README.md', 'personality.md', 'memory.md', 'identity.md', 'relationships.md', 'diary.md', 'unspoken.md', 'likes-and-fears.md', 'near-term.md', 'long-term.md']) await fs.access(path.join(root, 'characters', c.id, f));
        const preset = await json(path.join(root, 'characters', c.id, 'preset.json'));
        const profile = preset.items.find(x => x.id === 'profile');
        assert.equal(profile.options.baseDir, `characters/${c.id}`);
        for (const f of profile.options.path) await fs.access(path.join(root, profile.options.baseDir, f));
        const language = preset.items.find(x => x.id === 'world-language').content;
        assert.ok(language.startsWith(locale === 'en' ? 'Speak English.' : '日本語で話す。'));
      }
      console.log(`OK ${id}: ${sourceFiles.length} files, ${manifest.characters.length} characters`);
    }
  }
  const result = { editions: expectedIds.length, files, dice, digest };
  if (staged) await fs.writeFile(path.join(repo, '.artifacts/bilingual-worlds/validated.json'), JSON.stringify(result, null, 2));
  console.log(`PASS: ${result.editions} editions; ${files} files; ${dice} dice cards; executable data and graphics preserved.`);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkEditions({ staged: process.argv.includes('--staged') });
