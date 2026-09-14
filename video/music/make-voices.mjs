#!/usr/bin/env node
// Launch-video voice lines.
//   Characters: the project's local TTS (setsuna), same request as apps/server/src/routes/local-tts.ts.
//   Player: macOS `say` — a stand-in until the user records their own lines.
// Usage: node video/music/make-voices.mjs   → video/remotion/public/voice/<id>.wav + src/lib/voice.json
// Each wav is trimmed of edge silence and normalised (two-pass loudnorm, -16 LUFS, ≤ -1.5 dBTP).
//
// The voice demo (Vera, Nanami) is spoken in English. Every later line is spoken in Japanese — the Japanese is
// the characters' own (Lyra's comes from templates/moonlit-contract-jp/world/opening.md) — while everything on
// screen stays English: `subtitle` is what the film shows.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../remotion/public/voice');
const OUT_JSON = resolve(HERE, '../remotion/src/lib/voice.json');
const TTS_URL = (process.env.AIRP_TTS_LOCAL_BASE_URL || 'http://100.120.116.13:8090').replace(/\/+$/, '');
const TTS_VOICE = process.env.AIRP_TTS_LOCAL_VOICE || 'setsuna';
// setsuna is deterministic (identical audio per request), so one take is enough.
const TAKES = 1;

const LINES = [
  { id: 'vera-1', speaker: 'Vera', emotion: 'neutral', language: 'en', text: 'Twelve minutes of darkness. Someone wanted the harbour blind.' },
  { id: 'nanami-1', speaker: 'Nanami', emotion: 'happy', language: 'en', text: 'It just started! Come up to the roof, quick!' },
  { id: 'lyra-1', speaker: 'Lyra', emotion: 'neutral', language: 'ja', text: '私はライラ。あなたを守るために、ここへ来ました。', subtitle: 'I am Lyra. I have come to protect you.' },
  { id: 'lyra-2', speaker: 'Lyra', emotion: 'neutral', language: 'ja', text: '私と契約を結び、この夜を共に歩んでくれますか。', subtitle: 'Will you bind a contract with me, and walk this night together?' },
  { id: 'vera-2', speaker: 'Vera', emotion: 'neutral', language: 'ja', text: 'ここはね、直せなかったものを置いておく場所なの。', subtitle: "This is where I keep the things I couldn't fix." },
  { id: 'player-1', speaker: 'Player', say: true, language: 'en', text: 'Vera, what did you find at the lighthouse?' },
  { id: 'player-2', speaker: 'Player', say: true, language: 'en', text: 'Nanami, is it snowing yet?' },
  // Wataru (otome love interest) needs a male voice; setsuna is the only local voice, so he goes through the
  // app's online TTS palette (docs/tts/07 — verified ids). Ethan: warm, young. Alternative: Kai.
  { id: 'player-3', speaker: 'Player', say: true, language: 'en', text: 'Wataru, did you wait for me?' },
  { id: 'wataru-1', speaker: 'Wataru', online: 'Ethan', language: 'en', text: 'Of course I did. I saved you the seat by the window.' },
];
const APP_URL = (process.env.AIRP_APP_URL || 'http://localhost:3001').replace(/\/+$/, '');

