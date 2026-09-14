#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, WorldManifestSchema } from '../packages/shared/dist/index.js';
import { editionFamilies, editionId, editionLocales, isExperimentalWorld } from './world-editions.mjs';
import { filesUnder, mapText } from './localize-world-editions.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async f => JSON.parse(await fs.readFile(f, 'utf8'));
const isText = f => /\.(md|json)$/.test(f) && !(f.startsWith('assets/') && f.endsWith('.json'));
const isCjk = s => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
const isKana = s => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
/** Every character's `world-language` block opens with the edition's own language. */
const LANGUAGE_DIRECTIVE = { en: 'Speak English.', ja: '日本語で話す。', 'zh-CN': '说中文。' };
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

/** `only`: check just these family bases (a partial build); the full edition set is not asserted. */
export async function checkEditions({ staged = false, only = null } = {}) {
  const base = path.join(repo, staged ? '.artifacts/bilingual-worlds/editions' : 'templates');
  const sources = path.join(repo, staged ? '.artifacts/bilingual-worlds/sources' : 'templates');
  // The staged bilingual build predates the Chinese editions.
  const locales = staged ? ['en', 'ja'] : editionLocales;
  const families = only ? editionFamilies.filter(f => only.includes(f.base)) : editionFamilies;
  assert.equal(families.length, only?.length ?? editionFamilies.length, `Unknown family in --only=${only}`);
  const expectedIds = families.flatMap(f => locales.map(l => editionId(f, l))).sort();
  const actualIds = [];
  // Experimental sandboxes carry `exp: true` and are deliberately outside the
  // edition set: the whole point of templates/exp is that it is NOT a shipped
  // edition, so asserting `templates == 21` would only force its deletion.
  for (const d of await fs.readdir(base)) {
    if (!(await fs.access(path.join(base, d, 'world.json')).then(() => true).catch(() => false))) continue;
    if (isExperimentalWorld(base, d)) continue;
    actualIds.push(d);
  }
  if (only) for (const id of expectedIds) assert.ok(actualIds.includes(id), `Missing edition ${id}`);
  else assert.deepEqual(actualIds.sort(), expectedIds, `Exactly one edition per family and locale (${locales.join(', ')})`);
  const skills = new Set(); let files = 0; let dice = 0;
  const digest = {};
  for (const family of families) {
    // Published checks use the canonical English edition as the executable
    // contract. Staged builds still compare against their snapshotted source.
    const sourceId = staged ? family.source : editionId(family, 'en');
    const source = path.join(sources, staged ? family.source : sourceId);
    const sourceFiles = await filesUnder(source);
    // A world skill's directory follows its edition id: `<id>-play`.
    const targetFile = (f, locale) => f.startsWith('skills/') ? f.replace(/^skills\/[^/]+/, `skills/${editionId(family, locale)}-play`) : f;
    for (const locale of locales) {
      const id = editionId(family, locale), root = path.join(base, id);
      assert.deepEqual((await filesUnder(root)).sort(), sourceFiles.map(f => targetFile(f, locale)).sort(), `${id}: no lost or extra content`);
      const manifest = WorldManifestSchema.parse(await json(path.join(root, 'world.json')));
      assert.equal(manifest.id, id); assert.equal(manifest.locale, locale);
      assert.doesNotMatch(manifest.name, /playtest|体験版/i);
      await media(root, manifest);
      for (const f of sourceFiles) {
        const target = targetFile(f, locale), absolute = path.join(root, target);
        assert.match(target, /^[a-zA-Z0-9/_.-]+$/, `${id}: ASCII stable path`);
        digest[`${id}/${target}`] = sha(await fs.readFile(absolute)); files++;
        if (!isText(f)) { assert.equal(digest[`${id}/${target}`], sha(await fs.readFile(path.join(source, f))), `${id}/${f}: shared asset bytes`); continue; }
        const a = await readDoc(source, f), b = await readDoc(root, target);
        assert.deepEqual(structure(f, b), structure(f, a), `${id}/${f}: executable contract drift`);
        if (locale === 'en') mapText(b, text => { assert.ok(!isCjk(text), `${id}/${f}: untranslated text: ${text.slice(0, 70)}`); return text; });
        if (locale === 'zh-CN') mapText(b, text => { assert.ok(!isKana(text), `${id}/${f}: Japanese left in Chinese text: ${text.slice(0, 70)}`); return text; });
        if (f.endsWith('.md')) {
          await media(root, b.fm);
          if (b.fm.roll_dice) { dice++; assert.ok(['1d10', '2d10', '1d100'].includes(b.fm.roll_dice.type), `${id}/${f}: supported dice`); }
          if (f.endsWith('/SKILL.md')) {
            assert.equal(b.fm.name, path.basename(path.dirname(target))); assert.ok(!skills.has(b.fm.name), `Duplicate skill ${b.fm.name}`); skills.add(b.fm.name);
            assert.ok(typeof b.fm.description === 'string' && b.fm.description.length > 0);
            if (locale !== 'en') assert.ok(isCjk(b.body), `${id}: localized world skill`);
            if (locale === 'zh-CN') assert.ok(!isKana(b.body), `${id}: Chinese world skill`);
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
        assert.ok(language.startsWith(LANGUAGE_DIRECTIVE[locale]), `${id}/${c.id}: world-language opens with ${LANGUAGE_DIRECTIVE[locale]}`);
      }
      console.log(`OK ${id}: ${sourceFiles.length} files, ${manifest.characters.length} characters`);
    }
  }
  const result = { editions: expectedIds.length, files, dice, digest };
  if (staged) await fs.writeFile(path.join(repo, '.artifacts/bilingual-worlds/validated.json'), JSON.stringify(result, null, 2));
  console.log(`PASS: ${result.editions} editions; ${files} files; ${dice} dice cards; executable data and graphics preserved.`);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.find(a => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean) ?? null;
  await checkEditions({ staged: process.argv.includes('--staged'), only });
}
