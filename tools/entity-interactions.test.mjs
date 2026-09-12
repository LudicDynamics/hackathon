import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, InteractionFieldsSchema, stringifyChalk } from '../packages/shared/dist/schemas/frontmatter.js';

for (const type of ['chalk', 'note', 'character', 'gate', 'component']) {
  test(`${type}: shared choice, dice, status and action fields survive parsing`, () => {
    const text = `---\ntype: ${type}\nchoice:\n  - Ask about the letter\nactions:\n  - Expand this scene\nroll_dice:\n  type: 1d6\n  desc: Inspect the seal\n  expect: ">3"\nstatus:\n  data:\n    seal: intact\ncustom_style: violet\n---\nA sealed letter.`;
    const { frontmatter, body } = parseFrontmatter(text);
    assert.equal(body, 'A sealed letter.');
    assert.deepEqual(frontmatter.choice, ['Ask about the letter']);
    assert.deepEqual(frontmatter.actions, ['Expand this scene']);
    assert.equal(frontmatter.custom_style, 'violet');
    assert.equal(frontmatter.status.data.seal, 'intact');
    assert.equal(frontmatter.roll_dice.expect, '>3');
    assert.equal(InteractionFieldsSchema.safeParse(frontmatter).success, true);
    assert.deepEqual(parseFrontmatter(stringifyChalk(frontmatter, body)).frontmatter.actions, frontmatter.actions);
  });
}
test('invalid interaction data degrades to original text, not a partial widget', () => {
  const text = '---\ntype: note\nchoice: [42]\n---\nOriginal';
  assert.deepEqual(parseFrontmatter(text), { frontmatter: null, body: text });
  assert.equal(InteractionFieldsSchema.safeParse({ choice: [{}] }).success, false);
});