/** The running app's /api/tts (DashScope palette voices); returns a URL to the cached WAV. */
async function onlineTts(text, voice, language, file) {
  const res = await fetch(`${APP_URL}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, language }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json();
  if (!res.ok || !body.url) throw new Error(`app TTS: ${body.error ?? res.status}`);
  const wav = Buffer.from(await (await fetch(`${APP_URL}${body.url}`)).arrayBuffer());
  if (wav.toString('ascii', 0, 4) !== 'RIFF') throw new Error('app TTS returned non-WAV');
  writeFileSync(file, wav);
}

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
/** ffmpeg analysis filters (loudnorm) report on stderr. */
const ffErr = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' }).stderr ?? '';
const duration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

const TRIM = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04',
  'areverse',
].join(',');

/** Trim edge silence, then two-pass (linear) loudnorm so short lines don't pump. */
function finish(src, dst) {
  const trimmed = `${dst}.trim.wav`;
  ff(['-i', src, '-af', TRIM, '-ac', '1', '-ar', '44100', trimmed]);
  const log = ffErr(['-i', trimmed, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ff(['-i', trimmed, '-af', `${ln},apad=pad_dur=0.05`, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', dst]);
  // loudnorm can't lift a peaky take without breaking the true-peak ceiling and quietly undershoots (the online
  // Ethan take landed at -20 LUFS; clips under 3s are always linear, so its dynamic mode doesn't help). For those:
  // add exactly the missing gain and let a limiter hold peaks under -1.5 dBFS.
  const got = integrated(dst);
  if (Math.abs(got + 16) > 1) {
    const fixed = `${dst}.gain.wav`;
    ff(['-i', dst, '-af', `volume=${(-16 - got).toFixed(2)}dB,alimiter=limit=0.84:level=false`, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', fixed]);
    ff(['-i', fixed, '-c', 'copy', dst]);
    rmSync(fixed);
    console.log(`  ${dst.split('/').pop()}: ${got} LUFS → ${integrated(dst)} LUFS (gain + limiter)`);
  }
  rmSync(trimmed);
}

/** Integrated loudness (LUFS) of a file. */
function integrated(file) {
  const m = ffErr(['-i', file, '-af', 'ebur128', '-f', 'null', '-']).match(/I:\s+(-?[\d.]+) LUFS\s*$/m);
  return m ? Number(m[1]) : -16;
}

/** Best installed English `say` voice: Premium > Enhanced > a few known-natural defaults. */
function pickSayVoice() {
  const rows = execFileSync('say', ['-v', '?']).toString().split('\n')
    .map((l) => l.match(/^(.+?)\s{2,}(en_(?:US|GB))\s/)).filter(Boolean).map((m) => m[1].trim());
  return rows.find((n) => /Premium/.test(n)) ?? rows.find((n) => /Enhanced/.test(n))
    ?? ['Samantha', 'Daniel', 'Reed (English (US))', 'Eddy (English (US))'].find((n) => rows.includes(n)) ?? rows[0];
}

async function tts(text, language, emotion, file) {
  const res = await fetch(`${TTS_URL}/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: TTS_VOICE, language, emotion }),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('TTS returned non-WAV');
  writeFileSync(file, buf);
}

mkdirSync(OUT_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'voices-'));
const sayVoice = pickSayVoice();
const out = [];

for (const line of LINES) {
  const dst = join(OUT_DIR, `${line.id}.wav`);
  if (line.say) {
    const aiff = join(tmp, `${line.id}.aiff`);
    execFileSync('say', ['-v', sayVoice, '-r', '175', '-o', aiff, line.text]);
    finish(aiff, dst);
  } else if (line.online) {
    const raw = join(tmp, `${line.id}.wav`);
    await onlineTts(line.text, line.online, line.language, raw);
    finish(raw, dst);
    console.log(`${line.id} [${line.language}, online ${line.online}]: ${duration(dst).toFixed(2)}s`);
  } else {
    // Several takes when TAKES > 1; keep the one nearest the median length (drops rushed or stretched outliers).
    const takes = [];
    for (let k = 0; k < TAKES; k++) {
      const raw = join(tmp, `${line.id}-${k}.wav`);
      const fin = join(tmp, `${line.id}-${k}.fin.wav`);
      try { await tts(line.text, line.language, line.emotion, raw); finish(raw, fin); takes.push({ fin, d: duration(fin) }); }
      catch (e) { console.warn(`${line.id} take ${k}: ${e.message}`); }
    }
    if (!takes.length) throw new Error(`no usable take for ${line.id}`);
    const sorted = [...takes].sort((a, b) => a.d - b.d);
    const median = sorted[Math.floor(sorted.length / 2)].d;
    const best = takes.reduce((a, b) => (Math.abs(b.d - median) < Math.abs(a.d - median) ? b : a));
    ff(['-i', best.fin, '-c', 'copy', dst]);
    console.log(`${line.id} [${line.language}]: kept ${best.d.toFixed(2)}s`);
  }
  out.push({
    id: line.id,
    speaker: line.speaker,
    language: line.language,
    text: line.text,
    ...(line.subtitle ? { subtitle: line.subtitle } : {}),
    file: `voice/${line.id}.wav`,
    duration: Number(duration(dst).toFixed(3)),
  });
}

rmSync(tmp, { recursive: true, force: true });
writeFileSync(OUT_JSON, JSON.stringify(out, null, 1) + '\n');
console.log(`say voice: ${sayVoice}\nwrote ${OUT_JSON}`);
