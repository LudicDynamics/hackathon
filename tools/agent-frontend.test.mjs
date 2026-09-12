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

test('character overlay consumes real frames and has no fabricated reply bank', async () => {
  const source = await fs.readFile('apps/web/src/components/overlay/CharacterModal.tsx', 'utf8');
  assert.doesNotMatch(source, /FALLBACK_REPLIES/);
  assert.match(source, /frame.characterId !== characterId/);
  for (const type of ['character_delta', 'character_message', 'character_idle', 'turn_aborted']) assert.ok(source.includes(type));
});
