import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentLifecycleManager } from '../dist/engine/lifecycle.js';
import { modelPreferenceArgs, readModelPreferences, writeModelPreferences } from '../dist/engine/model-preferences.js';
import { AgentModelSelectionSchema } from '../../../packages/shared/dist/index.js';

test('model preferences remain world-local and keep writer and character separate', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-model-test-'));
  try {
    const preference = { provider: 'openai', model: 'gpt-5.4-mini', thinking: 'off' };
    writeModelPreferences(root, { writer: preference });
    assert.deepEqual(readModelPreferences(root), { writer: preference });
    assert.deepEqual(modelPreferenceArgs(root, 'writer'), ['--provider', 'openai', '--model', 'gpt-5.4-mini', '--thinking', 'off']);
    // No saved character preference → the shipped default (OpenAI gpt-5.6-luna, low).
    assert.deepEqual(modelPreferenceArgs(root, 'character'), ['--provider', 'openai', '--model', 'gpt-5.6-luna', '--thinking', 'low']);
    assert.equal(AgentModelSelectionSchema.safeParse({ ...preference, role: 'writer', world: root }).success, true);
    assert.equal(AgentModelSelectionSchema.safeParse({ ...preference, role: 'writer' }).success, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('busy turns reject model switches before touching preferences or clients', async () => {
  const manager = new AgentLifecycleManager({ repoRoot: '.', vendorCliPath: '' });
  manager.queuedBeats = 1;
  await assert.rejects(manager.changeModel('/unused', 'writer', {}), /Wait for the current turn/);
  manager.queuedBeats = 0;
  manager.turnStartedAt.set('character:nanami', Date.now());
  await assert.rejects(manager.changeModel('/unused', 'character', {}), /Wait for the current turn/);
});

test('progress distinguishes landed Chalk from finished work and stops at settled', () => {
  const frames = [];
  const manager = new AgentLifecycleManager({ repoRoot: '.', vendorCliPath: '', frameSink: f => frames.push(f) });
  const client = { abort: async () => {} };
  manager.handleEngineEvent('writer', { type: 'agent_start' }, 'writer', client);
  manager.handleEngineEvent('writer', { type: 'tool_execution_end', toolName: 'chalk', isError: false }, 'writer', client);
  manager.handleEngineEvent('writer', { type: 'message_update' }, 'writer', client);
  assert.match(manager.progress.get('writer').stage, /Chalk is ready/);
  assert.equal(frames.at(-1).busy, true);
  manager.handleEngineEvent('writer', { type: 'agent_settled' }, 'writer', client);
  assert.equal(frames.at(-1).busy, false);
  assert.equal(manager.turnStartedAt.size, 0);
});
