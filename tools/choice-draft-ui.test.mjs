import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
test('choice clicks prepare a labeled draft, not an eager choose request', () => {
  const actions = read('apps/web/src/components/narrative/EntityInteractions.tsx');
  const app = read('apps/web/src/App.tsx');
  assert.doesNotMatch(actions, /airpGateway\.choose/);
  assert.doesNotMatch(app, /airpGateway\.choose/);
  assert.match(actions, /onSelectChoice\?\.\(item.path, choice\)/);
  assert.match(app, /enterLayer\(target, \{ initialize: false \}\)/);
  assert.match(app, /prepareWriter\(choice\)/);
  assert.match(app, /Ready to send: \{action\}/);
  assert.match(app, /Selected: \{action\}/);
});
test('nook entry and initialization use translated labels and the existing explicit command', () => {
  const app = read('apps/web/src/App.tsx');
  const copy = JSON.parse(read('apps/web/src/lib/messages.json'));
  assert.match(app, /resident-actions/);
  assert.match(app, /type: 'airp_init', kind: 'nook'/);
  assert.match(app, /NookView characterId=\{nookChar\} locale=\{locale\}/);
  for (const key of ['Visit ikigai', 'Initialize private space', 'Ready to send: {action}']) {
    assert.ok(copy[key]['zh-CN']); assert.ok(copy[key].ja);
  }
});
