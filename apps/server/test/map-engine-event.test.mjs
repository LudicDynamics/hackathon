/**
 * docs/tools/12 §10.1 — `mapEngineEvent` frame-mapping acceptance tests.
 *
 * The function is deliberately pure (no I/O, no WS), so each case builds a
 * `JsonAgentSessionEvent` literal and asserts the frames. `timestamp` is added
 * by `push` and is the only time dependency, so assertions ignore it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapEngineEvent, messageText } from '../dist/engine/event-bridge.js';

/** Strip the broadcast timestamp so a frame compares structurally. */
function frames(source, event, args = new Map(), characterId = undefined) {
  return mapEngineEvent(source, event, args, characterId).map(({ timestamp: _t, ...rest }) => rest);
}

test('chalk_landed reads details.path (the frozen shape) and result.path (legacy)', () => {
  const end = (result, args) => {
    const toolArgs = new Map([['c1', args]]);
    return frames('writer', {
      type: 'tool_execution_end',
      toolCallId: 'c1',
      toolName: 'chalk',
      result,
      isError: false,
    }, toolArgs);
  };

  // details.path wins when args carry no path (chalk's default naming).
  const fromDetails = end({ content: [], details: { path: 'world/baker-street/01-x.md' } }, {});
  const landedDetails = fromDetails.find((f) => f.type === 'chalk_landed');
  assert.equal(landedDetails.path, 'world/baker-street/01-x.md');

  // Legacy flat result.path is still honoured.
  const fromFlat = end({ path: 'y.md', content: [], details: {} }, {});
  assert.equal(fromFlat.find((f) => f.type === 'chalk_landed').path, 'y.md');

  // Tool args take precedence (what `write` targeted).
  const fromArgs = end({ content: [], details: { path: 'z.md' } }, { path: 'w.md' });
  assert.equal(fromArgs.find((f) => f.type === 'chalk_landed').path, 'w.md');
});

test('canvas_patched carries layer/kind/action/links/cards from details', () => {
  const out = frames('writer', {
    type: 'tool_execution_end',
    toolCallId: 'c2',
    toolName: 'arrange',
    result: {
      content: [],
      details: {
        kind: 'cards',
        action: 'laid-out',
        layer: 'world/inn',
        cards: [{ path: 'world/inn/a.md', x: 1, y: 2, z: 3 }],
      },
    },
    isError: false,
  }, new Map());

  const patched = out.find((f) => f.type === 'canvas_patched');
  assert.equal(patched.layer, 'world/inn');
  assert.equal(patched.kind, 'cards');
  assert.equal(patched.action, 'laid-out');
  assert.deepEqual(patched.cards, [{ path: 'world/inn/a.md', x: 1, y: 2, z: 3 }]);
  assert.equal(patched.links, undefined);
});

test('roll_dice emits the dice_result PRESENTATION frame with the frozen fields', () => {
  const details = {
    path: 'world/inn/lock.md',
    name: 'Rusted Lock',
    dice: '1d100',
    desc: 'Pick the lock',
    expect: '>50',
    result: 62,
    passed: true,
    rolls: [62],
    crit: false,
    fumble: false,
    layer: 'world/inn',
  };
  const out = frames('writer', {
    type: 'tool_execution_end',
    toolCallId: 'c3',
    toolName: 'roll_dice',
    result: { content: [], details },
    isError: false,
  }, new Map());

  const dice = out.find((f) => f.type === 'dice_result');
  assert.deepEqual(dice, { type: 'dice_result', source: 'writer', ...details });
  // The event type it mirrors is NOT a frame name (00 §5.3).
  assert.equal(out.some((f) => f.type === 'roll_resolved'), false);
});

test('roll_dice failure emits no dice_result', () => {
  const out = frames('character', {
    type: 'tool_execution_end',
    toolCallId: 'c4',
    toolName: 'roll_dice',
    result: { content: [], details: {} },
    isError: true,
  }, new Map());
  assert.equal(out.some((f) => f.type === 'dice_result'), false);
});

