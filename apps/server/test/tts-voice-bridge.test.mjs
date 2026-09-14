// Chinese worlds + Japanese local voice (docs/tts/10 §中文世界): the line is
// displayed in Chinese, translated to Japanese, and only Japanese reaches the
// local `setsuna` voice. Any translation failure skips the local voice and the
// online (qwen) voice reads the Chinese. Runs against built dist: `pnpm build`.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { test } from 'node:test';
import { LocalWorldStore } from '@airp/shared';
import { createTtsRouter } from '../dist/routes/tts.js';

const WAV = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ');
const ENV = ['AIRP_TTS_BASE_URL', 'DASHSCOPE_API_KEY', 'AIRP_TTS_MODEL', 'AIRP_TTS_DEFAULT_VOICE',
  'AIRP_TTS_LOCAL_BASE_URL', 'AIRP_TTS_LOCAL_TIMEOUT_MS', 'AIRP_TTS_LOCAL_VOICE', 'AIRP_TTS_LOCAL_API_KEY',
  'AIRP_TTS_JA_LOCAL_VOICES', 'AIRP_TTS_CHARACTER_VOICES', 'AIRP_TTS_TRANSLATE_BASE_URL',
  'AIRP_TTS_TRANSLATE_API_KEY', 'AIRP_TTS_TRANSLATE_MODEL', 'AIRP_TTS_TRANSLATE_TIMEOUT_MS', 'DEEPSEEK_API_KEY'];

/** One http stub; `handle(body, req)` returns [status, contentType, payload]. */
async function stub(t, handle) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      calls.push({ url: req.url, body });
      const [status, type, payload] = handle(body, req, server);
      res.statusCode = status;
      res.setHeader('content-type', type);
      res.end(payload);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { base: `http://127.0.0.1:${server.address().port}`, calls };
}

async function harness(t, { locale = 'zh-CN', worldId = 'first-snow-zh', translation = 'やっと来たね。' } = {}) {
  const saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
  t.after(() => { for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'airp-tts-bridge-'));
  t.after(() => fs.rm(repo, { recursive: true, force: true }));
  const store = new LocalWorldStore(path.join(repo, 'world-root'));
  t.after(() => { try { store.close(); } catch {} });
  await store.writeFile('world.json', JSON.stringify({ id: worldId, name: 'W', description: '', author: '', genre: 'test', createdAt: '', updatedAt: '', locale, characters: [{ id: 'nanami', home: 'world/map' }] }));

  const online = await stub(t, (body, req, server) => req.url.includes('/generation')
    ? [200, 'application/json', JSON.stringify({ status_code: 200, output: { audio: { url: `http://127.0.0.1:${server.address().port}/blob.wav` } }, usage: { characters: 1 } })]
    : [200, 'audio/wav', WAV]);
  const local = await stub(t, () => [200, 'audio/wav', WAV]);
  const translator = { reply: translation, status: 200 };
  const llm = await stub(t, () => [translator.status, 'application/json', JSON.stringify({ choices: [{ message: { content: translator.reply } }] })]);

  Object.assign(process.env, {
    AIRP_TTS_BASE_URL: online.base, DASHSCOPE_API_KEY: 'test-key', AIRP_TTS_MODEL: 'qwen3-tts-flash-2025-11-27', AIRP_TTS_DEFAULT_VOICE: 'Cherry',
    AIRP_TTS_LOCAL_BASE_URL: local.base, AIRP_TTS_LOCAL_TIMEOUT_MS: '1000', AIRP_TTS_LOCAL_VOICE: 'setsuna',
    AIRP_TTS_CHARACTER_VOICES: 'nanami=setsuna', AIRP_TTS_TRANSLATE_BASE_URL: llm.base, AIRP_TTS_TRANSLATE_API_KEY: 'llm-key',
  });
  delete process.env.AIRP_TTS_LOCAL_API_KEY;
  delete process.env.AIRP_TTS_JA_LOCAL_VOICES;

  const app = express();
  app.use(express.json());
  app.use('/api', createTtsRouter(repo, () => store));
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const post = body => fetch(`http://127.0.0.1:${server.address().port}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { post, online, local, llm, translator };
}

const zhLine = { text: '你终于来了。', voice: 'girl-next-door', language: 'zh-CN', characterId: 'nanami', emotion: 'smile' };

test('a Chinese line is translated, and only Japanese reaches the local voice; the cache keys the original', async t => {
  const h = await harness(t);
  const first = await h.post(zhLine);
  const body = await first.json();
  assert.equal(body.ok, true);
  assert.equal(first.headers.get('x-airp-tts-fallback'), null);
  assert.equal(h.llm.calls.length, 1);
  assert.equal(h.llm.calls[0].body.messages.at(-1).content, zhLine.text);
  assert.deepEqual(h.llm.calls[0].body.thinking, { type: 'disabled' }, 'translation must not spend its budget reasoning');
  assert.deepEqual(h.local.calls[0].body, { text: 'やっと来たね。', voice: 'setsuna', language: 'ja', emotion: 'happy' });
  assert.equal(h.online.calls.length, 0, 'no online synthesis');

  const again = await (await h.post(zhLine)).json();
  assert.equal(again.cached, true);
  assert.equal(again.url, body.url);
  assert.equal(h.llm.calls.length, 1, 'a cached line is not translated again');
  assert.equal(h.local.calls.length, 1);
});

test('the world locale decides even when the request omits its language', async t => {
  const h = await harness(t);
  await h.post({ ...zhLine, language: undefined });
  assert.equal(h.local.calls[0].body.text, 'やっと来たね。');
});

for (const [name, setup] of [
  ['the translator fails', h => { h.translator.status = 500; }],
  ['the translator answers in Chinese', h => { h.translator.reply = '你终于来了。'; }],
]) {
  test(`when ${name}, setsuna stays silent and the online voice reads Chinese`, async t => {
    const h = await harness(t);
    setup(h);
    const res = await h.post(zhLine);
    assert.equal((await res.json()).ok, true);
    assert.equal(res.headers.get('x-airp-tts-fallback'), 'local-to-online');
    assert.equal(h.local.calls.length, 0, 'the Japanese voice never receives Chinese');
    const synth = h.online.calls.find(c => c.url.includes('/generation'));
    assert.ok(synth, 'online synthesis ran');
    assert.match(JSON.stringify(synth.body), /你终于来了/);
    assert.match(JSON.stringify(synth.body), /Chinese/);
  });
}

test('only the setsuna local stage is bridged: another local voice is not translated', async t => {
  const h = await harness(t);
  process.env.AIRP_TTS_CHARACTER_VOICES = 'nanami=aoi';
  await h.post(zhLine);
  assert.equal(h.llm.calls.length, 0);
  assert.equal(h.local.calls[0].body.voice, 'aoi');
  assert.equal(h.local.calls[0].body.text, zhLine.text);
});

test('a Japanese world is never translated', async t => {
  const h = await harness(t, { locale: 'ja', worldId: 'first-snow-jp' });
  await h.post({ ...zhLine, text: 'また会えたね。', language: 'ja' });
  assert.equal(h.llm.calls.length, 0);
  assert.equal(h.local.calls[0].body.text, 'また会えたね。');
});

test('a Chinese-world line with no Han characters is read as-is', async t => {
  const h = await harness(t);
  await h.post({ ...zhLine, text: '……！' });
  assert.equal(h.llm.calls.length, 0);
  assert.equal(h.local.calls[0].body.text, '……！');
});
