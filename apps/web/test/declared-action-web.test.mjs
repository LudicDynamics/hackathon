import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const dialog = await readFile(new URL('../src/components/narrative/DeclaredActionDialog.tsx', import.meta.url), 'utf8');
const entity = await readFile(new URL('../src/components/narrative/EntityInteractions.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../src/components/canvas/CardRenderer.tsx', import.meta.url), 'utf8');

test('stage consumes the frozen action snapshot and remains presentation-only before submit', () => {
  assert.match(dialog, /kind: DeclaredActionKind/);
  assert.match(dialog, /source: string[\s\S]*choice: string \| number[\s\S]*revision: string[\s\S]*items: DeclaredItem\[\][\s\S]*missing: string\[\][\s\S]*slots\?: MaterialSlot\[\]/);
  assert.doesNotMatch(dialog, /fetch\(|airpGateway|material-review/);
  assert.match(dialog, /Selecting materials does not submit or execute them/);
});

test('a material is used once, a slot holds up to maxItems, and required-slot readiness is explicit', () => {
  // One slot may hold several files (bb4511f); moving a file removes it from every other slot.
  assert.match(dialog, /Object\.entries\(selected\)\.map\(\(\[id, paths\]\) => \[id, paths\.filter\(p => p !== path\)\]\)/);
  assert.match(dialog, /current\.length >= slotCapacity\(slot\)[\s\S]*setError/);
  assert.match(dialog, /slots\.length > 0[\s\S]*Object\.values\(selected\)\.some\(paths => paths\.length > 0\)[\s\S]*slots\.every\(slot => !slot\.required \|\| \(selected\[slot\.id\]\?\.length \?\? 0\) > 0\)/);
  assert.match(dialog, /if \(!item \|\| !slot \|\| !isSelectable\(item, slot\)\)[\s\S]*setError/);
});

test('stage retry preserves the draft after an authoritative review failure', () => {
  assert.match(dialog, /try \{[\s\S]*await onSubmit\([\s\S]*catch \(reason\)[\s\S]*setError\([\s\S]*finally \{[\s\S]*setBusy\(false\)/);
  assert.doesNotMatch(dialog, /setSelected\(\{\}\)/);
  // `world` lets the server reject a panel opened before a world switch (409).
  assert.match(entity, /body: JSON\.stringify\(\{ world: action\.world, path: action\.source, choice: action\.choice, revision: action\.revision, selections \}\)/);
});

test('declared choices are classified through ActionFeedback and never become writer prompts before acceptance', () => {
  assert.match(entity, /runGatewayAction<DeclaredChoiceDetails>\('choice'/);
  assert.match(entity, /actionDetailsOf<DeclaredChoiceDetails>\(response\)/);
  assert.match(entity, /result\?\.outcome !== 'accepted'/);
  const declaredChoice = entity.slice(entity.indexOf('const executeDeclaredChoice'), entity.indexOf('const choose'));
  assert.doesNotMatch(declaredChoice, /onChoice\(/);
});

test('dice reward cards are read-only persisted outcome displays', () => {
  const outcome = card.slice(card.indexOf('if (frontmatter?.dice_reward)'), card.indexOf('// 1. Chalk Card'));
  assert.match(outcome, /className="dice-outcome-letter"/);
  assert.match(outcome, /<MarkdownText text=\{body\}/);
  assert.doesNotMatch(outcome, /onDiceRolled|airpGateway|fetch\(/);
});

test('Prepare does not send to the writer; the separate Send review control does', () => {
  const submit = dialog.slice(dialog.indexOf('const submit ='), dialog.indexOf('return createPortal'));
  assert.doesNotMatch(submit, /onChoice|onSendReview/);
  assert.match(dialog, /onSendReview\(reviewPrompt\)/);
  const materialSubmit = entity.slice(entity.indexOf('const submitMaterialReview'), entity.indexOf('const inspect'));
  assert.doesNotMatch(materialSubmit, /onChoice\(/);
  const sendReview = entity.slice(entity.indexOf('onSendReview={prompt =>'), entity.indexOf('/>}\n  </div>'));
  assert.match(sendReview, /onChoice\(prompt\)/);
});
