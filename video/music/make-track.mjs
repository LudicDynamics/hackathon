#!/usr/bin/env node
// Placeholder launch-video track: 150 s, 120 BPM, instrumental, fully synthesized (no samples, no licenses).
// Usage: node video/music/make-track.mjs   → video/remotion/public/music/placeholder-120.wav + src/lib/music-cues.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_WAV = resolve(HERE, '../remotion/public/music/placeholder-120.wav');
const OUT_CUES = resolve(HERE, '../remotion/src/lib/music-cues.json');

const SR = 44100;
const DUR = 150;
const N = SR * DUR;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// ---------- primitives ----------
let seed = 20260914;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const S = (t) => Math.round(t * SR);
const mkBus = () => [new Float32Array(N), new Float32Array(N)];
const drums = mkBus(), music = mkBus(), lead = mkBus(), fx = mkBus();
const kicks = [];

function put(b, i, l, r) { if (i >= 0 && i < N) { b[0][i] += l; b[1][i] += r; } }

class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = 0.707) {
    const w = (2 * Math.PI * Math.min(Math.max(f, 20), SR * 0.45)) / SR;
    const c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
class Saw {
  constructor(f) { this.ph = (rnd() + 1) / 2; this.dt = f / SR; }
  next() {
    const v = 2 * this.ph - 1 - blep(this.ph, this.dt);
    this.ph += this.dt; if (this.ph >= 1) this.ph -= 1;
    return v;
  }
}

// ---------- drums & fx ----------
function kick(t, g = 1) {
  kicks.push([t, g]);
  const s0 = S(t), len = S(0.5);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (42 + 130 * Math.exp(-tt / 0.03))) / SR;
    let v = Math.sin(ph) * Math.exp(-tt / 0.2) * Math.min(1, tt / 0.0015);
    if (tt < 0.005) v += rnd() * 0.35 * (1 - tt / 0.005);
    v = Math.tanh(v * 1.8) * 0.95 * g;
    put(drums, s0 + i, v, v);
  }
}

function clap(t, g = 0.8) {
  const s0 = S(t), len = S(0.35);
  const bl = new Biquad('bp', 1400, 0.9), br = new Biquad('bp', 1550, 0.9);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let e = 0;
    for (const o of [0, 0.011, 0.022]) if (tt >= o) e = Math.max(e, Math.exp(-(tt - o) / (o < 0.02 ? 0.006 : 0.09)));
    put(drums, s0 + i, bl.p(rnd()) * e * g * 1.8, br.p(rnd()) * e * g * 1.8);
  }
}

function snare(t, g = 0.6) {
  const s0 = S(t), len = S(0.3);
  const hp = new Biquad('hp', 1800, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * 190) / SR;
    const v = (hp.p(rnd()) * Math.exp(-tt / 0.08) * 1.1 + Math.sin(ph) * Math.exp(-tt / 0.05) * 0.6) * g;
    put(drums, s0 + i, v * 0.95, v);
  }
}

function hat(t, g = 0.2, open = false, pan = 0.2) {
  const s0 = S(t), len = S(open ? 0.4 : 0.06);
  const h1 = new Biquad('hp', 7500, 0.7), h2 = new Biquad('hp', 9000, 0.7);
  const dec = open ? 0.12 : 0.018;
  for (let i = 0; i < len; i++) {
    const v = h2.p(h1.p(rnd())) * Math.exp(-(i / SR) / dec) * g;
    put(drums, s0 + i, v * (1 - pan), v * (1 + pan));
  }
}

function crash(t, g = 0.5, dec = 1.4) {
  const s0 = S(t), len = S(dec * 3.5);
  const hl = new Biquad('hp', 3500, 0.6), hr = new Biquad('hp', 3500, 0.6);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const e = Math.exp(-tt / dec) * Math.min(1, tt / 0.002);
    put(fx, s0 + i, hl.p(rnd()) * e * g, hr.p(rnd()) * e * g);
  }
}

function revCymbal(t0, dur, g = 0.5) {
  const s0 = S(t0), len = S(dur);
  const hl = new Biquad('hp', 4000, 0.6), hr = new Biquad('hp', 4000, 0.6);
  for (let i = 0; i < len; i++) {
    const x = i / len, e = x * x * x;
    put(fx, s0 + i, hl.p(rnd()) * e * g, hr.p(rnd()) * e * g);
  }
}

