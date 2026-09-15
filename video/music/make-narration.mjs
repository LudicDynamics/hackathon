#!/usr/bin/env node
// Temporary narration (TTS) for every narration subtitle, so the user can hear the whole film voiced before deciding
// whether to record it themselves. Character lines (cues with a `speaker`) already have voices and are skipped.
//   node video/music/make-narration.mjs  → video/remotion/public/vo/n-<i>.wav + src/lib/narration.json
// Each line is normalised to -16 LUFS and, if it runs past its subtitle window, sped up (≤ 1.25×) to fit.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// CAPTIONS_FILE=captions60.ts voices the 1-minute cut instead (with VO_TAG=andrew60).
const CAPTIONS = resolve(HERE, '../remotion/src/lib', process.env.CAPTIONS_FILE || 'captions.ts');
// VO_TAG=<name> keeps several narrators side by side (public/vo/<name>/, src/lib/narration-<name>.json) for
// scripts/mix-vo.sh; without it the narration the film imports (narration.json) is overwritten.
const TAG = process.env.VO_TAG || '';
const OUT_DIR = resolve(HERE, '../remotion/public/vo', TAG);
const OUT_JSON = resolve(HERE, '../remotion/src/lib', TAG ? `narration-${TAG}.json` : 'narration.json');
const FILE_PREFIX = TAG ? `vo/${TAG}` : 'vo';
// Provider: 'app' = the running app's /api/tts (DashScope palette; default, works without OpenAI credits),
// 'openai' = gpt-4o-mini-tts with the STYLE direction below,
// 'edge' = Microsoft neural voices via edge-tts, e.g. NARRATOR_PROVIDER=edge NARRATOR_VOICE=en-US-AndrewNeural.
const PROVIDER = process.env.NARRATOR_PROVIDER || 'app';
const VOICE = process.env.NARRATOR_VOICE || (PROVIDER === 'app' ? 'Ethan' : 'ash');
const APP_URL = (process.env.AIRP_APP_URL || 'http://localhost:3001').replace(/\/+$/, '');
const STYLE =
  'A warm, confident narrator for a startup launch film. Calm and clear, quietly excited, never salesy. ' +
  'Natural pace, short pauses at commas, land each sentence softly.';
const MAX_TEMPO = 1.25;

/** The project's name the captions write as {PROJECT} (remotion/src/lib/project.ts): PROJECT=CharaCanvas for that cut. */
const PROJECT = process.env.PROJECT || 'LivingCanvas';

/** Narration cues = captions.ts entries without a speaker. */
const cues = [...readFileSync(CAPTIONS, 'utf8').matchAll(/\{\s*from:\s*([\d.]+),\s*to:\s*([\d.]+),\s*(speaker:[^,]+,\s*)?text:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)]
  .filter((m) => !m[3])
  .map((m) => ({ from: Number(m[1]), to: Number(m[2]), text: m[4].replace(/\\"/g, '"').split('{PROJECT}').join(PROJECT) }));

function openaiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const f of ['.local.env', '.env.local']) {
    try {
      const m = readFileSync(resolve(HERE, '../..', f), 'utf8').match(/^OPENAI_API_KEY=(.*)$/m);
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    } catch { /* next */ }
  }
  throw new Error('OPENAI_API_KEY not found');
}

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', ...args]);
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const lufs = (f) => Number((spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/I:\s+(-?[\d.]+) LUFS\s*$/m) ?? [0, -16])[1]);
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse';

mkdirSync(OUT_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'vo-'));
const out = [];
for (const [i, c] of cues.entries()) {
  const raw = join(tmp, `${i}.wav`);
  if (PROVIDER === 'edge') {
    // Microsoft neural narrator voices via edge-tts (pip3 install edge-tts) — the clean, neutral read of paper videos.
    const mp3 = join(tmp, `${i}.mp3`);
    execFileSync('python3', ['-m', 'edge_tts', '--voice', VOICE, '--text', c.text, '--write-media', mp3], { stdio: ['ignore', 'ignore', 'pipe'] });
    ff(['-i', mp3, '-ac', '1', '-ar', '44100', raw]);
  } else if (PROVIDER === 'openai') {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICE, input: c.text, instructions: STYLE, response_format: 'wav' }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`OpenAI TTS HTTP ${res.status} on "${c.text}" (429 = out of credits)`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  } else {
    const res = await fetch(`${APP_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: c.text, voice: VOICE, language: 'en' }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.json();
    if (!res.ok || !body.url) throw new Error(`app TTS: ${body.error ?? res.status} on "${c.text}"`);
    writeFileSync(raw, Buffer.from(await (await fetch(`${APP_URL}${body.url}`)).arrayBuffer()));
  }
  const trimmed = join(tmp, `${i}.t.wav`);
  ff(['-i', raw, '-af', TRIM, '-ac', '1', '-ar', '44100', trimmed]);
  const window = c.to - c.from;
  const d0 = dur(trimmed);
  const tempo = d0 > window ? Math.min(MAX_TEMPO, d0 / window) : 1;
  const file = `${FILE_PREFIX}/n-${String(i).padStart(2, '0')}.wav`;
  const g = (-16 - lufs(trimmed)).toFixed(2);
  ff(['-i', trimmed, '-af', `atempo=${tempo.toFixed(3)},volume=${g}dB,alimiter=limit=0.84:level=false`, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', join(OUT_DIR, `n-${String(i).padStart(2, '0')}.wav`)]);
  const d = dur(join(OUT_DIR, `n-${String(i).padStart(2, '0')}.wav`));
  const fits = d <= window + 0.05;
  out.push({ from: c.from, to: c.to, text: c.text, file, duration: Number(d.toFixed(3)), tempo: Number(tempo.toFixed(3)), fits });
  console.log(`${fits ? 'ok  ' : 'LONG'} ${c.from.toFixed(1).padStart(6)}s  ${d.toFixed(2)}/${window.toFixed(2)}s  ×${tempo.toFixed(2)}  ${c.text}`);
}
rmSync(tmp, { recursive: true, force: true });
writeFileSync(OUT_JSON, JSON.stringify(out, null, 1) + '\n');
console.log(`voice: ${VOICE} · ${out.length} lines · wrote ${OUT_JSON}`);
