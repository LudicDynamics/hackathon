// Character rail tests (docs/presence/03 §10).
//
// Two real layers plus one source-level layer:
//   1. `railEntry` — the pure judgment (contract §2.2), driven directly.
//   2. A real render — the component is bundled with esbuild and rendered with
//      react-dom/server, so the DOM tree, ARIA attributes, tone classes and
//      ordering are asserted against actual output, not a description of it.
//   3. Source-level contracts — the repository has no jsdom (per §10.3 the
//      interactive assertions degrade to source contracts + browser smoke, run
//      by the integrator). A bad implementation still fails these.
//
// Run: node --test apps/web/test/character-rail.test.mjs
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import { railEntry } from '../src/lib/character-rail.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');
const require = createRequire(pathToFileURL(path.join(webRoot, 'test/x.mjs')));

const view = (over = {}) => ({
  id: 'watson',
  name: 'Watson',
  state: 'in-scene',
  layer: 'world/a',
  following: false,
  position: { x: 10, y: 20 },
  arrivedByFollow: false,
  ...over,
});

/* ------------------------------ 1. railEntry ------------------------------ */

test('UF-0: the three states map to canTalk/tone, and following never changes them', () => {
  const inScene = railEntry(view({ state: 'in-scene' }));
  const elsewhere = railEntry(view({ state: 'elsewhere' }));
  const absent = railEntry(view({ state: 'absent' }));

  assert.equal(inScene.canTalk, true);
  assert.equal(inScene.tone, 'full');
  assert.equal(elsewhere.canTalk, false);
  assert.equal(elsewhere.tone, 'muted');
  assert.equal(absent.canTalk, false);
  assert.equal(absent.tone, 'muted');

  // Status labels must stay distinct — collapsing to two tiers is the failure.
  assert.equal(inScene.statusKey, 'In this scene');
  assert.equal(elsewhere.statusKey, 'Elsewhere');
  assert.equal(absent.statusKey, 'Not here');
  assert.notEqual(elsewhere.statusKey, absent.statusKey);

  for (const state of ['in-scene', 'elsewhere', 'absent']) {
    const base = railEntry(view({ state, following: false }));
    const following = railEntry(view({ state, following: true }));
    assert.equal(following.canTalk, base.canTalk);
    assert.equal(following.tone, base.tone);
    assert.equal(following.statusKey, base.statusKey);
  }
});

test('UF-0 (travel): absent cannot travel, elsewhere and in-scene can', () => {
  assert.equal(railEntry(view({ state: 'absent' })).canTravel, false);
  assert.equal(railEntry(view({ state: 'elsewhere' })).canTravel, true);
  assert.equal(railEntry(view({ state: 'in-scene' })).canTravel, true);
});

test('UF-1a: the follow label flips with the projection, never hardcoded', () => {
  assert.equal(railEntry(view({ following: false })).followActionKey, 'Follow');
  assert.equal(railEntry(view({ following: true })).followActionKey, 'Dismiss');
  assert.equal(railEntry(view({ following: true })).followedByPlayer, true);
});

test('UF-2b (hint): a non-in-scene view yields a talk hint, in-scene yields none', () => {
  assert.equal(railEntry(view({ state: 'in-scene' })).talkHintKey, null);
  assert.equal(railEntry(view({ state: 'absent' })).talkHintKey, 'They are not here right now.');
  assert.equal(
    railEntry(view({ state: 'elsewhere' })).talkHintKey,
    'They are in another scene. Go to them instead.',
  );
});

/* --------------------------- 2. real rendering ---------------------------- */

let CharacterRail = null;
let React = null;
let renderToStaticMarkup = null;
try {
  const esbuild = require(
    path.join(repoRoot, 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js')
  );
  React = await import('react');
  ({ renderToStaticMarkup } = await import('react-dom/server'));

  const out = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/components/sidebar/CharacterRail.tsx')],
    bundle: true,
    write: false,
    format: 'esm',
    jsx: 'automatic',
    // `react` (and its JSX runtime) stays external so the renderer shares our
    // instance; `.css` is erased so no stylesheet output is required.
    external: ['react', 'react/jsx-runtime'],
    loader: { '.css': 'empty' },
    platform: 'node',
    absWorkingDir: webRoot,
  });
  const cacheDir = path.join(webRoot, 'node_modules/.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const dir = fs.mkdtempSync(path.join(cacheDir, 'airp-rail-'));
  const file = path.join(dir, 'CharacterRail.mjs');
  const js = out.outputFiles.find(f => f.path.endsWith('.js') || f.path.endsWith('.mjs')) ?? out.outputFiles[0];
  fs.writeFileSync(file, js.text, 'utf-8');
  ({ CharacterRail } = await import(pathToFileURL(file).href));
  fs.rmSync(dir, { recursive: true, force: true });
} catch (err) {
  console.error('rail render bootstrap unavailable, skipping render group:', err?.message ?? err);
}
const skip = CharacterRail ? false : 'esbuild/react unavailable';

