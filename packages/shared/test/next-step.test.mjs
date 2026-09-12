// B2/B3 — `computeNextStep` acceptance (04 §3.1 / §3.2 / §3.3, invariants §2.1).
//
// Runs against built dist (AGENTS.md §6.5): `pnpm --filter @airp/shared build` first.
// The module is a pure function over `NextStepFacts`, so every case is a table row —
// no store, no clock, no engine.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeNextStep } from '../dist/render/next-step.js';

// 04 §3.1 / §3.2 — the frozen wording. Duplicated here ON PURPOSE: the test is what
// stops a rewording from silently changing what the agent is told.
const W_CHOICE = 'The player has just made a choice, and nothing has narrated what it led to. Answer that choice this turn before moving on.';
const W_ITEM = 'The player has just used an item on something, and no narration has reported what happened. Resolve it this turn.';
const W_ROLL = 'A dice check has just resolved, and no narration has reported the result. Report the outcome this turn.';
const W_CREATED = 'A new layer has been generated and the player has not entered it yet. Its opening is already on disk, so do not write it again; deal with the player where they are now.';
const W_QUIET = 'Nothing in the world has changed this turn and no action is owed. Respond to the player, but do not manufacture an event, a clue, or a stranger just to give the turn something to say.';
const C1 = 'Something the player did here is still unanswered. You were present for it, so react to it as yourself and in your own voice.';
const C2 = 'Things in this place changed while you were closed. You need not bring them up; you must not contradict them.';
const C3 = 'Nothing here is owed an answer right now. A short line, or saying nothing, is a real answer; do not invent a past that did not happen to fill the silence.';

/** Minimal `NextStepEvent` (a projection of 03's `EventWindowLine`). */
const ev = (type, actor = { type: 'player' }, layer = null) => ({ type, layer, actor });

/** Facts with the shape 01 builds; overrides applied last. */
const facts = (over = {}) => ({
  role: 'writer',
  events: [],
  currentLayer: 'street',
  unseenCreation: false,
  quiet: true,
  ...over,
});

// -------------------------------------------------------------------- §3.1 writer

test('04 §3.1: writer case 1 — the three interactive tails pick their own wording', () => {
  const cases = [
    ['choice_selected', W_CHOICE],
    ['use_item_on', W_ITEM],
    ['roll_resolved', W_ROLL],
  ];
  for (const [type, expected] of cases) {
    assert.equal(
      computeNextStep(facts({ events: [ev(type)], quiet: false })),
      expected,
      `${type} tail must yield its own sentence`,
    );
  }
});

test('04 §3.1 (A-12): a writer-authored interactive tail never fires case 1', () => {
  // `roll_dice` sits on the writer's tool surface (extensions/tools.ts:55), so the
  // writer can author a `roll_resolved` itself. Reading it as "the player acted"
  // would tell the writer to answer its own action.
  for (const type of ['choice_selected', 'use_item_on', 'roll_resolved']) {
    const out = computeNextStep(facts({ events: [ev(type, { type: 'writer' })], quiet: false }));
    assert.equal(out, '', `${type} authored by the writer must not fire case 1`);
  }
});

test('04 §3.1: the tail alone decides — an interactive type earlier in the window does not fire', () => {
  const events = [ev('choice_selected'), ev('entity_moved')];
  assert.equal(computeNextStep(facts({ events, quiet: false })), '', 'case 1 reads the TAIL, not any member');
});

test('04 §3.1: writer case 2 — unseenCreation, and it outranks quiet', () => {
  assert.equal(computeNextStep(facts({ unseenCreation: true, quiet: false })), W_CREATED);
  // 00 §8 enumerates case 2 before quiet; a corrupt pair must still prefer case 2.
  assert.equal(computeNextStep(facts({ unseenCreation: true, quiet: true })), W_CREATED);
});

test('04 §2.2 / 00 §11: an unknown currentLayer suppresses case 2 (silence beats a wrong imperative)', () => {
  assert.equal(computeNextStep(facts({ unseenCreation: true, currentLayer: null, quiet: false })), '');
});

test('04 §3.1: writer case 3 — quiet', () => {
  assert.equal(computeNextStep(facts({ quiet: true })), W_QUIET);
});

test('04 §3.1 case 4 / §6.3: changes that are not one of the three soften to no section', () => {
  const rows = [
    ['entity_moved'],
    ['layer_entered'],
    ['character_talked'],
    ['world_rolled_back'],
    ['following_changed'],
    ['a_type_from_the_future'], // whitelist, not blacklist: new types stay silent (§6.1)
  ];
  for (const [type] of rows) {
    assert.equal(
      computeNextStep(facts({ events: [ev(type)], quiet: false, currentLayer: 'street' })),
      '',
      `${type} tail must not fire a writer imperative`,
    );
  }
});

test('04 §3.2 (A-14): character C2 keys on events.length, not unseenCreation', () => {
  // The dynamics window is layer-filtered and self-excluded, so ANY surviving line is
  // "this changed here while you were closed, and it was not you". Gating C2 on
  // unseenCreation would make it unreachable for writer-authored edits.
  assert.equal(computeNextStep(facts({ role: 'character', events: [ev('entity_edited')], quiet: false })), C2);
  assert.equal(computeNextStep(facts({ role: 'character', events: [ev('a_type_from_the_future')], quiet: false })), C2);
});

test('04 §3.2: character C1 fires on a non-writer interactive tail and outranks C2', () => {
  const out = computeNextStep(facts({ role: 'character', events: [ev('choice_selected'), ev('choice_selected')], quiet: false }));
  assert.equal(out, C1, 'an interactive tail outranks "things changed"');
  assert.equal(
    computeNextStep(facts({ role: 'character', events: [ev('roll_resolved', { type: 'writer' })] })),
    C2,
    'writer-authored tail falls through to C2',
  );
});

test('04 §3.2: character C3 is the default and is never empty', () => {
  assert.equal(computeNextStep(facts({ role: 'character', events: [], quiet: true })), C3);
  // §6.1: a corrupt fact (no events but quiet === false) degrades to C3, never throws.
  assert.equal(computeNextStep(facts({ role: 'character', events: [], quiet: false })), C3);
});

test('04 §6.1: a corrupt writer fact degrades to the absent section, never throws', () => {
  assert.equal(computeNextStep(facts({ events: [], quiet: false })), '');
  assert.equal(computeNextStep({ role: 'writer' }), '', 'missing fields are tolerated');
  assert.equal(computeNextStep({ role: 'character' }), C3, 'missing fields still owe the character a default');
});

// ---------------------------------------------------------------- §2.1 invariants

test('04 §2.1: pure — identical facts give an identical string', () => {
  const f = facts({ events: [ev('use_item_on')], quiet: false });
  const snapshot = JSON.stringify(f);
  assert.equal(computeNextStep(f), computeNextStep(f));
  assert.equal(JSON.stringify(f), snapshot, 'facts must not be mutated');
});

test('04 §6.1: the output never embeds a `name` — it is fixed prose', () => {
  const named = { ...ev('choice_selected'), name: 'Morgan' };
  const sections = [
    computeNextStep(facts({ events: [named], quiet: false })),
    computeNextStep(facts({ unseenCreation: true, quiet: false })),
    computeNextStep(facts({ quiet: true })),
    computeNextStep(facts({ role: 'character', events: [named] })),
    computeNextStep(facts({ role: 'character' })),
  ];
  for (const text of sections) assert.ok(!text.includes('Morgan'), 'a name must never reach the imperative');
});
