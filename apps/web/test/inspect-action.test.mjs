import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const entity = await readFile(new URL('../src/components/narrative/EntityInteractions.tsx', import.meta.url), 'utf8');

test('Look closer opens the real reading projection with the entity body', () => {
  assert.match(entity, /import \{ BagItemDialog \} from '\.\.\/BagItemDialog\.js'/);
  assert.match(entity, /body: item\.body \?\? ''/);
  assert.match(entity, /const readingProjection = <>[\s\S]*<BagItemDialog[\s\S]*body: canRead \? readingItem\.body : ''/);
  assert.match(entity, /onClick=\{inspect\}/);
});

test('Take along remains an authoritative move action', () => {
  assert.match(entity, /collectable && <button[\s\S]*runGatewayAction\('move', item\.path, \(\) => airpGateway\.move\(item\.path/);
  assert.match(entity, /t\('Added to belongings\.'\)/);
});

test('Look closer re-enters CanvasObject reading without a writer request', () => {
  assert.match(entity, /object\.dispatchEvent\(new KeyboardEvent\('keydown'/);
  assert.match(entity, /key: 'Enter'/);
  const lookCloser = entity.match(/<button type="button" onClick=\{inspect\}>\{t\('\u2192 Look closer'\)\}<\/button>/)?.[0] ?? '';
  assert.notEqual(lookCloser, '', 'Look closer button must remain wired');
  assert.doesNotMatch(lookCloser, /send\(|onChoice\?\.\(/);
  assert.doesNotMatch(lookCloser, /Inspecting/);
});

test('Look closer remains available without a writer callback', () => {
  assert.match(entity, /<button type="button" onClick=\{inspect\}>/);
  assert.doesNotMatch(entity, /\{onChoice && <button type="button" onClick=\{inspect\}/);
});

test('Inspect does not fabricate an Inspecting status', () => {
  assert.doesNotMatch(entity, /Inspecting[\u2026.]/);
  assert.match(entity, /setFeedbackStatus\(null\)/);
  assert.match(entity, /setFeedback\(''\)/);
});
