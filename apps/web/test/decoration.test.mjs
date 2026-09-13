import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('all six material URLs resolve to optimized WebP assets', () => {
  const css = fs.readFileSync(path.join(root, 'src/decoration.css'), 'utf8');
  const urls = [...new Set([...css.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]))];
  assert.equal(urls.length, 6);
  let total = 0;
  for (const url of urls) {
    const bytes = fs.readFileSync(path.join(root, 'public', url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    total += bytes.length;
  }
  assert.ok(total < 900000);
  assert.match(css, /scene-backdrop:not\(:has\(\.scene-backdrop__img\)\)/);
  assert.match(css, /\[data-nook\] \.paper-reading/);
});

test('settings portal owns its styles independently from world selection', () => {
  const component = fs.readFileSync(path.join(root, 'src/components/TtsSettings.tsx'), 'utf8');
  assert.match(component, /className="settings-panel"/);
  assert.doesNotMatch(component, /className="prototype-world-picker"/);
  const css = fs.readFileSync(path.join(root, 'src/decoration.css'), 'utf8');
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /focus-visible/);
});
