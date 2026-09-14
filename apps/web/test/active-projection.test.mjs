import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const nook = await readFile(new URL('../src/components/nook/NookView.tsx', import.meta.url), 'utf8');
const nookCode = nook.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

test('App has mutually exclusive layer and Nook projection branches', () => {
  assert.match(app, /\{nookChar\s*&&\s*\(/);
  assert.match(app, /\{!nookChar\s*&&\s*\(/);
  assert.match(app, /data-airp-projection=\{`layer:\$\{layer\}`\}/);
  assert.match(app, /data-airp-projection=\{`nook:\$\{nookChar\}`\}/);
  assert.equal((app.match(/<Canvas\b/g) ?? []).length, 1);
  assert.equal((app.match(/<PerformanceLayer\b/g) ?? []).length, 1);
  assert.doesNotMatch(app, /\{nookChar\s*&&\s*<div className="prototype-nook"/);
});

test('only the active projection owns the active marker and Nook measurement is root-scoped', () => {
  assert.equal((app.match(/data-airp-projection-active="true"/g) ?? []).length, 1);
  assert.equal((nook.match(/data-airp-projection-active="true"/g) ?? []).length, 1);
  assert.doesNotMatch(nookCode, /useWorld\s*\(/);
  assert.doesNotMatch(nookCode, /new\s+WebSocket/);
  assert.doesNotMatch(nookCode, /useCamera\s*\(/);
  assert.match(nook, /rootRef\.current\?\.querySelector\('\.object\.dragging-item'\)/);
});
