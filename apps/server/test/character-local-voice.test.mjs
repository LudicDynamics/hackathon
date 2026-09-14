import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterLocalVoice, parseCharacterVoices } from '../dist/routes/local-tts.js';

test('female declared voices share default, male and unknown do not', () => {
  assert.equal(characterLocalVoice('vera', 'playful-teasing'), 'setsuna');
  assert.equal(characterLocalVoice('nanami', 'shy-sweet'), 'setsuna');
  assert.equal(characterLocalVoice('new-person', 'gentle-calm'), 'setsuna');
  assert.equal(characterLocalVoice('man', 'wise-elder'), null);
  assert.equal(characterLocalVoice('unknown', undefined), null);
  assert.equal(characterLocalVoice('unknown', 'unknown-voice'), null);
  assert.equal(characterLocalVoice('man', 'gentle-calm', 'male'), null);
});
test('per-character overrides and opt-out take priority', () => {
  const old = process.env.AIRP_TTS_CHARACTER_VOICES;
  process.env.AIRP_TTS_CHARACTER_VOICES = 'vera=custom,nanami=online';
  try {
    assert.equal(characterLocalVoice('vera', 'playful-teasing'), 'custom');
    assert.equal(characterLocalVoice('nanami', 'shy-sweet'), null);
    assert.throws(() => parseCharacterVoices('vera=../../private'));
    assert.throws(() => parseCharacterVoices('__proto__=voice'));
  } finally { if (old === undefined) delete process.env.AIRP_TTS_CHARACTER_VOICES; else process.env.AIRP_TTS_CHARACTER_VOICES = old; }
});