function riser(t0, dur, g = 0.5) {
  const s0 = S(t0), len = S(dur);
  const bl = new Biquad('bp', 400, 2), br = new Biquad('bp', 420, 2);
  const saw = new Saw(110), sawLp = new Biquad('lp', 2000, 0.7);
  for (let i = 0; i < len; i++) {
    const x = i / len;
    if (i % 32 === 0) {
      const f = 400 * Math.pow(20, x);
      bl.set(f, 2); br.set(f * 1.05, 2);
      saw.dt = (110 * Math.pow(8, x)) / SR;
    }
    const e = x * x;
    const s = sawLp.p(saw.next()) * 0.18;
    put(fx, s0 + i, (bl.p(rnd()) * 2.2 + s) * e * g, (br.p(rnd()) * 2.2 + s) * e * g);
  }
}

function impact(t, g = 1) {
  const s0 = S(t), len = S(2.6);
  const lp = new Biquad('lp', 180, 0.8);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (30 + 70 * Math.exp(-tt / 0.25))) / SR;
    const v = (Math.sin(ph) * Math.exp(-tt / 0.9) * 0.9 + lp.p(rnd()) * Math.exp(-tt / 0.3) * 1.5) * g;
    put(fx, s0 + i, v, v);
  }
  crash(t, 0.6 * g, 1.6);
}

// ---------- tonal synth ----------
function synth(b, notes, t0, dur, o = {}) {
  const {
    g = 0.2, voices = 5, detune = 18, attack = 0.005, release = 0.1, cutoff = 3000,
    envCut = 0, envDecay = 0.1, q = 0.7, spread = 0.6, sub = 0, decay = 0,
  } = o;
  const s0 = S(t0), len = S(dur + release);
  const tl = new Float32Array(len), tr = new Float32Array(len);
  for (const m of notes) {
    const f = mtof(m);
    for (let v = 0; v < voices; v++) {
      const k = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2;
      const osc = new Saw(f * Math.pow(2, (k * detune) / 1200));
      const gl = Math.sqrt((1 - k * spread) / 2), gr = Math.sqrt((1 + k * spread) / 2);
      for (let i = 0; i < len; i++) { const s = osc.next(); tl[i] += s * gl; tr[i] += s * gr; }
    }
  }
  if (sub) {
    const f = mtof(Math.min(...notes));
    let ph = 0;
    for (let i = 0; i < len; i++) { ph += (2 * Math.PI * f) / SR; const s = Math.sin(ph) * sub * voices; tl[i] += s; tr[i] += s; }
  }
  const fl = new Biquad('lp', cutoff + envCut, q), fr = new Biquad('lp', cutoff + envCut, q);
  const norm = g / Math.sqrt(voices * notes.length);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (envCut && i % 32 === 0) { const c = cutoff + envCut * Math.exp(-tt / envDecay); fl.set(c, q); fr.set(c, q); }
    let a = tt < attack ? tt / attack : 1;
    if (decay && tt > attack) a *= Math.exp(-(tt - attack) / decay);
    if (tt > dur) a *= Math.max(0, 1 - (tt - dur) / release);
    put(b, s0 + i, fl.p(tl[i]) * a * norm, fr.p(tr[i]) * a * norm);
  }
}

// ---------- arrangement ----------
// C major, I–V–vi–IV. Bass roots and close voicings around C4.
const PROG = [
  { root: 36, chord: [60, 64, 67] }, // C
  { root: 43, chord: [59, 62, 67] }, // G
  { root: 45, chord: [57, 60, 64] }, // Am
  { root: 41, chord: [57, 60, 65] }, // F
];
// Original hook, 8th notes per bar (null = rest).
const MOTIF = [
  [76, null, 79, 76, 74, 72, 74, null],
  [74, null, 79, 74, 71, 74, 76, null],
  [72, null, 76, 72, 76, 79, 81, null],
  [77, 76, 74, 72, 74, null, 72, null],
];
const ARP = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 4, 5, 3, 4, 2, 4];

