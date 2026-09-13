import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveConnectionSettings } from '../dist/routes/connection-settings.js';
import { airpEnv } from '../dist/engine/presets.js';
import { ensureProviderConfig } from '../dist/engine/provider-config.js';

test('shipped DeepSeek model installs without replacing local provider settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airp-provider-config-'));
  try {
    fs.mkdirSync(path.join(root, 'config'));
    fs.copyFileSync(new URL('../../../config/deepseek-models.example.json', import.meta.url), path.join(root, 'config/deepseek-models.example.json'));
    ensureProviderConfig(root);
    const file = path.join(root, '.pi/agent/models.json');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(config.providers.deepseek.models[0].id, 'deepseek-flash');
    config.providers.custom = { apiKey: '$CUSTOM_KEY' };
    config.providers.deepseek.apiKey = '$CUSTOM_DEEPSEEK_KEY';
    config.providers.deepseek.models = [];
    fs.writeFileSync(file, JSON.stringify(config));
    ensureProviderConfig(root);
    const saved = fs.readFileSync(file, 'utf8');
    ensureProviderConfig(root);
    assert.equal(fs.readFileSync(file, 'utf8'), saved);
    assert.equal(JSON.parse(saved).providers.deepseek.apiKey, '$CUSTOM_DEEPSEEK_KEY');
    assert.deepEqual(JSON.parse(saved).providers.custom, config.providers.custom);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('provider credentials use the explicit local file and preserve existing settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airp-provider-settings-'));
  const keys = ['DEEPSEEK_API_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    fs.writeFileSync(path.join(root, '.local.env'), '# Local settings\n');
    fs.writeFileSync(path.join(root, '.env.local'), 'OPENAI_API_KEY="existing-test-value"\n');
    saveConnectionSettings(root, Object.fromEntries(keys.map(key => [key, 'test-only-value'])));
    saveConnectionSettings(root, { DEEPSEEK_API_KEY: '' });
    const saved = fs.readFileSync(path.join(root, '.local.env'), 'utf8');
    for (const key of keys) assert.ok(saved.includes(`${key}="test-only-value"`));
    assert.equal(airpEnv({ role: 'writer' }).DEEPSEEK_API_KEY, 'test-only-value');
    assert.equal(airpEnv({ role: 'character:example' }).DEEPSEEK_API_KEY, 'test-only-value');
    assert.equal(fs.readFileSync(path.join(root, '.env.local'), 'utf8'), 'OPENAI_API_KEY="existing-test-value"\n');
    assert.equal(fs.statSync(path.join(root, '.local.env')).mode & 0o777, 0o600);
    assert.throws(() => saveConnectionSettings(root, { DEEPSEEK_API_KEY: 'bad\nvalue' }));
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
