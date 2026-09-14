/**
 * doc 04 acceptance: ref rewrite (move), self-rebase, canvas migration,
 * seating, delete cascade (04 §10.1/§10.2/§10.3).
 *
 * Imports built `dist/` modules directly, not the barrel: `dist/index.js`
 * re-exports every sibling module in the batch, so one unfinished sibling
 * would block this file at import time. Build first (`pnpm --filter
 * @airp/shared build`), then `node --test packages/shared/test/move.test.mjs`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { ActionError } from '../dist/actions/errors.js';
import { createActionService } from '../dist/actions/service.js';
import { moveEntity } from '../dist/actions/move.js';
import { editEntity, eventKindOf, removeEntity } from '../dist/actions/delete.js';
import { extractRefSpans, relFrom, resolveRefTarget } from '../dist/actions/refs.js';
import { LocalWorldStore } from '../dist/store/local-store.js';

const ACTOR = { type: 'writer' };

async function tempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-move-test-'));
  const store = new LocalWorldStore(root);
  await store.writeFile(
    'world.json',
    JSON.stringify({
      id: 'proj-1',
      name: 'T',
      description: '',
      author: '',
      genre: 'test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  );
  await store.writeFile('world/README.md', '---\nname: Map\ntype: readme\n---\n\n# Map\n');
  await store.writeFile('world/inn/README.md', '---\nname: Inn\ntype: readme\n---\n\n# Inn\n');
  await store.writeFile('world/attic/README.md', '---\nname: Attic\ntype: readme\n---\n\n# Attic\n');
  return { store, root };
}

function service(store) {
  return createActionService(store, ACTOR, { turn: 'req:test' });
}

function isActionError(code) {
  return (err) => {
    assert.ok(err instanceof ActionError, `expected ActionError, got ${err}`);
    assert.equal(err.code, code, `expected code ${code}, got ${err.code}: ${err.message}`);
    return true;
  };
}

// ---------------------------------------------------- 04 §10.1 extractRefSpans

test('§10.1-1: a relative markdown link is located and rewritten relatively', () => {
  const raw = '---\ntitle: Notes\ntype: chalk\n---\n\nPass me [the key](./copper-key.md) now.\n';
  const sites = extractRefSpans(raw, 'world/inn/notes.md', 'world/inn/copper-key.md');
  const links = sites.filter((s) => s.kind === 'markdown-link');
  assert.equal(links.length, 1);
  assert.equal(links[0].target, './copper-key.md');
  assert.equal(raw.slice(links[0].start, links[0].end), './copper-key.md');
  assert.equal(relFrom('world/inn', 'player/copper-key.md'), '../../player/copper-key.md');
});

test('§10.1-2: prose containing the entity NAME produces no RefSite (task-named negative)', () => {
  // The Chinese name is not the filename; nothing must match.
  const raw = '---\ntitle: Prose\ntype: chalk\n---\n\n铜钥匙躺在柜台上，像一枚旧硬币。\n';
  const sites = extractRefSpans(raw, 'world/inn/prose.md', 'world/inn/copper-key.md');
  assert.equal(sites.length, 0);
});

test('§10.1-3: a path-segment suffix is not a reference', () => {
  const raw = '---\ntitle: Decoy\ntype: chalk\n---\n\nBackup: world/inn/copper-key.md.bak is here.\n';
  const sites = extractRefSpans(raw, 'world/inn/decoy.md', 'world/inn/copper-key.md');
  const all = new Set(['world/inn/copper-key.md', 'world/inn/decoy.md']);
  const hits = sites.filter(
    (s) => resolveRefTarget(s.target, 'world/inn/decoy.md', all) === 'world/inn/copper-key.md'
  );
  assert.equal(hits.length, 0);
});

test('§10.1-4: a bare basename in prose is a body-mention, never rewritten', () => {
  const raw = '---\ntitle: Prose\ntype: chalk\n---\n\nHe left copper-key.md on the counter.\n';
  const sites = extractRefSpans(raw, 'world/inn/prose.md', 'world/inn/copper-key.md');
  const mentions = sites.filter((s) => s.kind === 'body-mention');
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].target, 'copper-key.md');
});

test('§10.1-5/6: quoted frontmatter path matches; a sprite `target` is not a path', () => {
  const withPath = '---\ntitle: A\ntype: chalk\npath: "world/inn/copper-key.md"\n---\n\nA.\n';
  const pathSites = extractRefSpans(withPath, 'world/inn/a.md', 'world/inn/copper-key.md');
  assert.equal(pathSites.filter((s) => s.kind === 'frontmatter-path').length, 1);
  assert.equal(pathSites[0].raw, '"world/inn/copper-key.md"');

  const gate = '---\nname: Inn\ntype: readme\ntarget: world/inn/copper-key.md\n---\n\n# Inn\n';
  const gateSites = extractRefSpans(gate, 'world/inn/README.md', 'world/inn/copper-key.md');
  assert.equal(gateSites.filter((s) => s.kind === 'gate-target').length, 1);

  // A sprite's `target` is a character id, not a path — must produce nothing.
  const sprite = '---\ntitle: W\ntype: sprite\ntarget: watson\n---\n\nW.\n';
  assert.equal(extractRefSpans(sprite, 'world/inn/w.md', 'world/inn/copper-key.md').length, 0);

  // A component's `target` IS a path (foundation.test.mjs asserts this).
  const comp = '---\ntitle: C\ntype: component\ntarget: world/inn/copper-key.md\n---\n\nC.\n';
  assert.equal(
    extractRefSpans(comp, 'world/inn/c.md', 'world/inn/copper-key.md').filter(
      (s) => s.kind === 'frontmatter-path'
    ).length,
    1
  );
});

// ---------------------------------------------------- 04 §10.2 resolveRefTarget

test('§10.2: resolveRefTarget boundary cases', () => {
  const all = new Set([
    'world/inn/key.md',
    'world/attic/key.md',
    'world/inn/a/key.md',
    'player/key.md',
  ]);
  assert.equal(
    resolveRefTarget('key.md', 'world/inn/notes.md', new Set(['world/inn/key.md'])),
    'world/inn/key.md'
  );
  assert.equal(resolveRefTarget('key.md', 'world/inn/a.md', all), null, 'ambiguous');
  assert.equal(resolveRefTarget('../a/key.md', 'world/inn/notes/x.md', all), 'world/inn/a/key.md');
  assert.equal(resolveRefTarget('./key.md', 'player/a.md', all), 'player/key.md');
  assert.equal(
    resolveRefTarget('world/inn/key.md.bak', 'world/inn/a.md', all),
    'world/inn/key.md.bak',
    'boundary compare: .bak is a different path, never key.md'
  );
});

// ---------------------------------------------------- 04 §10.3 store + action

test('§10.3: frontmatter path is rewritten, prose mention untouched, dangling reported', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile(
      'world/inn/copper-key.md',
      '---\ntitle: Copper Key\ntype: chalk\n---\n\nA key.\n'
    );
    // `path:` is a real reference key. (A `component`'s `target:` is NOT — see
    // §3.6.3: only a gate/README `target` names a path.)
    await store.writeFile(
      'world/inn/cabinet.md',
      '---\ntitle: Cabinet\ntype: component\npath: world/inn/copper-key.md\ntarget: inn-cabinet\n---\n\nSee [the key](./copper-key.md).\n'
    );
    await store.writeFile(
      'world/inn/prose.md',
      '---\ntitle: Prose\ntype: chalk\n---\n\nHe left copper-key.md here.\n'
    );
    await store.writeFile(
      'world/inn/decoy.md',
      '---\ntitle: Decoy\ntype: chalk\n---\n\nBackup copper-key.md.bak here.\n'
    );

    const svc = service(store);
    const res = await svc.moveEntity({
      from: 'world/inn/copper-key.md',
      to: 'player/copper-key.md',
    });

    const cabinet = await store.readFile('world/inn/cabinet.md');
    // `path:` is rewritten; the non-gate `target:` (a component id, not a path)
    // is left alone.
    assert.match(cabinet, /path: player\/copper-key\.md/);
    assert.match(cabinet, /target: inn-cabinet/);
    assert.match(cabinet, /\[the key\]\(\.\.\/\.\.\/player\/copper-key\.md\)/);

    const prose = await store.readFile('world/inn/prose.md');
    assert.match(prose, /He left copper-key\.md here\./, 'prose byte-preserved');
    assert.equal(res.details.rewroteFiles.includes('world/inn/prose.md'), false);

    const decoy = await store.readFile('world/inn/decoy.md');
    assert.match(decoy, /copper-key\.md\.bak/);

    assert.equal(res.details.path, 'player/copper-key.md');
    assert.equal(res.details.name, 'Copper Key');
    assert.ok(res.details.dangling >= 1, 'the prose mention is dangling');
    assert.equal(
      res.details.danglingRefs.every((d) => d.reason === 'ambiguous'),
      true
    );

    const events = await store.getEventsSince(0);
    const moved = events.find((e) => e.type === 'entity_moved');
    assert.ok(moved);
    assert.equal(moved.detail.to, 'player/copper-key.md');
    assert.equal(moved.detail.name, 'Copper Key');
    assert.equal(moved.actor.type, 'writer');
    assert.equal(moved.layer, 'world/inn');
    assert.equal(moved.subject, 'player/copper-key.md');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: the moved file rebases its OWN relative links', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('player/boat-ticket.md', '---\ntitle: Ticket\ntype: note\n---\n\nTicket.\n');
    await store.writeFile(
      'player/key.md',
      '---\ntitle: Key\ntype: note\n---\n\nTake [the ticket](./boat-ticket.md).\n'
    );

    const svc = service(store);
    await svc.moveEntity({ from: 'player/key.md', to: 'world/inn/key.md' });

    const moved = await store.readFile('world/inn/key.md');
    assert.match(moved, /\[the ticket\]\(\.\.\/\.\.\/player\/boat-ticket\.md\)/);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: a card leaving the canvas is dropped, never relayered to map', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    await store.seatUnplaced('world/inn', [{ path: 'world/inn/key.md', w: 280, h: 180 }]);
    assert.equal(store.getLayerCards(['world/inn/key.md']).length, 1);

    const svc = service(store);
    await svc.moveEntity({ from: 'world/inn/key.md', to: 'player/key.md' });

    assert.equal(store.getLayerCards(['world/inn/key.md']).length, 0);
    assert.equal(store.getLayerCards(['player/key.md']).length, 0, 'bag cards stay off the canvas');
    assert.equal(
      store.getLayerCards([]).length,
      0,
      'no ghost card row survives anywhere after the move'
    );
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: link endpoints + layer migrate on a same-layer rename', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    await store.writeFile('world/inn/door.md', '---\ntitle: Door\ntype: chalk\n---\n\nDoor.\n');
    await store.upsertLink({ layer: 'world/inn', from: 'world/inn/door.md', to: 'world/inn/key.md' });

    const svc = service(store);
    await svc.moveEntity({ from: 'world/inn/key.md', to: 'world/inn/rusty-key.md' });

    const links = await store.getLayerLinks('world/inn');
    assert.equal(links.length, 1);
    assert.equal(links[0].to, 'world/inn/rusty-key.md');
    assert.equal(links[0].layer, 'world/inn');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: seatNear places beside the anchor without overlap and never re-flows', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/counter.md', '---\ntitle: Counter\ntype: chalk\n---\n\nCounter.\n');
    await store.writeFile('world/inn/other.md', '---\ntitle: Other\ntype: chalk\n---\n\nOther.\n');
    await store.seatUnplaced('world/inn', [
      { path: 'world/inn/counter.md', w: 280, h: 180 },
      { path: 'world/inn/other.md', w: 280, h: 180 },
    ]);
    const before = store.getLayerCards(['world/inn/counter.md', 'world/inn/other.md']);
    const anchor = before.find((c) => c.id === 'world/inn/counter.md');

    const placed = await store.seatNear(
      'world/inn',
      { path: 'world/inn/key.md', w: 280, h: 180 },
      'world/inn/counter.md'
    );
    assert.equal(placed.exhausted, false);
    const aCx = anchor.x + anchor.w / 2;
    const aCy = anchor.y + anchor.h / 2;
    const pCx = placed.x + placed.w / 2;
    const pCy = placed.y + placed.h / 2;
    // Not the anchor's own cell, and clear of it (SEAT_PAD).
    assert.ok(Math.abs(pCx - aCx) > 1 || Math.abs(pCy - aCy) > 1);
    assert.ok(Math.abs(pCx - aCx) >= 280 / 2 + 280 / 2 || Math.abs(pCy - aCy) >= 180 / 2 + 180 / 2);

    const after = store.getLayerCards(['world/inn/counter.md', 'world/inn/other.md']);
    assert.deepEqual(after, before, 'already-seated cards are never re-flowed');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: concurrent seatNear calls serialize positions and z-indexes', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/counter.md', '---\ntitle: Counter\ntype: chalk\n---\n\nCounter.\n');
    await store.writeFile('world/inn/existing.md', '---\ntitle: Existing\ntype: chalk\n---\n\nExisting.\n');
    await store.writeFile('world/inn/first.md', '---\ntitle: First\ntype: chalk\n---\n\nFirst.\n');
    await store.writeFile('world/inn/second.md', '---\ntitle: Second\ntype: chalk\n---\n\nSecond.\n');
    await store.seatUnplaced('world/inn', [
      { path: 'world/inn/counter.md', w: 280, h: 180 },
      { path: 'world/inn/existing.md', w: 280, h: 180 },
    ]);

    const [first, second] = await Promise.all([
      store.seatNear(
        'world/inn',
        { path: 'world/inn/first.md', w: 280, h: 180 },
        'world/inn/counter.md'
      ),
      store.seatNear(
        'world/inn',
        { path: 'world/inn/second.md', w: 280, h: 180 },
        'world/inn/counter.md'
      ),
    ]);

    assert.notDeepEqual([first.x, first.y], [second.x, second.y]);
    assert.notEqual(first.z, second.z);
    const persisted = store.getLayerCards(['world/inn/first.md', 'world/inn/second.md']);
    assert.equal(persisted.length, 2);
    assert.notDeepEqual(
      [persisted[0].x, persisted[0].y],
      [persisted[1].x, persisted[1].y]
    );
    assert.notEqual(persisted[0].z, persisted[1].z);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§10.3: delete drops the card + its lines and does NOT touch referencing files', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    await store.writeFile(
      'world/inn/a.md',
      '---\ntitle: A\ntype: chalk\npath: world/inn/key.md\n---\n\nSee key.md.\n'
    );
    await store.writeFile('world/inn/b.md', '---\ntitle: B\ntype: chalk\n---\n\nB.\n');
    await store.upsertLink({ layer: 'world/inn', from: 'world/inn/a.md', to: 'world/inn/key.md' });
    await store.upsertLink({ layer: 'world/inn', from: 'world/inn/b.md', to: 'world/inn/key.md' });
    await store.upsertLink({ layer: 'world/inn', from: 'world/inn/a.md', to: 'world/inn/b.md' });

    const aBefore = await store.readFile('world/inn/a.md');
    const svc = service(store);
    const res = await svc.removeEntity({ path: 'world/inn/key.md' });

    assert.equal(await store.statKind('world/inn/key.md'), 'missing');
    assert.equal(res.details.name, 'Key');
    assert.ok(res.details.dangling >= 1, 'the path reference is reported dangling');
    assert.equal(await store.readFile('world/inn/a.md'), aBefore, 'referencing file byte-identical');
    assert.equal((await store.getLayerLinks('world/inn')).length, 1, 'the unrelated line survives');

    const events = await store.getEventsSince(0);
    const deleted = events.find((e) => e.type === 'entity_deleted');
    assert.ok(deleted);
    assert.equal(deleted.detail.name, 'Key');
    assert.equal(deleted.layer, 'world/inn');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------- M-4 near surfacing

test('M-4: same-layer rename + near reports nearIgnored instead of silent success', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    await store.writeFile('world/inn/counter.md', '---\ntitle: Counter\ntype: chalk\n---\n\nCounter.\n');
    await store.seatUnplaced('world/inn', [
      { path: 'world/inn/key.md', w: 280, h: 180 },
      { path: 'world/inn/counter.md', w: 280, h: 180 },
    ]);

    const svc = service(store);
    const res = await svc.moveEntity({
      from: 'world/inn/key.md',
      to: 'world/inn/rusty-key.md',
      near: 'world/inn/counter.md',
    });
    assert.equal(res.details.nearIgnored, true);
    assert.match(res.text, /ignored/i);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('M-4: seat exhaustion surfaces as details.seat.exhausted', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    // Front an entirely covered layer with one giant card so no spiral cell is free.
    store.execCanvas(
      `INSERT INTO cards (id, layer, x, y, width, height, z_index) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['world/inn/filler.md', 'world/inn', 960 - 5000, 540 - 5000, 10000, 10000, 0]
    );
    const placed = await store.seatNear(
      'world/inn',
      { path: 'world/inn/key.md', w: 280, h: 180 },
      'world/inn/filler.md'
    );
    assert.equal(placed.exhausted, true);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------- failure semantics

test('§7: move rejects README, directories, missing sources and overwrites', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    await store.writeFile('player/other.md', '---\ntitle: Other\ntype: note\n---\n\nOther.\n');
    const svc = service(store);

    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn/README.md', to: 'player/README.md' }),
      isActionError('not_movable')
    );
    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn', to: 'world/attic' }),
      isActionError('not_movable')
    );
    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn/ghost.md', to: 'player/ghost.md' }),
      isActionError('not_found')
    );
    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn/key.md', to: 'world/inn/key.md' }),
      isActionError('invalid_argument')
    );
    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn/key.md', to: 'player/other.md' }),
      isActionError('already_exists')
    );
    await assert.rejects(
      () =>
        svc.moveEntity({
          from: 'world/inn/key.md',
          to: 'world/attic/key.md',
          near: 'world/inn/other-anchor.md',
        }),
      isActionError('not_found')
    );
    await store.writeFile('world/inn/anchor.md', '---\ntitle: Anchor\ntype: chalk\n---\n\nAnchor.\n');
    await assert.rejects(
      () =>
        svc.moveEntity({
          from: 'world/inn/key.md',
          to: 'world/attic/key.md',
          near: 'world/inn/anchor.md',
        }),
      isActionError('near_out_of_layer')
    );
    await assert.rejects(
      () => svc.moveEntity({ from: '../etc/passwd', to: 'player/x.md' }),
      isActionError('invalid_path')
    );
    // A destination that is neither .md nor a layer dir is not guessed (04 §3.7).
    await assert.rejects(
      () => svc.moveEntity({ from: 'world/inn/key.md', to: 'player' }),
      isActionError('invalid_argument')
    );
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('§3.7: a layer-directory destination keeps the filename', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    const svc = service(store);
    const res = await svc.moveEntity({ from: 'world/inn/key.md', to: 'world/attic' });
    assert.equal(res.details.path, 'world/attic/key.md');
    assert.equal(await store.statKind('world/attic/key.md'), 'file');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------- eventKindOf (04 §3.3)

test('eventKindOf maps onto the closed five-value enum', () => {
  assert.equal(eventKindOf({ type: 'chalk' }, 'world/inn/a.md'), 'chalk');
  assert.equal(eventKindOf({ type: 'note' }, 'world/inn/a.md'), 'note');
  assert.equal(eventKindOf({ type: 'letter' }, 'world/inn/a.md'), 'letter');
  assert.equal(eventKindOf({ type: 'gate' }, 'world/inn/a.md'), 'component');
  assert.equal(eventKindOf({ type: 'sprite' }, 'world/inn/a.md'), 'component');
  assert.equal(eventKindOf({ type: 'readme' }, 'world/inn/README.md'), 'component');
  assert.equal(eventKindOf({ type: 'component', component: 'lock' }, 'world/inn/a.md'), 'component');
  assert.equal(eventKindOf({}, 'world/inn/a.md'), 'other');
});

test('editEntity shallow-merges frontmatter, deletes null keys, lands entity_edited', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile(
      'world/inn/a.md',
      '---\ntitle: A\ntype: chalk\ncolor: red\n---\n\nOld body.\n'
    );
    const svc = service(store);
    const res = await svc.editEntity({
      path: 'world/inn/a.md',
      frontmatter: { color: null, size: 'big' },
    });

    const raw = await store.readFile('world/inn/a.md');
    assert.equal(raw.includes('color: red'), false);
    assert.match(raw, /size: big/);
    assert.match(raw, /Old body\./);
    assert.equal(res.details.kind, 'chalk');

    const events = await store.getEventsSince(0);
    const edited = events.find((e) => e.type === 'entity_edited');
    assert.ok(edited);
    assert.equal(edited.detail.kind, 'chalk');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------- world.json reference

test('§3.6.7: a world.json string leaf equal to the moved path is rewritten', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    const manifest = JSON.parse(await store.readFile('world.json'));
    manifest.startAt = 'world/inn/key.md';
    await store.writeFile('world.json', JSON.stringify(manifest, null, 2));

    const svc = service(store);
    await svc.moveEntity({ from: 'world/inn/key.md', to: 'player/key.md' });

    const next = JSON.parse(await store.readFile('world.json'));
    assert.equal(next.startAt, 'player/key.md');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------- direct store parity

test('store.move retains its MoveResult shape with an engine actor', async () => {
  const { store, root } = await tempStore();
  try {
    await store.writeFile('world/inn/key.md', '---\ntitle: Key\ntype: note\n---\n\nKey.\n');
    const result = await store.move('world/inn/key.md', 'player/key.md');
    assert.equal(result.ok, true);
    assert.equal(result.name, 'Key');
    assert.equal(result.event.actor.type, 'engine');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the three action functions register on the action service', async () => {
  const { store, root } = await tempStore();
  try {
    const svc = service(store);
    await assert.rejects(() => svc.removeEntity({ path: 'world/inn/none.md' }), isActionError('not_found'));
    await assert.rejects(() => svc.editEntity({ path: 'world/inn/none.md' }), isActionError('not_found'));
    assert.equal(typeof moveEntity, 'function');
    assert.equal(typeof removeEntity, 'function');
    assert.equal(typeof editEntity, 'function');
  } finally {
    store.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
