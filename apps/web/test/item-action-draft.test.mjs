import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/item-action-draft.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { appendItemAction, buildItemActionPrompt, itemDraftReference, referencedItemPaths } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const frog = { path: 'player/clockwork-frog.md', filename: 'clockwork-frog.md', frontmatter: { title: 'ぜんまいの蛙' } };
const letter = { path: 'player/undelivered-letter.md', filename: 'undelivered-letter.md', frontmatter: { title: '届かなかった手紙' } };
const t = (_, values) => `${values.item}を使う。`;

test('use prepares localized text with an exact path, without network or item mutation', () => {
  const before = JSON.stringify(frog);
  assert.equal(appendItemAction('', frog, t), '[ぜんまいの蛙](player/clockwork-frog.md)を使う。');
  assert.equal(JSON.stringify(frog), before);
  assert.doesNotMatch(source, /fetch\(|airpGateway|WebSocket/);
});

test('two objects append to existing RP and both exact paths reach the writer', () => {
  const draft = appendItemAction(appendItemAction('リョウに見せたい。', frog, t), letter, t);
  assert.ok(draft.startsWith('リョウに見せたい。'));
  assert.deepEqual(referencedItemPaths(draft, [frog, letter]), [frog.path, letter.path]);
  const prompt = buildItemActionPrompt(draft, [frog, letter]);
  assert.ok(prompt.includes(JSON.stringify([frog.path, letter.path])));
  assert.match(prompt, /Read every referenced item and the current scene README/);
  assert.match(prompt, /persist required item\/state changes/);
});

test('repeated selection is idempotent; same title with different paths is not merged', () => {
  const draft = appendItemAction('', frog, t);
  assert.equal(appendItemAction(draft, frog, t), draft);
  const otherFrog = { ...frog, path: 'player/other-frog.md' };
  const pair = appendItemAction(draft, otherFrog, t);
  assert.deepEqual(referencedItemPaths(pair, [frog, otherFrog]), [frog.path, otherFrog.path]);
});

test('removed references and items no longer carried do not leave hidden attachments', () => {
  const pair = appendItemAction(appendItemAction('', frog, t), letter, t);
  const edited = pair.replace(itemDraftReference(frog), '別の方法');
  assert.deepEqual(referencedItemPaths(edited, [frog, letter]), [letter.path]);
  assert.deepEqual(referencedItemPaths(pair, [letter]), [letter.path]);
  assert.equal(buildItemActionPrompt('', [frog, letter]), '');
  assert.equal(buildItemActionPrompt('何もしない。', [frog]), '何もしない。');
});

test('edited cancellation remains authoritative and object references do not bypass gates', () => {
  const text = `${itemDraftReference(frog)}は使わず、しまっておく。`;
  const prompt = buildItemActionPrompt(text, [frog]);
  assert.ok(prompt.startsWith(text));
  assert.match(prompt, /final edited request/);
  assert.match(prompt, /not automatic permission to consume, combine, move them, or bypass scene requirements/);
  assert.match(prompt, /If the intended target or combination is unclear, ask in Chalk/);
});

test('references survive legacy unicode, spaces, parentheses and title brackets', () => {
  const item = { ...frog, path: 'player/古い 蛙(1).md', frontmatter: { title: '蛙[古い]' } };
  assert.deepEqual(referencedItemPaths(appendItemAction('', item, t), [item]), [item.path]);
  assert.deepEqual(referencedItemPaths('[broken](%zz)', [item]), []);
});

test('menu has separate place/use buttons and App sends through the existing writer entry only', () => {
  const dialog = readFileSync(new URL('../src/components/BagItemDialog.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(dialog, /onPlace\(item.path\)/);
  assert.match(dialog, /disabled=\{useDisabled\} onClick=\{\(\) => onUse\(item.path\)\}/);
  const prepare = app.split('const prepareItemUse =')[1].split('useEffect(')[0];
  assert.match(prepare, /if \(writerLocked\)/);
  assert.match(prepare, /appendItemAction\(writerRef.current.value, item, t\)/);
  assert.doesNotMatch(prepare, /sendToWriter|airpGateway|preparedSource.current = null/);
  assert.match(app, /const prompt = buildItemActionPrompt\(text, backpack\)/);
  assert.match(app, /onUse=\{prepareItemUse\} useDisabled=\{writerLocked\}/);
  assert.match(app, /const loadWorld[\s\S]*?writerRef.current.value = ''/);
});
