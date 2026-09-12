import test from 'node:test';
import assert from 'node:assert/strict';
import { initialShell, transitionShell, splitCharacters, separateBounds } from '../apps/web/src/lib/ui-shell.mjs';

test('entry has closed header and journal with player controls visible', () => {
  assert.deepEqual(initialShell, { header: false, journal: false, immersive: false });
});

test('header and journal toggle independently', () => {
  const header = transitionShell(initialShell, 'header');
  assert.deepEqual(header, { header: true, journal: false, immersive: false });
  const both = transitionShell(header, 'journal');
  assert.equal(both.header, true);
  assert.equal(both.journal, true);
  assert.equal(transitionShell(both, 'header').journal, true);
});

test('immersion hides everything and restoring does not force the journal open', () => {
  const hidden = transitionShell(transitionShell(initialShell, 'journal'), 'immersion');
  assert.deepEqual(hidden, { header: false, journal: false, immersive: true });
  assert.deepEqual(transitionShell(hidden, 'immersion'), initialShell);
});

test('companions and encountered people are disjoint; unknown people stay out of the tray', () => {
  const people = [{ id: 'vera', role: 'companion' }, { id: 'mo', role: 'npc' }, { id: 'kite', role: 'npc' }];
  const result = splitCharacters(people, ['vera', 'mo']);
  assert.deepEqual(result.resident.map(p => p.id), ['vera']);
  assert.deepEqual(result.encountered.map(p => p.id), ['mo']);
});

test('measured narration including choices cannot be covered by a lower card', () => {
  const source = [{ x: 0, y: 0, w: 400, h: 480 }, { x: 80, y: 220, w: 240, h: 160 }, { x: 600, y: 30, w: 200, h: 100 }];
  const result = separateBounds(source);
  assert.ok(result[1].y >= result[0].y + result[0].h + 30);
  assert.deepEqual(result[2], source[2]);
  assert.equal(source[1].y, 220);
});