test('show broadcasts details.frame verbatim, and warns (zero frames) when absent', () => {
  const frame = { type: 'show_frame', component: 'sparkle', target: 'world/x.md' };
  const withFrame = frames('writer', {
    type: 'tool_execution_end',
    toolCallId: 'c5',
    toolName: 'show',
    result: { content: [], details: { frame } },
    isError: false,
  }, new Map());
  assert.deepEqual(withFrame.find((f) => f.type === 'show_frame'), frame);

  const originalWarn = console.warn;
  let warned = 0;
  console.warn = () => { warned += 1; };
  try {
    const without = frames('writer', {
      type: 'tool_execution_end',
      toolCallId: 'c6',
      toolName: 'show',
      result: { content: [], details: {} },
      isError: false,
    }, new Map());
    assert.equal(without.some((f) => f.type === 'show_frame'), false);
    assert.equal(warned, 1, 'a missing frame is warned about, never faked');
  } finally {
    console.warn = originalWarn;
  }
});

test('generate_image streams progress and announces the landed asset', () => {
  const progress = frames('writer', {
    type: 'tool_execution_update',
    toolCallId: 'g1',
    toolName: 'generate_image',
    args: {},
    partialResult: { details: { stage: 'painting', elapsedMs: 4200, width: 1024, height: 1024 } },
  }, new Map());
  assert.deepEqual(progress, [
    {
      type: 'image_generation_progress',
      source: 'writer',
      toolCallId: 'g1',
      stage: 'painting',
      elapsedMs: 4200,
      width: 1024,
      height: 1024,
    },
  ]);

  const landed = frames('writer', {
    type: 'tool_execution_end',
    toolCallId: 'g1',
    toolName: 'generate_image',
    result: {
      content: [],
      details: { asset: '.airpworld/assets/gen/x.png', mimeType: 'image/png', width: 1024, height: 1024, reused: false },
    },
    isError: false,
  }, new Map());
  const img = landed.find((f) => f.type === 'image_landed');
  assert.equal(img.asset, '.airpworld/assets/gen/x.png');
  assert.equal(img.mimeType, 'image/png');
  assert.equal(img.reused, false);
});

test('a non-streaming tool_execution_update maps to zero frames', () => {
  const out = frames('writer', {
    type: 'tool_execution_update',
    toolCallId: 'm1',
    toolName: 'move',
    args: {},
    partialResult: {},
  }, new Map());
  assert.deepEqual(out, []);
});

test('message_update / message_end keep their existing mapping', () => {
  assert.deepEqual(
    frames('character', {
      type: 'message_update',
      usage: { input: 0, output: 0 },
      assistantMessageEvent: { type: 'text_delta', delta: 'hi' },
    }, new Map()),
    [{ type: 'character_delta', source: 'character', delta: 'hi' }]
  );

  const end = frames('writer', {
    type: 'message_end',
    message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
  }, new Map());
  assert.deepEqual(end, [{ type: 'writer_message', source: 'writer', text: 'done' }]);
  assert.equal(messageText({ content: [{ type: 'thinking', text: 'x' }, { type: 'text', text: 'y' }] }), 'y');
});

test('A1: character frames carry characterId; writer frames do not', () => {
  const delta = {
    type: 'message_update',
    usage: { input: 0, output: 0 },
    assistantMessageEvent: { type: 'text_delta', delta: 'hi' },
  };
  const idle = { type: 'agent_settled' };

  // Character source + id: every produced frame is stamped.
  assert.deepEqual(frames('character', delta, new Map(), 'nanami'), [
    { type: 'character_delta', source: 'character', delta: 'hi', characterId: 'nanami' },
  ]);
  assert.deepEqual(frames('character', idle, new Map(), 'nanami'), [
    { type: 'character_idle', source: 'character', characterId: 'nanami' },
  ]);

  // Writer source: no id is threaded, so no field is added.
  assert.deepEqual(frames('writer', { ...delta }, new Map()), [
    { type: 'writer_delta', source: 'writer', delta: 'hi' },
  ]);

  // Character source WITHOUT an id (legacy / empty clientKey): field omitted,
  // not present as '' or null — the frontend's `??` fallback depends on it.
  assert.deepEqual(frames('character', { ...delta }, new Map()), [
    { type: 'character_delta', source: 'character', delta: 'hi' },
  ]);
});
