import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { EventBridge, mapEngineEvent } from '../apps/server/dist/engine/event-bridge.js';

test('character frames retain their identity and model failures are visible', () => {
  const frames = [];
  const bridge = new EventBridge();
  bridge.setWss({ clients: [{ readyState: 1, send: text => frames.push(JSON.parse(text)) }] });
  bridge.emitEngine('character', { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Hello' } }, 'nanami');
  assert.equal(frames[0].characterId, 'nanami');
  assert.equal(frames[0].delta, 'Hello');
  const error = mapEngineEvent('character', { type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: 'Model unavailable' } }, new Map());
  assert.equal(error[0].type, 'error');
  assert.equal(error[0].message, 'Model unavailable');
});

test('character overlay consumes routed frames without a fabricated reply bank', async () => {
  const modal = await fs.readFile('apps/web/src/components/overlay/CharacterModal.tsx', 'utf8');
  const app = await fs.readFile('apps/web/src/App.tsx', 'utf8');
  const world = await fs.readFile('apps/web/src/state/useWorld.ts', 'utf8');
  assert.doesNotMatch(modal, /FALLBACK_REPLIES/);
  assert.doesNotMatch(modal, /airp:agent-frame|airp:character-frame/);
  assert.match(app, /msg\.characterId !== activeId/);
  assert.match(app, /frameQueue\.enqueue/);
  for (const type of ['character_delta', 'character_message', 'character_idle', 'turn_aborted']) assert.ok(world.includes(type));
});
test('interactive writer defaults to low thinking with an explicit override', async () => {
  const launch = await fs.readFile('apps/server/src/engine/launch.ts', 'utf8');
  assert.match(launch, /'--thinking', process\.env\.AIRP_WRITER_THINKING \|\| 'low'/);
});
