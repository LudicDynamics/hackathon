import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { experiences } from './experiences/index.mjs';
import { installExperience } from './install-experiences.mjs';
import { md } from './experiences/common.mjs';
import { LocalWorldStore, createActionService, parseFrontmatter } from '../packages/shared/dist/index.js';
import { runDeclaredChoice, runDeclaredRoll, serialDeclared } from '../apps/server/dist/engine/declared-actions.js';
import { createWorldRouter } from '../apps/server/dist/routes/world.js';

test('all six worlds explicitly bind every authored choice and provide useful non-writer interactions', () => {
  for (const pack of experiences) {
    const kinds = new Set();
    let count = 0;
    for (const [file, text] of Object.entries(pack.files)) {
      if (!file.endsWith('.md')) continue;
      const p = parseFrontmatter(text);
      for (const band of p.frontmatter?.dice_outcomes ?? []) {
        for (const o of band.options) kinds.add(o.action.kind);
      }
      for (const o of p.interactive.choice?.options ?? []) {
        assert.ok(o.id, file);
        const action = p.frontmatter.choice_actions[o.id];
        assert.ok(action, `${pack.id}:${file}:${o.label}`);
        kinds.add(action.kind); count++;
        if (['read', 'take'].includes(action.kind)) for (const target of action.paths) {
          assert.ok(pack.files[target] || target.startsWith('player/'), `${pack.id}:${file} missing ${target}`);
        }
      }
    }
    assert.ok(count > 0); assert.ok([...kinds].some(k => k !== 'writer'), pack.id);
    assert.ok(kinds.has('writer'), `${pack.id} preserves creative RP`);
  }
});

test('all investigation sites have visible dice routes, including the two map-level no-essay shortcuts', () => {
  for (const pack of experiences.filter(p => ['wuwu', 'whitechapel'].includes(p.base))) {
    const dice = Object.entries(pack.files).filter(([f]) => f.endsWith('/04-investigation-dice.md'));
    assert.equal(dice.length, pack.base === 'wuwu' ? 4 : 8);
    for (const [file, text] of dice) {
      const p = parseFrontmatter(text);
      assert.equal(p.interactive.roll_dice.type, '2d10');
      assert.equal(p.interactive.roll_dice.expect, '>=11');
      assert.equal(p.frontmatter.requires, undefined);
      assert.deepEqual(p.frontmatter.dice_outcomes.map(b => [b.min, b.max]), [[2,4],[5,10],[11,17],[18,20]]);
      for (const b of p.frontmatter.dice_outcomes) assert.ok(b.options.length >= 2, file);
    }
  }
});

