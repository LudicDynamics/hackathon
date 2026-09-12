import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// SHA-256 of the complete original worldlines-canvas/app/media MP3 files.
const themes = {
  mistport: 'ccf9a60081fe9d0f50d37fda124bea206fb3e8d9921c571ee2be3a4ef6a49f64',
  wuwu: 'f154534bca631836a2ee3c6af14f182b65c53759df877b401f2ed4b2806cd384',
  whitechapel: '9a03ae5b323bd9120685606c2e3172c2b5a28c854a9e45b772313f8e8468b562',
  divergence: '1f7c87dea627124d2fb772b85ec5b0759379a3cd5a8e13029030408321b77471',
  firstsnow: '94f6c067ed616bd0936fbac35e4cdd73d6fc25f0d936b19bc334349f9be654d4',
};
for (const [world, sha256] of Object.entries(themes)) {
  test(`${world}: full Canvas theme is preserved byte-for-byte`, async () => {
    const bytes = await readFile(new URL(`../assets/audio/themes/canvas-${world}.mp3`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  });
  if (world === 'mistport') continue;
  test(`${world}: migrated template selects its authored Canvas theme`, async () => {
    const manifest = JSON.parse(await readFile(new URL(`../templates/${world}/world.json`, import.meta.url), 'utf8'));
    assert.equal(manifest.audio.theme, `canvas-${world}`);
  });
}
test('Canvas music attribution names the original creator and all five tracks', async () => {
  const credits = await readFile(new URL('../assets/audio/CREDITS.md', import.meta.url), 'utf8');
  assert.match(credits, /MaouDamashii \(Koichi Morita\)/);
  for (const world of Object.keys(themes)) assert.ok(credits.includes(`canvas-${world}.mp3`));
});