const PLUCK = { voices: 2, detune: 8, cutoff: 700, envCut: 6000, envDecay: 0.09, decay: 0.18, release: 0.15, spread: 0.3 };
const LEAD_PLUCK = { g: 0.28, voices: 2, detune: 6, cutoff: 1200, envCut: 5000, envDecay: 0.12, decay: 0.3, release: 0.1, spread: 0.3 };
const LEAD_SAW = { g: 0.32, voices: 7, detune: 20, cutoff: 2500, envCut: 3000, envDecay: 0.2, release: 0.12, spread: 0.7 };

function groove(start, end, o) {
  for (let bt = start; bt < end - 1e-9; bt += BAR) {
    const barIdx = Math.round((bt - start) / BAR);
    const P = PROG[barIdx % 4];
    const barEnd = Math.min(bt + BAR, end);

    for (let k = 0; k < 4; k++) {
      const t = bt + k * BEAT;
      if (t >= end - 1e-9) break;
      if (o.kick === 'four') kick(t, o.kickG ?? 1);
      if (o.kick === 'half') {
        if (k === 0) kick(t, 1);
        if (k === 1) kick(t + BEAT / 2, 0.7);
        if (k === 2) { snare(t, 0.7); clap(t, 0.6); }
      }
      if (o.kick === 'soft' && k % 2 === 0) kick(t, 0.5);
      if (o.kick === 'faint') kick(t, 0.13);
      if (o.clap && (k === 1 || k === 3)) { clap(t, 0.8); if (o.snareLayer) snare(t, 0.45); }
      const hg = o.hatG ?? 1;
      if (o.hats === '16') for (let j = 0; j < 4; j++) hat(t + (j * BEAT) / 4, (j % 2 ? 0.12 : 0.2) * hg, false, j % 2 ? 0.3 : -0.2);
      if (o.hats === '8') { hat(t, 0.15 * hg, false, -0.2); hat(t + BEAT / 2, 0.2 * hg, false, 0.3); }
      if (o.openHat) hat(t + BEAT / 2, 0.2, true, 0.1);
      if (o.stabs) {
        synth(music, P.chord.map((m) => m + 12), t + BEAT / 2, 0.12, {
          g: o.stabG ?? 0.35, voices: 5, detune: 22, cutoff: o.stabCut ?? 900, envCut: o.stabEnv ?? 5000, envDecay: 0.08, release: 0.08, spread: 0.8,
        });
      }
    }

    if (o.bass === 'pump') {
      for (let j = 0; j < 8; j++) {
        const t = bt + (j * BEAT) / 2;
        if (t >= end - 1e-9) break;
        synth(music, [P.root], t, 0.22, { g: 0.5, voices: 3, detune: 10, cutoff: 300, envCut: 900, envDecay: 0.06, sub: 0.6, release: 0.03, spread: 0.2 });
      }
    }
    if (o.bass === 'sustain') {
      synth(music, [P.root], bt, barEnd - bt - 0.05, { g: o.bassG ?? 0.45, voices: 3, detune: 8, cutoff: 350, sub: 0.6, attack: 0.01, release: 0.1, spread: 0.2 });
    }
    if (o.pad) {
      synth(music, [...P.chord, P.chord[2] + 12], bt, barEnd - bt - 0.02, {
        g: o.pad.g, voices: 7, detune: 25, cutoff: o.pad.cutoff, attack: o.pad.attack ?? 0.08, release: 0.3, spread: 0.9,
      });
    }
    if (o.arp) {
      const ext = [...P.chord.map((m) => m + 12), ...P.chord.map((m) => m + 24)];
      for (let s = 0; s < 16; s++) {
        const t = bt + (s * BEAT) / 4;
        if (t >= end - 1e-9) break;
        synth(lead, [ext[ARP[s]]], t, 0.05, { ...PLUCK, g: o.arp });
      }
    }
    if (o.lead) {
      const line = MOTIF[barIdx % 4];
      for (let j = 0; j < 8; j++) {
        const t = bt + (j * BEAT) / 2;
        if (line[j] == null || t >= end - 1e-9) continue;
        const m = o.lead === 'saw' ? line[j] + 12 : line[j];
        synth(lead, [m], t, 0.2, o.lead === 'saw' ? LEAD_SAW : LEAD_PLUCK);
      }
    }
  }
}

