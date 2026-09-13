import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createJiti } from '../../../vendor/pi-rp/node_modules/jiti/lib/jiti.mjs';

test('independent persisted bus volumes, including zero, without changing master or restarting audio', async () => {
  const saved = new Map([['airp-volume-music', '0.3'], ['airp-volume-voice', '0.8']]);
  const gains = [];
  const previousWindow = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  class AudioContext {
    currentTime = 2;
    destination = {};
    createGain() {
      const node = { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; } }, connect(target) { this.target = target; } };
      gains.push(node); return node;
    }
  }
  globalThis.window = { AudioContext };
  try {
    const audio = await createJiti(import.meta.url, { moduleCache: false }).import('../src/lib/audio.ts');
    audio.initAudio();
    const [master, music, voice] = gains;
    assert.equal(music.gain.value, 0.3);
    assert.equal(voice.gain.value, 0.8);
    assert.equal(music.target, master); assert.equal(voice.target, master);
    audio.setChannelVolume('music', 0);
    assert.equal(music.gain.value, 0); assert.equal(voice.gain.value, 0.8);
    audio.setChannelVolume('voice', 0.4);
    assert.equal(voice.gain.value, 0.4); assert.equal(music.gain.value, 0);
    assert.equal(saved.get('airp-volume-voice'), '0.4');
    audio.setMuted(true); audio.setMuted(false);
    assert.equal(music.gain.value, 0); assert.equal(voice.gain.value, 0.4);
    audio.setChannelVolume('voice', NaN); assert.equal(voice.gain.value, 0.4);
    audio.setChannelVolume('voice', 9); assert.equal(audio.getChannelVolume('voice'), 1);
    assert.equal(gains.length, 3);
  } finally { globalThis.window = previousWindow; globalThis.localStorage = previousStorage; }
});

test('music samples and synth fallback share the music bus, while voice uses its own bus', () => {
  const source = fs.readFileSync(new URL('../src/lib/audio.ts', import.meta.url), 'utf8');
  assert.match(source, /track === 'ambient' \? master : musicBus!/);
  for (const name of ['calmG','tenseG','crisisG']) assert.ok(source.includes(`${name}.connect(musicBus!)`));
  assert.match(source, /playClip\(voiceBus!, buf/);
});