const noop = () => {};
const render = (views, over = {}) => renderToStaticMarkup(
  React.createElement(CharacterRail, {
    views,
    pendingFollowing: new Set(),
    nookOpen: false,
    onOpenCharacter: noop,
    onTravelTo: noop,
    onToggleFollowing: noop,
    onOpenNook: noop,
    notify: noop,
    ...over,
  }),
);
// Count occurrences of a literal in the markup.
const count = (str, needle) => str.split(needle).length - 1;

test('UF-7b (non-emptiness): a non-in-scene avatar is not offered as a talk target', { skip }, () => {
  const inScene = render([view({ id: 'a', name: 'Alpha', state: 'in-scene' })]);
  const absent = render([view({ id: 'b', name: 'Beta', state: 'absent' })]);

  // The talk affordance (aria-label `Talk to {name}`) only exists for in-scene.
  assert.match(inScene, /aria-label="Talk to Alpha"/);
  assert.doesNotMatch(absent, /Talk to Beta/);
  // ...but the row still renders and still names the character.
  assert.match(absent, /Beta/);
});

test('UF-3a (non-emptiness): all three keys are always in the DOM, even for absent', { skip }, () => {
  const html = render([view({ state: 'absent', layer: null, position: null })]);
  assert.match(html, />Go to them</);
  assert.match(html, />Follow</);
  assert.match(html, />Visit their ikigai</);
  // Not a conditional-mount tier: exactly three action buttons exist in markup
  // (anchored on the button class so the `character-rail__actions` wrapper, whose
  // name contains the same prefix, is not miscounted).
  assert.equal(count(html, 'class="character-rail__action"'), 3);
});

test('UF-1a (render): the follow label follows the projection', { skip }, () => {
  assert.match(render([view({ following: false })]), />Follow</);
  assert.doesNotMatch(render([view({ following: false })]), />Dismiss</);
  assert.match(render([view({ following: true })]), />Dismiss</);
  assert.match(render([view({ following: true })]), /· Following you</);
});

test('three-state visuals: full colour only for in-scene; muted for the rest', { skip }, () => {
  assert.match(render([view({ state: 'in-scene' })]), /character-rail__orb--full/);
  assert.doesNotMatch(render([view({ state: 'in-scene' })]), /character-rail__orb--muted/);
  assert.match(render([view({ state: 'elsewhere' })]), /character-rail__orb--muted/);
  assert.match(render([view({ state: 'absent' })]), /character-rail__orb--muted/);
});

test('the follow icon appears only while following', { skip }, () => {
  assert.match(render([view({ following: true })]), /character-rail__follow-dot/);
  assert.doesNotMatch(render([view({ following: false })]), /character-rail__follow-dot/);
});

test('UF-7a (structure): the expander is independent, collapsed, and wired to its keys', { skip }, () => {
  const html = render([view({ id: 'watson' })]);
  // Collapsed by default, with aria-controls pointing at the action group id.
  assert.match(html, /aria-expanded="false"[^>]*aria-controls="character-actions-watson"/s);
  assert.match(html, /id="character-actions-watson"/);
  // The expander is its own control, not the avatar: a distinct aria-label.
  assert.match(html, /aria-label="Actions for Watson"/);
  // The avatar carries the talk label, the expander the actions label.
  assert.match(html, /aria-label="Talk to Watson"/);
  assert.notEqual(
    html.indexOf('aria-label="Talk to Watson"'),
    html.indexOf('aria-label="Actions for Watson"'),
  );
});

test('UF-7b: every action label is distinct and carries the character name', { skip }, () => {
  const html = render([
    view({ id: 'a', name: 'Alpha', state: 'in-scene' }),
    view({ id: 'b', name: 'Beta', state: 'elsewhere', layer: 'world/b' }),
  ]);
  // Two rows, so a bare `Follow` would collide; the aria-label must differ.
  assert.notEqual(
    html.indexOf('aria-label="Follow · Alpha"'),
    html.indexOf('aria-label="Follow · Beta"'),
  );
  assert.match(html, /aria-label="Follow · Alpha"/);
  assert.match(html, /aria-label="Follow · Beta"/);
  assert.match(html, /aria-label="Go to them · Beta"/);
  assert.match(html, /aria-label="Visit their ikigai · Beta"/);
});

test('UF-7c: rows render in the given array order, never re-sorted', { skip }, () => {
  const html = render([
    view({ id: 'b', name: 'Beta', state: 'absent', layer: null, position: null }),
    view({ id: 'a', name: 'Alpha', state: 'in-scene' }),
    view({ id: 'c', name: 'Gamma', state: 'elsewhere', layer: 'world/c' }),
  ]);
  const order = ['character-actions-b', 'character-actions-a', 'character-actions-c']
    .map(id => html.indexOf(id));
  assert.ok(order[0] < order[1] && order[1] < order[2], 'rows must keep the projection order');
});

