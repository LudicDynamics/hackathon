import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentLifecycleManager } from '../dist/engine/lifecycle.js';

test('progress renews inactivity budget without extending the five-minute ceiling', () => {
  const original = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now, env: process.env.AIRP_TURN_TIMEOUT_MS };
  let now = 1000;
  const timers = new Map();
  const frames = [];
  let aborted = 0;
  try {
    process.env.AIRP_TURN_TIMEOUT_MS = '90000';
    Date.now = () => now;
    globalThis.setTimeout = (fn, delay) => { const id = { unref() {} }; timers.set(id, { fn, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    const manager = new AgentLifecycleManager({ repoRoot: '.', vendorCliPath: '', frameSink: frame => frames.push(frame) });
    const client = { abort: async () => { aborted++; } };
    manager.handleEngineEvent('writer', { type: 'agent_start' }, 'writer', client);
    assert.equal([...timers.values()][0].delay, 90000);
    now += 80000;
    manager.handleEngineEvent('writer', { type: 'message_update' }, 'writer', client);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, 90000);
    now = 300000;
    manager.handleEngineEvent('writer', { type: 'tool_execution_end' }, 'writer', client);
    assert.equal([...timers.values()][0].delay, 1000);
    [...timers.values()][0].fn();
    assert.equal(aborted, 1);
    assert.equal(frames.find(frame => frame.type === 'turn_aborted').reason, 'timeout');
    manager.handleEngineEvent('writer', { type: 'agent_settled' }, 'writer', client);
    assert.equal(timers.size, 0);
  } finally {
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    Date.now = original.now;
    if (original.env === undefined) delete process.env.AIRP_TURN_TIMEOUT_MS;
    else process.env.AIRP_TURN_TIMEOUT_MS = original.env;
  }
});
