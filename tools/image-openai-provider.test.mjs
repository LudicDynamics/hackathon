import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIImageProvider } from '../extensions/toolkit/image-openai-provider.ts';
const env = { OPENAI_API_KEY: 'test-only', AIRP_IMAGE_BASE_URL: 'https://images.example.test/v1/' };
const req = { prompt: 'A cabin', width: 1024, height: 1024 };
for (const edit of [false, true]) test(edit ? 'reference uses multipart edits' : 'generation uses JSON', async () => {
  const provider = createOpenAIImageProvider('test-image', env, async (url, init) => {
    assert.equal(url, `https://images.example.test/v1/images/${edit ? 'edits' : 'generations'}`);
    assert.equal(init.headers.Authorization, 'Bearer test-only');
    if (edit) { assert.ok(init.body instanceof FormData); assert.ok(init.body.get('image') instanceof Blob); }
    else assert.deepEqual(JSON.parse(init.body), { model: 'test-image', prompt: 'A cabin', n: 1, output_format: 'png', size: '1024x1024', quality: 'low' });
    return Response.json({ data: [{ b64_json: 'aGk=' }] });
  });
  assert.equal((await provider.generate({ ...req, ...(edit ? { reference: { dataB64: 'aGk=', mimeType: 'image/png' } } : {}) }, {})).ok, true);
});
test('missing credentials, empty response and HTTP failures do not fake success', async () => {
  assert.equal((await createOpenAIImageProvider('test', {}).generate(req, {})).reason, 'no_credentials');
  for (const [response, reason] of [[Response.json({ data: [] }), 'no_image'], [new Response('', { status: 429 }), 'provider_error']]) {
    let calls = 0;
    const result = await createOpenAIImageProvider('test', env, async () => { calls++; return response; }).generate(req, {});
    assert.equal(result.reason, reason); assert.equal(calls, 1);
  }
});
test('cancellation and timeout remain distinct', async () => {
  const controller = new AbortController(); controller.abort();
  assert.equal((await createOpenAIImageProvider('test', env, async () => { throw Error('must not call'); }).generate(req, { signal: controller.signal })).reason, 'aborted');
  const provider = createOpenAIImageProvider('test', env, async (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })));
  assert.equal((await provider.generate(req, { timeoutMs: 5 })).reason, 'timeout');
});
