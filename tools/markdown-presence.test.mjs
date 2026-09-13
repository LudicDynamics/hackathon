import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../apps/web/src/${file}`, import.meta.url), 'utf8');
test('chalk uses the shared safe Markdown renderer', async () => {
  const code = await read('components/narrative/ChalkCard.tsx');
  assert.match(code, /<MarkdownText text=\{body\}/);
  assert.doesNotMatch(code, /dangerouslySetInnerHTML/);
});
test('presence uses authored avatars and stable character ids, with a non-pixel fallback', async () => {
  const code = await read('components/canvas/CanvasObject.tsx');
  assert.match(code, /avatar=\{item.frontmatter\?\.avatar\}/);
  assert.match(code, /frontmatter\?\.characterId/);
  assert.match(code, /<UserRound/);
  assert.match(code, /onError=\{\(\) => setFailed\(true\)\}/);
});
test('body tooltip is removed while dialogue close keeps its safe offset', async () => {
  const css = await read('scene-shell.css');
  assert.doesNotMatch(css, /markdown-chalk-preview/);
  assert.match(css, /character-modal-layer \.modal-close \{ top: max\(84px/);
});
test('all Markdown forms share one interaction footer with source context', async () => {
  assert.match(await read('components/canvas/CanvasObject.tsx'), /<EntityInteractions item=\{item\}/);
  assert.doesNotMatch(await read('components/narrative/ChalkCard.tsx'), /renderFrontmatterWidgets/);
  const code = await read('components/narrative/EntityInteractions.tsx');
  assert.match(code, /JSON.stringify\(item.path\)/);
  assert.match(code, /filePath: item.path/);
});
