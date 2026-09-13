import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { experiences } from './experiences/index.mjs';
import { sceneCopy, clueCopy } from './experiences/plain-language.mjs';
import { parseFrontmatter } from '../packages/shared/dist/index.js';

test('six worlds use the same simple copy in source and shipped scenes without moving paths', async () => {
  for (const pack of experiences) {
    for (const [scene, [title, body]] of Object.entries(sceneCopy[pack.base] ?? {})) {
      for (const file of [`${scene}/README.md`, `${scene}/01-opening.md`]) {
        if (!pack.files[file]) continue;
        const compiled = parseFrontmatter(pack.files[file]);
        const shipped = parseFrontmatter(await fs.readFile(`templates/${pack.id}/${file}`, 'utf8'));
        assert.equal(compiled.frontmatter.title, title, file);
        assert.equal(compiled.body.trim(), body, file);
        assert.equal(shipped.body.trim(), body, `${pack.id}:${file}`);
        assert.deepEqual(shipped.interactive.choice, compiled.interactive.choice, file);
      }
    }
    for (const [file, [title, body]] of Object.entries(clueCopy[pack.base] ?? {})) {
      const shipped = parseFrontmatter(await fs.readFile(`templates/${pack.id}/${file}`, 'utf8'));
      assert.equal(shipped.frontmatter.title, title, file);
      assert.equal(shipped.body.trim(), body, file);
    }
  }
});

test('every new world prompt excludes unsupported dice; investigations use two D10s', async () => {
  for (const pack of experiences) {
    for (const [file, text] of Object.entries(pack.files)) {
      assert.doesNotMatch(text, /2d6/, `${pack.id}:${file}`);
      const shipped = await fs.readFile(`templates/${pack.id}/${file}`, 'utf8');
      assert.doesNotMatch(shipped, /2d6/, `${pack.id}:${file}`);
      const { frontmatter: fm } = parseFrontmatter(shipped);
      if (!fm?.roll_dice) continue;
      assert.ok(['1d10','2d10','1d100'].includes(fm.roll_dice.type), file);
      assert.equal(fm.roll_dice.result, undefined, 'No dice are pre-rolled');
      if (fm.dice_outcomes) {
        assert.equal(fm.roll_dice.type, '2d10');
        assert.equal(fm.roll_dice.expect, '>=11');
        assert.deepEqual(fm.dice_outcomes.map(o => [o.min,o.max]), [[2,4],[5,10],[11,17],[18,20]]);
      }
    }
  }
});

test('two D10 probability bands cover exactly 100 equally likely throws', () => {
  const counts = [0,0,0,0];
  for (let a=1;a<=10;a++) for(let b=1;b<=10;b++) {
    const n=a+b; counts[n<=4?0:n<=10?1:n<=17?2:3]++;
  }
  assert.deepEqual(counts, [6,39,49,6]);
});
