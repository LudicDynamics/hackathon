import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from '../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';
const { registerWriterBeatGuard } = await createJiti(import.meta.url).import('../extensions/toolkit/writer-beat-guard.ts');

test('one landed Chalk per player action, not per model iteration; repeated violations stop', async () => {
  const previous = process.env.AIRP_AGENT_ROLE; process.env.AIRP_AGENT_ROLE = 'writer';
  const handlers = {}; let aborts = 0;
  registerWriterBeatGuard({ on: (name, handler) => { handlers[name] = handler; } });
  const ctx = { abort: () => aborts++ };
  const call = () => handlers.tool_call({ toolName: 'chalk', toolCallId: 'c', input: { content: 'One paragraph.' } }, ctx);
  try {
    handlers.agent_start(); assert.equal(await call(), undefined);
    handlers.tool_result({ toolName: 'chalk', toolCallId: 'c', isError: false, details: { path: 'world/result.md' } });
    assert.equal((await call()).block, true); assert.equal(aborts, 0);
    assert.equal((await call()).block, true); assert.equal(aborts, 1);
    handlers.agent_start(); assert.equal(await call(), undefined);
    assert.equal(handlers.turn_start, undefined);
    process.env.AIRP_AGENT_ROLE = 'character:nanami'; assert.equal(await call(), undefined);
  } finally { if (previous === undefined) delete process.env.AIRP_AGENT_ROLE; else process.env.AIRP_AGENT_ROLE = previous; }
});

test('read loops have a bounded tool budget', async () => {
  const previous = process.env.AIRP_AGENT_ROLE; process.env.AIRP_AGENT_ROLE = 'writer';
  const handlers = {}; let aborted = false;
  registerWriterBeatGuard({ on: (name, handler) => { handlers[name] = handler; } });
  try {
    handlers.agent_start();
    for (let i = 0; i < 24; i++) assert.equal(await handlers.tool_call({ toolName: 'read', input: {} }, { abort() { aborted = true; } }), undefined);
    assert.equal((await handlers.tool_call({ toolName: 'read', input: {} }, { abort() { aborted = true; } })).block, true);
    assert.equal(aborted, true);
  } finally { if (previous === undefined) delete process.env.AIRP_AGENT_ROLE; else process.env.AIRP_AGENT_ROLE = previous; }
});
