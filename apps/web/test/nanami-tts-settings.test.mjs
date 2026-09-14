import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

const settings = await createJiti(import.meta.url, { moduleCache: false }).import('../src/lib/nanami-tts-settings.ts');

test('Nanami settings send only touched values and preserve an explicit local URL clear', () => {
  assert.deepEqual(settings.buildNanamiTtsPayload({}), {});
  assert.deepEqual(settings.buildNanamiTtsPayload({ baseUrl: '', voice: '', timeoutSeconds: '', apiKey: '' }), {
    AIRP_TTS_LOCAL_BASE_URL: '',
  });
  assert.deepEqual(settings.buildNanamiTtsPayload({
    baseUrl: ' http://100.120.116.13:8090/ ',
    voice: 'setsuna_v2',
    timeoutSeconds: '45',
    apiKey: 'secret',
  }), {
    AIRP_TTS_LOCAL_BASE_URL: 'http://100.120.116.13:8090/',
    AIRP_TTS_LOCAL_VOICE: 'setsuna_v2',
    AIRP_TTS_LOCAL_TIMEOUT_MS: '45000',
    AIRP_TTS_LOCAL_API_KEY: 'secret',
  });
});

test('Nanami settings reject endpoint URLs, unstable voice IDs, and invalid timeouts', () => {
  assert.throws(() => settings.buildNanamiTtsPayload({ baseUrl: 'http://localhost:8090/v1/tts' }), /without \/v1\/tts/);
  assert.throws(() => settings.buildNanamiTtsPayload({ baseUrl: 'http://localhost:8090/v1/tts/extra' }), /without \/v1\/tts/);
  assert.throws(() => settings.buildNanamiTtsPayload({ baseUrl: 'http://user:pass@localhost:8090' }), /without \/v1\/tts/);
  assert.throws(() => settings.buildNanamiTtsPayload({ voice: 'setsuna voice' }), /letters, numbers/);
  assert.throws(() => settings.buildNanamiTtsPayload({ timeoutSeconds: '0' }), /1 and 120/);
  assert.throws(() => settings.buildNanamiTtsPayload({ timeoutSeconds: '121' }), /1 and 120/);
  assert.deepEqual(settings.buildNanamiTtsPayload({ timeoutSeconds: '1.5' }), { AIRP_TTS_LOCAL_TIMEOUT_MS: '1500' });
});

test('Nanami timeout renders server milliseconds as seconds with a safe default', () => {
  assert.equal(settings.timeoutSecondsFromConfig('30000'), '30');
  assert.equal(settings.timeoutSecondsFromConfig('120000'), '120');
  assert.equal(settings.timeoutSecondsFromConfig('bad'), '30');
});

test('voice settings use localized copy, exact protected headers, and never persist secrets in localStorage', () => {
  const nanami = fs.readFileSync(new URL('../src/components/NanamiTtsSettings.tsx', import.meta.url), 'utf8');
  const connections = fs.readFileSync(new URL('../src/components/ConnectionSettings.tsx', import.meta.url), 'utf8');
  const panel = fs.readFileSync(new URL('../src/components/TtsSettings.tsx', import.meta.url), 'utf8');
  for (const source of [nanami, connections]) {
    assert.match(source, /'X-AIRP-Settings': '1'/);
    assert.doesNotMatch(source, /localStorage/);
  }
  assert.match(panel, /t\('Online model'\)/);
  assert.match(panel, /t\('Online fallback voice'\)/);
  assert.match(panel, /<NanamiTtsSettings onSaved=/);
  assert.doesNotMatch(panel, />Character voice</);
  assert.doesNotMatch(connections, />Server connections</);
  const messages = JSON.parse(fs.readFileSync(new URL('../src/lib/messages.json', import.meta.url), 'utf8'));
  assert.equal(messages['API key'].ja, 'API キー');
  assert.equal(messages['OpenAI-compatible'].ja, 'OpenAI 互換');
  assert.equal(messages['Flow media proxy']['zh-CN'], 'Flow 媒体代理');
  assert.match(messages['Keys stay on this server in .local.env when it exists, otherwise in .env.local. Blank key fields keep their current values. Flow configures media generation, not the writer model.'].ja, /\.local\.env.*\.env\.local/);
});
