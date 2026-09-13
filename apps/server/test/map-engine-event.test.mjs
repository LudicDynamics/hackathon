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
function frames(source, event, args = new Map(), characterId = undefined, buf = new Map(), turnId = `orphan:${source}`, projector = undefined) {
  return mapEngineEvent(source, event, args, characterId, buf, turnId, projector).map(({ timestamp: _t, ...rest }) => rest);
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

  // Writer source + text_delta: NO frame (docs/perform/00 §3 — the writer's
  // narration is the chalk tool's `content`, never its text reply).
  assert.deepEqual(frames('writer', { ...delta }, new Map()), []);

  // Character source WITHOUT an id (legacy / empty clientKey): field omitted,
  // not present as '' or null — the frontend's `??` fallback depends on it.
  assert.deepEqual(frames('character', { ...delta }, new Map()), [
    { type: 'character_delta', source: 'character', delta: 'hi' },
  ]);
});

test('writer_delta comes from chalk toolcall fragments, not text_delta', () => {
  const buf = new Map();
  const delta = (d, contentIndex = 0) => ({
    type: 'message_update',
    usage: { input: 0, output: 0 },
    assistantMessageEvent: { type: 'toolcall_delta', contentIndex, delta: d },
  });
  const endCall = (name, args, id = 'tc1', contentIndex = 0) => ({
    type: 'message_update',
    usage: { input: 0, output: 0 },
    assistantMessageEvent: { type: 'toolcall_end', contentIndex, toolCall: { id, name, arguments: args } },
  });

  // Fragments accumulate; no frame until toolcall_end confirms the tool name.
  assert.deepEqual(frames('writer', delta('{"content":"The fog '), new Map(), undefined, buf), []);
  assert.deepEqual(frames('writer', delta('parts"}'), new Map(), undefined, buf), []);

  const out = frames('writer', endCall('chalk', { content: 'The fog parts' }), new Map(), undefined, buf);
  const joined = out.filter((f) => f.type === 'writer_delta').map((f) => f.delta).join('');
  assert.equal(joined, 'The fog parts');
  assert.ok(out.every((f) => f.toolCallId === 'tc1'));

  // A non-chalk tool (write also has a `content` arg) yields NO writer_delta.
  const buf2 = new Map();
  frames('writer', delta('{"path":"a.md","content":"hi"}'), new Map(), undefined, buf2);
  assert.deepEqual(frames('writer', endCall('write', { path: 'a.md', content: 'hi' }, 'tc2'), new Map(), undefined, buf2), []);
});

test('chalk delta backstop uses replacement mode when the extractor lags', () => {
  const buf = new Map();
  // A raw fragment whose decoded prefix cannot reach the authoritative content
  // (simulate a lost escape) → one final replace frame.
  frames('writer', {
    type: 'message_update', usage: { input: 0, output: 0 },
    assistantMessageEvent: { type: 'toolcall_delta', contentIndex: 0, delta: '{"content":"par' },
  }, new Map(), undefined, buf);
  const out = frames('writer', {
    type: 'message_update', usage: { input: 0, output: 0 },
    assistantMessageEvent: { type: 'toolcall_end', contentIndex: 0, toolCall: { id: 'tc9', name: 'chalk', arguments: { content: 'parts' } } },
  }, new Map(), undefined, buf);
  const replace = out.find((f) => f.mode === 'replace');
  assert.ok(replace, 'expected a replacement backstop frame');
  assert.equal(replace.delta, 'parts');
});

test('agent_activity preserves writer/character identity and terminal idempotency', async () => {
  const { ActivityProjector } = await import('../dist/engine/agent-activity.js');
  const projector = new ActivityProjector();
  const args = new Map();
  const start = {
    type: 'tool_execution_start',
    toolCallId: 'activity-1',
    toolName: 'write',
    args: { path: '/private/secret.md', content: 'do not expose' },
  };
  const end = {
    type: 'tool_execution_end',
    toolCallId: 'activity-1',
    toolName: 'write',
    result: { details: { path: '/private/secret.md' } },
    isError: false,
  };
  const started = frames('writer', start, args, undefined, new Map(), 'turn-1', projector)
    .find((frame) => frame.type === 'agent_activity');
  const completed = frames('writer', end, args, undefined, new Map(), 'turn-1', projector)
    .find((frame) => frame.type === 'agent_activity');
  assert.equal(started.source, 'writer');
  assert.equal(started.agentId, 'writer');
  assert.equal(started.phase, 'started');
  assert.equal(started.subject, 'secret');
  assert.equal(completed.activityId, started.activityId);
  assert.equal(completed.phase, 'completed');
  assert.equal(frames('writer', end, args, undefined, new Map(), 'turn-1', projector).some((frame) => frame.type === 'agent_activity'), false);
});

test('custom role airp activity relay is not hidden by assistant-only mapping', async () => {
  const { ActivityProjector } = await import('../dist/engine/agent-activity.js');
  const projector = new ActivityProjector();
  const message = {
    role: 'custom',
    customType: 'airp_agent_activity',
    content: JSON.stringify({
      type: 'tool_start',
      context: { source: 'functional', agentId: 'scene-init', turnId: 'functional:t1' },
      toolCallId: 'child-1',
      toolName: 'read',
      args: { path: '/private/note.md' },
    }),
  };
  const out = mapEngineEvent('writer', { type: 'message_end', message }, new Map(), undefined, new Map(), 'writer:t1', projector);
  const activity = out.find((frame) => frame.type === 'agent_activity');
  assert.equal(activity.source, 'functional');
  assert.equal(activity.agentId, 'scene-init');
  assert.equal(activity.phase, 'started');
  assert.equal(activity.characterId, undefined);
});