function snareFill(tEnd) { for (let j = 0; j < 4; j++) snare(tEnd - BEAT + j * (BEAT / 4), 0.3 + 0.12 * j); }
function snareRoll(tEnd) { for (let j = 0; j < 8; j++) snare(tEnd - BEAT + j * (BEAT / 8), 0.2 + 0.08 * j); }
function bigHit(t, chordIdx, dur = 0.7, release = 0.4) {
  const P = PROG[chordIdx];
  kick(t, 1.1);
  impact(t, 0.8);
  synth(music, [P.root, ...P.chord, P.chord[0] + 12], t, dur, { g: 0.55, voices: 7, detune: 25, cutoff: 4000, envCut: 4000, envDecay: 0.3, release, spread: 0.9, sub: 0.3 });
}

// S0 · 0–3 riser, no drums
riser(0, 3, 0.6);
revCymbal(1.5, 1.5, 0.5);
impact(3, 1);

// S1 · 3–15 full drop
groove(3, 15, { kick: 'four', clap: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 3000, g: 0.22 }, arp: 0.18, lead: 'pluck' });

// S2 · 15–27 half-time, filtered chords
groove(15, 27, { kick: 'half', hats: '8', bass: 'sustain', stabs: true, stabCut: 500, stabEnv: 1500, stabG: 0.3, pad: { cutoff: 900, g: 0.3 } });

// S3 · 27–39 voice section, ducked to ≈ -18 dB
groove(27, 39, { kick: 'faint', pad: { cutoff: 450, g: 0.1, attack: 0.5 } });

// S4 · 39–87 four worlds, building every 12 s
crash(39, 0.45);
groove(39, 51, { kick: 'four', hats: '8', bass: 'pump', pad: { cutoff: 1500, g: 0.25 } });
groove(51, 63, { kick: 'four', clap: true, hats: '16', bass: 'pump', pad: { cutoff: 1800, g: 0.25 } });
groove(63, 75, { kick: 'four', clap: true, hats: '16', bass: 'pump', stabs: true, pad: { cutoff: 2500, g: 0.24 } });
groove(75, 87, { kick: 'four', clap: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 3000, g: 0.22 }, arp: 0.16, lead: 'pluck' });
for (const t of [51, 63, 75]) { snareFill(t); crash(t, 0.45); }
snareRoll(87);

// S5 · 87–112 melodic, lighter
crash(87, 0.3);
groove(87, 112, { kick: 'soft', hats: '8', hatG: 0.5, bass: 'sustain', bassG: 0.35, pad: { cutoff: 2500, g: 0.28, attack: 0.2 }, arp: 0.26 });
riser(110, 2, 0.55);

// S6 · 112–137 second drop
impact(112, 1);
groove(112, 137, { kick: 'four', kickG: 1.05, clap: true, snareLayer: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 5000, g: 0.22 }, arp: 0.18, lead: 'saw' });
crash(122, 0.55);

// S7 · 137–150 formula: one silent beat, four hits, swell, groove, final hit
revCymbal(137.5, 0.5, 0.45);
bigHit(138, 0); bigHit(139, 1); bigHit(140, 2); bigHit(141, 3);
synth(music, [41, 57, 60, 65, 72], 141, 2.0, { g: 0.5, voices: 7, detune: 25, cutoff: 2500, attack: 1.8, release: 0.05, spread: 0.9 });
riser(141, 2, 0.5);
revCymbal(142, 1, 0.4);
impact(143, 0.7);
groove(143, 148, { kick: 'four', kickG: 1.05, clap: true, snareLayer: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 5000, g: 0.22 }, arp: 0.18, lead: 'saw' });
bigHit(148, 0, 1.2, 0.8);

// ---------- mix ----------
const sc = new Float32Array(N).fill(1);
for (const [t, g] of kicks) {
  if (g < 0.2) continue;
  const s0 = S(t), len = S(0.4);
  for (let i = 0; i < len && s0 + i < N; i++) {
    const tt = i / SR;
    const env = tt < 0.004 ? tt / 0.004 : Math.exp(-(tt - 0.004) / 0.11);
    const v = 1 - 0.78 * Math.min(1, g) * env;
    if (v < sc[s0 + i]) sc[s0 + i] = v;
  }
}

