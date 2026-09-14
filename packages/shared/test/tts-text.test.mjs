import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitiseTtsText } from '../dist/rules/tts-text.js';

test('sanitiseTtsText removes action brackets and leading emotion tags', () => {
  const cases = [
    ['（笑了一下）好啊', '好啊'],
    ['(laughs) Sure', 'Sure'],
    ['【把信递给你】拿着', '拿着'],
    ['[emo: smile] 好啊', '好啊'],
    ['[emo: sad] （今は、答えが返ってこない。）', ''],
    ['（笑了一下）', ''],
    ['（）好', '好'],
    ['()好', '好'],
  ];
  for (const [raw, expected] of cases) assert.equal(sanitiseTtsText(raw), expected, raw);
});

test('sanitiseTtsText supports properly nested actions and preserves prose', () => {
  assert.equal(sanitiseTtsText('(aside [quiet]) Hello'), 'Hello');
  assert.equal(sanitiseTtsText('  Keep [aside] this  '), 'Keep  this');
  assert.equal(sanitiseTtsText('[emo: smile] [emo: sad] hello'), 'hello');
});

test('sanitiseTtsText fails closed for malformed bracket structures', () => {
  for (const raw of [
    '（说完就走了',
    '还好）',
    '（他说\n完了',
    '(cross [types)',
    'cross] types',
  ]) {
    assert.equal(sanitiseTtsText(raw), '', raw);
  }
});

test('sanitiseTtsText is idempotent', () => {
  for (const raw of [
    '（笑）hello',
    '[emo: smile] (laughs) Sure',
    '（说完就走了',
    'plain text',
  ]) {
    const cleaned = sanitiseTtsText(raw);
    assert.equal(sanitiseTtsText(cleaned), cleaned, raw);
  }
});
