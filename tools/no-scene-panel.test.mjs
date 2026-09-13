import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const source = path => readFileSync(new URL(`../apps/web/src/${path}`, import.meta.url), 'utf8');
test('canvas has one entity path and no fixed scene panel', () => {
  assert.equal(existsSync(new URL('../apps/web/src/components/narrative/SceneChalk.tsx', import.meta.url)), false);
  for (const path of ['components/canvas/Canvas.tsx', 'App.tsx', 'components/nook/NookView.tsx']) assert.doesNotMatch(source(path), /SceneChalk|sceneCopy/);
  assert.doesNotMatch(source('index.css'), /\.scene-chalk/);
  assert.match(source('components/canvas/Canvas.tsx'), /<CanvasObject/);
  assert.match(source('components/canvas/CardRenderer.tsx'), /<ChalkCard item=\{item\}/);
});