test('HTTP direct choices never dispatch a writer, preserve gates, and stage without executing', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-direct-six-'));
  const require = createRequire(new URL('../apps/server/package.json', import.meta.url));
  for (const pack of experiences) {
    const output = await installExperience(process.cwd(), pack, { outputRoot: tmp });
    const store = new LocalWorldStore(output.path);
    await fs.mkdir(path.join(output.path, '.airpworld'), { recursive: true });
    await fs.writeFile(path.join(output.path, '.airpworld/settings.json'), JSON.stringify({ autoWrite: 'scenes-and-choices' }));
    let turns = 0;
    const lifecycle = new Proxy({}, { get: () => () => { turns++; throw new Error('Unexpected model call'); } });
    const app = require('express')(); app.use(require('express').json());
    app.use('/api', createWorldRouter(process.cwd(), lifecycle, { broadcast() {} }, () => store, () => {}));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const post = async (route, payload) => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return { status: res.status, body: await res.json() };
    };
    try {
      if (pack.base === 'wuwu') assert.equal((await post('enter-layer', { layer: 'world/harbor-chart' })).status, 409);
      let checked = 0;
      for (const [file, text] of Object.entries(pack.files)) {
        if (file.endsWith('README.md') || !file.endsWith('.md')) continue;
        const p = parseFrontmatter(text);
        for (const o of p.interactive.choice?.options ?? []) {
          const action = p.frontmatter.choice_actions[o.id];
          if (!['read', 'take', 'stage', 'enter', 'reply', 'character', 'writer'].includes(action.kind)) continue;
          const response = await post('choice', { path: file, choice: o.label });
          assert.equal(response.status, 200, `${pack.id}:${file}: ${JSON.stringify(response.body)}`);
          assert.equal(response.body.action.kind, action.kind);
          if (action.kind === 'stage') assert.ok(response.body.action.missing.every(p => p.startsWith('player/') || p.startsWith('world/')));
          if (action.kind === 'stage') {
            const staged = response.body.action;
            const base = { world: store.worldRoot, path: file, choice: staged.choice, revision: staged.revision };
            assert.equal((await post('material-review', { ...base, selections: [] })).status, 400, 'Empty review is rejected');
            assert.equal((await post('material-review', { ...base, world: 'another-save', selections: [] })).status, 409, 'Cross-world review is rejected');
            const selections = staged.slots.flatMap(slot => {
              const item = staged.items.find(i => slot.paths.includes(i.declaredPath));
              return item ? [{ slot: slot.id, path: item.path, revision: item.revision }] : [];
            });
            if (selections.length && staged.slots.every(s => !s.required || selections.some(i => i.slot === s.id))) {
              const reviewed = await post('material-review', { ...base, selections });
              assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
              assert.match(reviewed.body.prompt, /separate explicit player confirmation/);
              assert.equal(turns, 0, 'Preparing review never starts an agent');
            }
          }
          if (action.kind === 'take') {
            const again = await post('choice', { path: file, choice: o.id });
            assert.equal(again.status, 200, 'Repeated take is harmless');
          }
          checked++;
        }
      }
      assert.ok(checked); assert.equal(turns, 0, pack.id);
      assert.equal(await store.statKind('player/case-receipt.md'), 'missing');
      if (pack.base === 'wuwu') assert.equal((await post('enter-layer', { layer: 'world/harbor-chart' })).status, 200);
    } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
  }
});

test('real dice resolver applies all band boundaries once and rejects malformed recipes before rolling', async () => {
  const pack = experiences.find(p => p.base === 'whitechapel');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-direct-dice-'));
  const output = await installExperience(process.cwd(), pack, { outputRoot: tmp });
  const store = new LocalWorldStore(output.path);
  const svc = createActionService(store, { type: 'god' });
  const source = 'world/london-map/04-investigation-dice.md';
  try {
    for (const score of [2,4,5,10,11,17,18,20]) {
      await store.writeFileAtomic(source, pack.files[source]);
      const before = await store.getMaxSeq();
      const result = await runDeclaredRoll(svc, source, score);
      assert.equal(result.details.result, score);
      const resolved = parseFrontmatter(await store.readFile(source));
      assert.ok(resolved.body.includes(result.details.outcomeText));
      assert.equal(resolved.frontmatter.choice_actions['play-result'].kind, 'writer');
      assert.equal(await store.statKind('player/operation-plan.md'), 'missing');
      const seq = await store.getMaxSeq();
      const again = await runDeclaredRoll(svc, source, score === 20 ? 2 : 20);
      assert.equal(again.details.result, score); assert.equal(await store.getMaxSeq(), seq);
      assert.equal((await store.getEventsSince(before)).filter(e => e.type === 'roll_resolved').length, 1);
    }
    const malformed = parseFrontmatter(pack.files[source]);
    malformed.frontmatter.dice_outcomes[0].min = 1;
    await store.writeFileAtomic(source, md(malformed.frontmatter, malformed.body));
    const seq = await store.getMaxSeq();
    await assert.rejects(runDeclaredRoll(svc, source, 12), /partition/);
    assert.equal(await store.getMaxSeq(), seq);
    const bad = 'world/bad-action.md';
    await store.writeFileAtomic(bad, md({ type: 'chalk', choice: [{ id: 'steal', label: 'Read' }], choice_actions: { steal: { kind: 'read', paths: ['.airpworld/settings.json'] } } }, ''));
    await assert.rejects(runDeclaredChoice(svc, bad, 'steal'), /Markdown file/);
    assert.equal(await store.getMaxSeq(), seq);
    let active = 0, max = 0;
    await Promise.all([1,2,3].map(() => serialDeclared(output.path, async () => { active++; max=Math.max(max,active); await Promise.resolve(); active--; })));
    assert.equal(max, 1);
  } finally { store.close(); }
});