test('UF-4: the nook key is offered regardless of presence state, disabled while a nook is open', { skip }, () => {
  for (const state of ['in-scene', 'elsewhere', 'absent']) {
    assert.match(render([view({ state })]), />Visit their ikigai</, `${state} must keep the nook key`);
  }
  const open = render([view({ state: 'in-scene' })], { nookOpen: true });
  assert.match(open, /Visit their ikigai/);
  assert.match(open, /disabled=""/);
});

test('an in-flight follow request is marked busy and blocks the button', { skip }, () => {
  const html = render([view({ id: 'watson' })], { pendingFollowing: new Set(['watson']) });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /character-rail__action--pending/);
});

test('P-19 spirit: no `.object` class reaches the rail markup', { skip }, () => {
  const html = render([view({ state: 'in-scene' }), view({ id: 'z', state: 'absent', layer: null, position: null })]);
  assert.doesNotMatch(html, /class="[^"]*\bobject\b/);
  // And the root reuses the existing positioning container.
  assert.match(html, /class="prototype-residents prototype-chrome character-rail"/);
});

/* ------------------------ 3. source-level contracts ----------------------- */

const railSource = await readFile(new URL('../src/components/sidebar/CharacterRail.tsx', import.meta.url), 'utf8');
const railCss = await readFile(new URL('../src/components/sidebar/character-rail.css', import.meta.url), 'utf8');

test('UF-1b: the follow truth is never stored locally', () => {
  // Exactly one `useState`, and it is the expander set — never a follow value.
  assert.equal((railSource.match(/useState</g) ?? []).length, 1);
  assert.match(railSource, /useState<ReadonlySet<string>>/);
  assert.doesNotMatch(railSource, /useState[^\n]*following/i);
  assert.doesNotMatch(railSource, /setFollowing\s*=/);
  assert.doesNotMatch(railSource, /localStorage/);
});

test('UF-2 / P-20: the avatar talks only in-scene; otherwise it only hints', () => {
  // The click must branch on `canTalk` and, when false, notify the talk hint.
  assert.match(railSource, /if \(entry\.canTalk\) onOpenCharacter\(view\.id\)/);
  assert.match(railSource, /else if \(entry\.talkHintKey\) notify\(t\(entry\.talkHintKey\)\)/);
  // Travel is handed to the single notifier (navigateTo), never notified here (P-20).
  assert.match(railSource, /onClick=\{\(\) => onTravelTo\(view\.id\)\}/);
  assert.doesNotMatch(railSource, /notify\(t\('They are not here right now\.'\)\)/);
});

test('UF-7a (behavior): the expander toggles the same state `aria-expanded` reads', () => {
  assert.match(railSource, /useState<ReadonlySet<string>>/);
  assert.match(railSource, /aria-expanded=\{isExpanded\}/);
  assert.match(railSource, /aria-controls=\{actionsId\}/);
  assert.match(railSource, /if \(next\.has\(id\)\) next\.delete\(id\);\s*else next\.add\(id\);/);
  // The expander is a separate button from the avatar (two distinct onClick).
  assert.match(railSource, /onClick=\{\(\) => toggleExpanded\(view\.id\)\}/);
});

test('the follow toggle sends the computed terminal state, not a toggle', () => {
  assert.match(railSource, /onToggleFollowing\(view\.id, !view\.following\)/);
});

test('no left/top animation and no new z-index: motion stays transform/opacity', () => {
  assert.doesNotMatch(railCss, /transition:\s*(left|top|all)\b/);
  assert.doesNotMatch(railCss, /z-index:/);
  assert.doesNotMatch(railCss, /\bposition:\s*(left|top)/);
});

test('the rail never reads useWorld / fetches / listens to world events', () => {
  // The doc comment names `useWorld` to say it does NOT use it, so assert on
  // real usages (import / call / listener), not on the bare word.
  assert.doesNotMatch(railSource, /import[^\n]*useWorld/);
  assert.doesNotMatch(railSource, /useWorld\(/);
  assert.doesNotMatch(railSource, /fetch\(/);
  assert.doesNotMatch(railSource, /airp:world-event/);
  assert.doesNotMatch(railSource, /airp:follow-failed/);
});

/* --------------------------- 4. old-entry cleanup ------------------------- */

test('UF-5: the dead RightSidebar is gone', async () => {
  await assert.rejects(
    stat(new URL('../src/components/sidebar/RightSidebar.tsx', import.meta.url)),
    /ENOENT/,
  );
});

test('UF-5: the legacy orphan keys are gone from UI_COPY', async () => {
  const copy = await readFile(new URL('../src/lib/legacy-ui-copy.ts', import.meta.url), 'utf8');
  for (const key of ['locate', 'talk', 'follow', 'following', 'at', 'unknown']) {
    assert.doesNotMatch(copy, new RegExp(`^\\s+${key}:`, 'm'), `orphan key "${key}" must be removed`);
  }
});
