// Verify the actual Git-distributed templates, not only fresh compiler output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { experiences } from './experiences/index.mjs';
import { parseFrontmatter, WorldManifestSchema } from '../packages/shared/dist/index.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', 'templates'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean));

for (const pack of experiences) {
  test(`${pack.id}: shipped manifest, authored files and media references are tracked`, () => {
    const prefix = `templates/${pack.id}/`;
    const read = file => fs.readFileSync(path.join(repo, prefix, file), 'utf8');
    const requireFile = file => {
      assert.ok(tracked.has(prefix + file), `Untracked dependency: ${prefix}${file}`);
      assert.ok(fs.statSync(path.join(repo, prefix, file)).isFile(), file);
    };
    const checkMedia = fm => {
      for (const key of ['bg', 'bgVideo', 'image', 'avatar', 'avatarVideo', 'cover']) {
        const ref = fm?.[key];
        if (typeof ref === 'string' && ref.startsWith('assets/')) requireFile(ref);
      }
    };
    requireFile('world.json');
    const manifest = WorldManifestSchema.parse(JSON.parse(read('world.json')));
    assert.equal(manifest.id, pack.id);
    assert.equal(manifest.locale, pack.locale);
    assert.equal(manifest.entry, 'map');
    checkMedia(manifest); checkMedia(manifest.player);
    for (const [file, expectedText] of Object.entries(pack.files)) {
      requireFile(file);
      const actual = parseFrontmatter(read(file));
      const expected = parseFrontmatter(expectedText);
      assert.deepEqual(actual.errors, [], file);
      checkMedia(actual.frontmatter);
      // Motion is inherited from source-world assets after prose compilation.
      const fm = actual.frontmatter ? { ...actual.frontmatter } : null;
      if (fm) delete fm.bgVideo;
      assert.deepEqual(fm, expected.frontmatter, `Authoring drift: ${file}`);
      assert.equal(actual.body, expected.body, `Body drift: ${file}`);
    }
    for (const c of manifest.characters) {
      requireFile(`${c.home}/README.md`);
      for (const file of ['README.md', 'personality.md', 'memory.md', 'preset.json']) requireFile(`characters/${c.id}/${file}`);
      checkMedia(c);
      const memory = parseFrontmatter(read(`characters/${c.id}/memory.md`)).body.trim();
      assert.equal(memory, pack.locale === 'ja'
        ? 'このプレイで交わした新しい約束はまだない。知らない場面の秘密を加えない。'
        : 'No new promises in this playthrough yet. Do not import secrets from unvisited scenes.');
    }
    const shipped = [...tracked].filter(file => file.startsWith(prefix));
    assert.ok(shipped.every(file => /^[a-zA-Z0-9/_.-]+$/.test(file)), 'Stable ASCII paths');
    assert.ok(!shipped.some(file => /\/(?:player|\.airpworld|\.pi)\/|\/\.env(?:\.|$)|\.jsonl$/.test(file)), 'No inventory, sessions or local configuration');
  });
}

test('canonical worlds ship while experimental revisions and runtime files stay ignored', () => {
  const ignored = file => spawnSync('git', ['check-ignore', '--no-index', '-q', file], { cwd: repo }).status;
  for (const p of experiences) {
    assert.equal(ignored(`templates/${p.id}/world.json`), 1);
    assert.equal(ignored(`templates/${p.id}-scratch/world.json`), 0);
    assert.equal(ignored(`templates/${p.id}/.airpworld/sessions/test.jsonl`), 0);
    assert.equal(ignored(`templates/${p.id}/.airpworld/canvas.db`), 0);
  }
  assert.equal(ignored('worlds/example/world.json'), 0);
  assert.equal(ignored('.env.local'), 0);
});
