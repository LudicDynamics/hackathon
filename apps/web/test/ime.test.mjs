import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardImeKey } from '../src/lib/ime.ts';

function key(key, isComposing = false, keyCode = 13) {
  return { key, nativeEvent: { isComposing, keyCode }, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
}
test('candidate Enter cannot submit, including WebKit confirmation ordering', () => {
  for (const event of [key('Enter', true), key('Enter', false, 229)]) {
    assert.equal(guardImeKey(event), true);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
  }
});
test('ordinary Enter remains sendable and candidate arrows do not recall history', () => {
  const enter = key('Enter');
  assert.equal(guardImeKey(enter), false);
  assert.equal(enter.prevented, false);
  const arrow = key('ArrowUp', true, 38);
  assert.equal(guardImeKey(arrow), true);
  assert.equal(arrow.prevented, false);
});
test('all writer and character text entries guard IME before handling shortcuts', () => {
  for (const file of ['App.tsx', 'components/chrome/WriterBar.tsx', 'components/overlay/CharacterModal.tsx']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.match(source, /onKeyDown=\{\(?\w+\)? => \{\s*if \(guardImeKey\(\w+\)\) return;/);
  }
});
