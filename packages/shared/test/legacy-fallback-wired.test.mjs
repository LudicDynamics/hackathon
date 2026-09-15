/**
 * The legacy fallback is WIRED, not just implemented (`08` §10.4).
 *
 * `expandDiceOutcomes` shipped in this batch and nothing called it. That is the
 * module's whole reason for existing — 48 shipped cards declare `dice_outcomes`
 * and no `on.roll_resolved`, so an unwired fallback leaves every one of them
 * exactly where it started: a table nothing executes. Code that is correct and
 * unreachable is indistinguishable from code that is absent, and the symptom is
 * silence.
 *
 * These cases use a REAL shipped card rather than a fixture, because the point
 * is that the cards we actually ship work — a hand-written fixture would prove
 * the expansion handles a table I wrote to be handled.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LocalWorldStore, createActionService } from '../dist/index.js';
import '../dist/actions/roll-dice.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SHIPPED_CARD = path.join(REPO, 'templates/wuwu/world/harbor-chart/04-investigation-dice.md');

async function worldWithCard(cardText) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-legacy-wired-'));
  const store = new LocalWorldStore(root);
  await store.writeFile(
    'world.json',
    JSON.stringify({
      id: 'w',
      name: 'W',
      description: '',
      author: '',
      genre: 'test',
      characters: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  );
  await store.writeFile('world/README.md', '---\nname: Map\ntype: readme\n---\n\n# Map\n');
  await store.writeFile('world/harbor-chart/04-investigation-dice.md', cardText);
  return { store, root };
}

test('a shipped card with only `dice_outcomes` runs, and lands its reward', async () => {
  const card = await fs.readFile(SHIPPED_CARD, 'utf8');
  // The premise: this card has the legacy table and NO modern binding. If that
  // ever stops being true the test must be retargeted, not quietly weakened.
  assert.ok(card.includes('dice_outcomes:'), 'the shipped card must still carry the legacy table');
  assert.ok(!/^on:/m.test(card), 'the shipped card must still have no `on` block');

  const { store, root } = await worldWithCard(card);
  const svc = createActionService(store, { type: 'god' }, { turn: 'legacy-wired-1' });
  // 2d10 with `expect: ">=11"`; 3 lands in the lowest band deterministically.
  const res = await svc.rollDice({ path: 'world/harbor-chart/04-investigation-dice.md', forcedResult: 3 });

  const outcomes = res.details.commands;
  assert.ok(outcomes, 'the fallback must produce a receipt — without it the roll runs no command at all');
  assert.equal(outcomes[0].command, 'investigation-outcome');
  assert.equal(outcomes[0].settleReport.ran.length, 1, JSON.stringify(outcomes[0]));
  assert.ok(outcomes[0].settleReport.ran[0].steps > 0, 'the expanded command must run effects');

  // The reward FILE exists — the consequence reached disk, which is the only
  // claim that matters (a receipt without a file would be a report of nothing).
  const files = await fs.readdir(path.join(root, 'world/harbor-chart'));
  assert.ok(
    files.some((f) => f !== '04-investigation-dice.md'),
    `the reward must have been created, got: ${files.join(', ')}`
  );
});

test('the generated binding has no file on disk, yet must not report `command_not_found`', async () => {
  const card = await fs.readFile(SHIPPED_CARD, 'utf8');
  const { store, root } = await worldWithCard(card);
  // The premise made explicit: `command/investigation-outcome.yaml` does not exist.
  await assert.rejects(() => store.readFile('command/investigation-outcome.yaml'));

  const svc = createActionService(store, { type: 'god' }, { turn: 'legacy-wired-2' });
  const res = await svc.rollDice({ path: 'world/harbor-chart/04-investigation-dice.md', forcedResult: 3 });
  const outcome = res.details.commands[0];
  assert.notEqual(
    outcome.code,
    'command_not_found',
    'the engine created this binding; reporting its own command as missing is the failure this guards'
  );
  assert.equal(outcome.status, 'ok', JSON.stringify(outcome));
  void root;
});

test('a card with BOTH the legacy table and `on.roll_resolved` is refused, and runs nothing', async () => {
  // `08` §10.5 item 2: the explicit block is authoritative, so the table would
  // never run — declaring both is a contradiction, not a fallback case.
  const card = [
    '---',
    'type: chalk',
    'title: Both',
    'roll_dice:',
    '  type: d100',
    '  expect: "1..100"',
    'on:',
    '  roll_resolved:',
    '    - run: some-command',
    'dice_outcomes:',
    '  - min: 1',
    '    max: 50',
    '    text: low',
    '    options: []',
    '    rewards:',
    '      - path: world/harbor-chart/low.md',
    '        title: Low',
    '        body: low',
    '---',
    '',
    'Both syntaxes.',
    '',
  ].join('\n');
  const { store, root } = await worldWithCard(card);
  const svc = createActionService(store, { type: 'god' }, { turn: 'both-1' });
  const res = await svc.rollDice({ path: 'world/harbor-chart/04-investigation-dice.md', forcedResult: 3 });

  const files = await fs.readdir(path.join(root, 'world/harbor-chart'));
  assert.deepEqual(files, ['04-investigation-dice.md'], 'a contradictory card must land no effect');
  const outcome = res.details.commands?.[0];
  if (outcome !== undefined) {
    assert.equal(outcome.status, 'error', JSON.stringify(outcome));
    assert.equal(outcome.code, 'legacy_and_modern_conflict');
  }
});

test('a card with neither syntax produces no receipt at all', async () => {
  const card = [
    '---',
    'type: chalk',
    'title: Neither',
    'roll_dice:',
    '  type: d100',
    '  expect: "1..100"',
    '---',
    '',
    'Plain.',
    '',
  ].join('\n');
  const { store } = await worldWithCard(card);
  const svc = createActionService(store, { type: 'god' }, { turn: 'neither-1' });
  const res = await svc.rollDice({ path: 'world/harbor-chart/04-investigation-dice.md', forcedResult: 3 });
  assert.equal(res.details.commands, undefined, 'no declaration ⇒ no commands key');
});
