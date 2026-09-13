import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/agent-activity.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { emptyActivity, reduceActivity, safeActivityText } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const frame = (type, extra = {}) => ({ type, source: 'writer', ...extra });
const start = (id = 'a', extra = {}) => frame('tool_start', { toolCallId: id, toolName: 'read', args: { path: 'player/fax-draft.md' }, ...extra });
const end = (id = 'a', extra = {}) => frame('tool_end', { toolCallId: id, toolName: 'read', isError: false, ...extra });

test('start is only an attempt; success and persisted changes are distinct', () => {
  let state = reduceActivity(emptyActivity(), start());
  assert.equal(state.entries[0].state, 'running');
  assert.equal(state.completed, 0); assert.equal(state.changes, 0);
  state = reduceActivity(state, end());
  assert.equal(state.entries[0].state, 'done'); assert.equal(state.completed, 1);
  const event = { type: 'world_event', event: { id: 'saved-a', actor: { type: 'writer' }, type: 'entity_created', detail: { path: 'player/fax-draft.md' } } };
  state = reduceActivity(state, event); state = reduceActivity(state, event);
  assert.equal(state.changes, 1); assert.equal(state.entries.length, 2);
  state = reduceActivity(state, frame('writer_idle'));
  assert.equal(state.writerPhase, 'settled');
});

test('abort retains completed work and idle cannot overwrite interruption with success', () => {
  let state = reduceActivity(reduceActivity(emptyActivity(), start()), end());
  state = reduceActivity(state, start('b'));
  state = reduceActivity(state, frame('error', { message: 'Operation aborted' }));
  state = reduceActivity(state, frame('writer_idle'));
  assert.equal(state.writerPhase, 'interrupted'); assert.equal(state.completed, 1);
  assert.equal(state.entries[0].state, 'done'); assert.equal(state.entries[1].state, 'interrupted');
});

test('failed and duplicate tool endings never inflate success counts', () => {
  let state = reduceActivity(emptyActivity(), start());
  state = reduceActivity(state, end('a', { isError: true })); state = reduceActivity(state, end());
  assert.equal(state.completed, 0); assert.equal(state.entries[0].state, 'failed');
});

test('only safe targets and public closing text are visible, never args or reasoning', () => {
  let state = reduceActivity(emptyActivity(), start('a', { args: { path: '/private/dev/game/world/scene/README.md', content: 'PRIVATE BODY', apiKey: 'SECRET' } }));
  assert.equal(state.entries[0].target, 'world/scene/README.md');
  state = reduceActivity(state, start('b', { args: { path: '/private/dev/.env.local' } }));
  assert.equal(state.entries[1].target, undefined);
  state = reduceActivity(state, frame('thinking_delta', { text: 'PRIVATE REASONING' }));
  assert.doesNotMatch(JSON.stringify(state), /PRIVATE|SECRET|\.env/);
  assert.equal(safeActivityText('Bearer test-token sk-example-redact'), 'Bearer [redacted] [redacted]');
});

test('character tools are labeled separately and do not complete a writer turn', () => {
  let state = reduceActivity(emptyActivity(), start('c', { source: 'character', characterId: 'ryo-child' }));
  state = reduceActivity(state, end('c', { source: 'character', characterId: 'ryo-child' }));
  assert.equal(state.entries[0].actor, 'Character: ryo-child');
  assert.equal(state.completed, 0); assert.equal(state.writerPhase, 'idle');
});

test('recent steps are bounded; a new world has a fresh state', () => {
  let state = emptyActivity();
  for (let i = 0; i < 110; i++) state = reduceActivity(state, start(String(i)));
  assert.equal(state.entries.length, 80); assert.equal(emptyActivity().entries.length, 0);
});

test('hint toggle hides Continue and hints prepare an explicit request without sending', () => {
  const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(read('../src/components/WriterResult.tsx'), /hintsEnabled && onContinue/);
  assert.match(read('../src/components/TtsSettings.tsx'), /role="switch" checked=\{hintsEnabled\}/);
  assert.match(read('../src/App.tsx'), /onContinue=\{manifest \? \(\) => prepareWriter\(t\(PLAY_HINT_REQUEST\)\) : undefined\}/);
  const hints = read('../src/lib/play-hints.ts');
  assert.match(hints, /localStorage.setItem\(KEY/);
  assert.match(hints, /Do not reveal undiscovered answers/);
  assert.match(hints, /Only write or update one short hint Chalk/);
  const copy = JSON.parse(read('../src/lib/messages.json'));
  assert.ok(copy['Show Continue / next-step hints'].ja);
  assert.ok(copy['Agent activity']['zh-CN']);
});
