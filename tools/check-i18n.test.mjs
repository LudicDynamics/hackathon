import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translationCalls } from './lib/i18n-call-keys.mjs';

test('i18n scanner excludes interpolation values and unrelated literals', () => {
  const source = `const value = t('Selected: {action}.', { action: text.split('\\n')[0] });
// t('not a call')
const note = "t('also not a call')";
const jsx = <p title={t('Service URL')}>Visible text</p>;`;
  assert.deepEqual(translationCalls('sample.tsx', source), [
    { key: 'Selected: {action}.', line: 1 }, { key: 'Service URL', line: 4 },
  ]);
});

test('i18n scanner handles key alternatives without treating conditions as keys', () => {
  const source = `t(status === 'ready' ? 'Ready' : (failed ? 'Failed' : 'Waiting'));
t('A (balanced) label');
t(dynamicKey);`;
  assert.deepEqual(translationCalls('sample.ts', source).map(hit => hit.key), ['Ready', 'Failed', 'Waiting', 'A (balanced) label']);
});
