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
  assert.match(entity, /runGatewayAction<DeclaredChoiceDetails>\(\s*'choice'/);
  assert.match(entity, /result\?\.outcome !== 'accepted'/);
  assert.match(entity, /result\.details\.action/);
  const declaredChoice = entity.slice(entity.indexOf('const executeDeclaredChoice'), entity.indexOf('const choose'));
  assert.doesNotMatch(declaredChoice, /onChoice\(/);
});

test('declared choices run on click; plain choices only draft (docs/ux/16 §choice exception)', () => {
  const choose = entity.slice(entity.indexOf('const choose = '), entity.indexOf('// The reader posted nothing itself'));
  // The declared branch comes first and leaves through executeDeclaredChoice, never the draft.
  assert.match(choose, /if \(fm\?\.choice_actions && typeof fm\.choice_actions === 'object'\) \{\s*void executeDeclaredChoice\(item\.path, choice\);\s*return;/);
  // Whatever remains is the plain-choice draft, and it names no declared action.
  const plain = choose.slice(choose.indexOf('return;') + 'return;'.length);
  assert.match(plain, /onChoice\(`Regarding world file/);
  assert.doesNotMatch(plain, /executeDeclaredChoice|airpGateway|reviewed the declared choice/);
});

test('dice reward cards are read-only persisted outcome displays', () => {
  // Bound the persisted-reward branch at the next renderer branch so a
  // renamed legacy comment cannot accidentally make this test inspect a
  // different card's interaction authority.
  const outcome = card.slice(card.indexOf('if (frontmatter?.dice_reward)'), card.indexOf('if (frontmatter?.visual'));
  assert.match(outcome, /className="dice-outcome-letter"/);
  assert.match(outcome, /<MarkdownText text=\{body\}/);
  assert.doesNotMatch(outcome, /onDiceRolled|airpGateway|fetch\(/);
});

test('Prepare does not send to the writer; the separate Send review control does', () => {
  const submit = dialog.slice(dialog.indexOf('const submit ='), dialog.indexOf('return createPortal'));
  assert.doesNotMatch(submit, /onChoice|onSendReview/);
  assert.match(dialog, /onSendReview\(reviewPrompt\)/);

  // Stop at the actions-panel declaration: its widget callback intentionally
  // contains `onChoice`, while Prepare must only present material selections.
  // This boundary prevents the test from confusing the later writer handoff
  // with the authoritative material-review request.
  const materialSubmit = entity.slice(
    entity.indexOf('const submitMaterialReview'),
    entity.indexOf('  const actionsPanel = <>'),
  );
  assert.match(materialSubmit, /runGatewayAction<MaterialReviewDetails>\(\s*'act'/);
  assert.doesNotMatch(materialSubmit, /onChoice\s*\(/);

  // Inspect only the Send review callback so a future refactor cannot leave
  // the visible control inert while another unrelated callback satisfies it.
  const sendStart = entity.indexOf('onSendReview={prompt =>');
  const sendReview = entity.slice(sendStart, entity.indexOf('\n      }}', sendStart));
  assert.match(sendReview, /onChoice\(prompt\)/);
});
