import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { deliveryInstructions, hashOf, synthesise } from '../dist/routes/tts.js';

test('delivery is model-gated and changes the cache without breaking ordinary Flash cache', () => {
  assert.equal(deliveryInstructions('qwen3-tts-flash', 'Cherry'), '');
  const instruction = deliveryInstructions('qwen3-tts-instruct-flash', 'Cherry');
  assert.match(instruction, /not a child voice/);
  assert.equal(hashOf('m', 'v', 'English', 'Hello'), createHash('sha256').update('m|v|English|Hello').digest('hex').slice(0, 20));
  assert.notEqual(hashOf('m', 'v', 'English', 'Hello'), hashOf('m', 'v', 'English', 'Hello', instruction));
});

test('instruction is separate from spoken text and works with an explicit Japanese language', async () => {
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, options) => {
    if (options?.body) {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ output: { audio: { url: 'https://audio.invalid/test.wav' } } }));
    }
    return new Response(Buffer.from('RIFF0000WAVEfmt '));
  };
  try {
    await synthesise({ model: 'qwen3-tts-instruct-flash', text: 'どうしたの？', voice: 'Cherry', languageType: 'Japanese', apiKey: 'test-only', baseUrl: 'https://tts.invalid', timeoutMs: 1000 });
    assert.equal(request.input.text, 'どうしたの？');
    assert.equal(request.input.language_type, 'Japanese');
    assert.match(request.input.instructions, /comfortable conversational pace/);
    assert.equal(request.input.optimize_instructions, false);
  } finally { globalThis.fetch = previous; }
});

test('greeting and silence follow content language rather than interface locale', () => {
  const source = fs.readFileSync(new URL('../../web/src/components/overlay/CharacterModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /GREETING_LINE\[contentLanguage\]/);
  assert.doesNotMatch(source, /(?:GREETING_LINE|SILENCE_LINE)\[locale\]/);
  assert.match(source, /airp:greeted:v2:.*contentLanguage/);
});