// Ping-pong dotted-8th delay on the lead bus.
{
  const d = S(BEAT * 0.75), fb = 0.35, mix = 0.28;
  const dl = new Float32Array(N), dr = new Float32Array(N);
  for (let i = d; i < N; i++) {
    const inp = (lead[0][i - d] + lead[1][i - d]) * 0.5;
    dl[i] = inp + dr[i - d] * fb;
    dr[i] = dl[i - d] * fb;
  }
  for (let i = 0; i < N; i++) { lead[0][i] += dl[i] * mix; lead[1][i] += dr[i] * mix; }
}

const L = new Float32Array(N), R = new Float32Array(N);
const gOffA = S(137), gOnA = S(138), gOnFx = S(137.5), fadeIn = S(0.005);
for (let i = 0; i < N; i++) {
  // Everything but fx is gated 137–138; fx (reverse cymbal pickup) returns at 137.5.
  let gA = 1, gF = 1;
  if (i >= gOffA - fadeIn && i < gOffA) gA = gF = (gOffA - i) / fadeIn;
  if (i >= gOffA && i < gOnA) gA = 0;
  if (i >= gOffA && i < gOnFx) gF = 0;
  const lg = 0.55 + 0.45 * sc[i];
  L[i] = (drums[0][i] + music[0][i] * sc[i] + lead[0][i] * lg) * gA + fx[0][i] * gF;
  R[i] = (drums[1][i] + music[1][i] * sc[i] + lead[1][i] * lg) * gA + fx[1][i] * gF;
}

// Master: pre-normalize, tanh soft clip, final peak at -0.6 dBFS, fade-out 149.2–150.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const drive = 1.4 / peak;
let peak2 = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * drive); R[i] = Math.tanh(R[i] * drive);
  peak2 = Math.max(peak2, Math.abs(L[i]), Math.abs(R[i]));
}
const target = Math.pow(10, -0.6 / 20) / peak2;
const fadeStart = S(149.2);
const pcm = Buffer.alloc(44 + N * 4);
for (let i = 0; i < N; i++) {
  const f = i < fadeStart ? 1 : Math.max(0, 1 - (i - fadeStart) / (N - fadeStart));
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * target * f)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * target * f)) * 32767), 46 + i * 4);
}
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);

mkdirSync(dirname(OUT_WAV), { recursive: true });
writeFileSync(OUT_WAV, pcm);

const cues = {
  file: 'music/placeholder-120.wav',
  bpm: BPM, beatSec: BEAT, barSec: BAR, fps: 30, framesPerBeat: 15, framesPerBar: 60, durationSec: DUR,
  gridNote: 'Beats fall on multiples of 0.5 s from t=0. Chord bars restart at each section start.',
  sections: [
    { id: 'S0', name: 'cold-open-riser', start: 0, end: 3 },
    { id: 'S1', name: 'cast-drop', start: 3, end: 15 },
    { id: 'S2', name: 'one-canvas-halftime', start: 15, end: 27 },
    { id: 'S3', name: 'voice-ducked', start: 27, end: 39 },
    { id: 'S4', name: 'four-worlds-build', start: 39, end: 87, blocks: [39, 51, 63, 75] },
    { id: 'S5', name: 'infinite-exploration-melodic', start: 87, end: 112 },
    { id: 'S6', name: 'vision-second-drop', start: 112, end: 137 },
    { id: 'S7', name: 'formula-hits', start: 137, end: 150 },
  ],
  impacts: [3, 112, 138, 139, 140, 141, 143, 148],
  crashes: [39, 51, 63, 75, 87, 122],
  fills: [{ start: 50.5, end: 51 }, { start: 62.5, end: 63 }, { start: 74.5, end: 75 }, { start: 86.5, end: 87, kind: 'roll' }],
  risers: [{ start: 0, end: 3 }, { start: 110, end: 112 }, { start: 141, end: 143 }],
  silence: { start: 137, end: 137.5 },
  formulaHits: [138, 139, 140, 141],
  finalHit: 148,
};
mkdirSync(dirname(OUT_CUES), { recursive: true });
writeFileSync(OUT_CUES, JSON.stringify(cues, null, 2) + '\n');
console.log(`wrote ${OUT_WAV}\nwrote ${OUT_CUES}`);
