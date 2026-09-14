#!/usr/bin/env node
// Launch-video music: 150 s, 120 BPM, instrumental, fully synthesized (no samples, no licenses).
// Every style follows the same v2 cue grid (see `cues` at the bottom), so any of them drops into the edit unchanged.
//
//   node video/music/make-track.mjs                → style a → public/music/placeholder-120.wav + src/lib/music-cues.json
//   node video/music/make-track.mjs --style=b      → public/music/candidate-b.wav   (c, d likewise)
//   node video/music/make-track.mjs --style=a --out=/tmp/a.wav   (custom path; cues are not rewritten)
//
// Styles: a · current driving electro-pop (C major)   b · "Sunrise Pop" piano / stomp-clap / whistle (D major)
//         c · "Epic Hybrid" taiko / braams / strings (D minor)   d · "Future Garage" 2-step / Rhodes / vox chops (F minor)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const STYLE = ARGS.style ?? 'a';
// drive: master soft-clip amount (peak-relative). Higher = denser, louder grooves under the same -1.2 dB peak.
const META = {
  a: { file: 'placeholder-120.wav', scDepth: 0.78, delayMix: 0.28, delayFb: 0.35, drive: 1.4 },
  b: { file: 'candidate-b.wav', scDepth: 0.4, delayMix: 0.2, delayFb: 0.3, drive: 3.0 },
  c: { file: 'candidate-c.wav', scDepth: 0.25, delayMix: 0.22, delayFb: 0.42, drive: 2.0 },
  d: { file: 'candidate-d.wav', scDepth: 0.6, delayMix: 0.34, delayFb: 0.45, drive: 2.0 },
};
if (!META[STYLE]) throw new Error(`unknown --style=${STYLE} (a|b|c|d)`);
const OUT_WAV = ARGS.out ? resolve(ARGS.out) : resolve(HERE, `../remotion/public/music/${META[STYLE].file}`);
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

// ---------- extra instruments (styles b / c / d) ----------

/** Additive piano: slightly inharmonic partials that decay faster the higher they are, plus a hammer tick. */
function piano(b, notes, t0, dur, o = {}) {
  const { g = 0.25, bright = 1, release = 0.3 } = o;
  const s0 = S(t0), len = S(dur + release);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (const m of notes) {
    const f = mtof(m);
    const pan = Math.max(-0.6, Math.min(0.6, (m - 64) / 30));
    const gl = Math.sqrt((1 - pan) / 2), gr = Math.sqrt((1 + pan) / 2);
    const nd = 1.9 * Math.pow(2, -(m - 60) / 24);
    for (let k = 1; k <= 7; k++) {
      const fk = f * k * Math.sqrt(1 + 0.00035 * k * k);
      if (fk > SR * 0.4) break;
      const amp = Math.pow(k, -1.3) * (k === 1 ? 1 : 0.7 * bright);
      const dk = nd / (1 + 0.5 * (k - 1));
      const w = (2 * Math.PI * fk) / SR, c2 = 2 * Math.cos(w);
      const ph = (rnd() + 1) * Math.PI;
      let y1 = Math.sin(ph - w), y2 = Math.sin(ph - 2 * w);
      const end = Math.min(len, S(dk * 9));
      for (let i = 0; i < end; i++) {
        const y = c2 * y1 - y2; y2 = y1; y1 = y;
        const tt = i / SR;
        let e = Math.exp(-tt / dk) * Math.min(1, tt / 0.002);
        if (tt > dur) e *= Math.max(0, 1 - (tt - dur) / release);
        const v = y * amp * e;
        L[i] += v * gl; R[i] += v * gr;
      }
    }
    const lp = new Biquad('lp', 2500 + f, 0.7), hl = S(0.012);
    for (let i = 0; i < hl && i < len; i++) { const v = lp.p(rnd()) * 0.25 * (1 - i / hl); L[i] += v; R[i] += v; }
  }
  const norm = g / Math.sqrt(notes.length);
  for (let i = 0; i < len; i++) put(b, s0 + i, L[i] * norm, R[i] * norm);
}

/** Whistle-like lead: sine with a small scoop into the note, delayed vibrato and breath. */
function whistle(b, m, t0, dur, g = 0.2) {
  const s0 = S(t0), rel = 0.08, len = S(dur + rel), f = mtof(m);
  const bp = new Biquad('bp', f * 2, 4);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const scoop = 1 - 0.03 * Math.exp(-tt / 0.03);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * tt) * Math.min(1, tt / 0.15);
    ph += (2 * Math.PI * f * scoop * vib) / SR;
    let e = Math.min(1, tt / 0.03);
    if (tt > dur) e *= Math.max(0, 1 - (tt - dur) / rel);
    const v = (Math.sin(ph) + 0.08 * Math.sin(2 * ph) + bp.p(rnd()) * 0.25) * e * g;
    put(b, s0 + i, v * 0.9, v);
  }
}

/** Foot stomp: a low, roomy thud (feeds the sidechain lightly). */
function stomp(t, g = 1) {
  kicks.push([t, g * 0.7]);
  const s0 = S(t), len = S(0.45);
  const lp = new Biquad('lp', 500, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += (2 * Math.PI * (48 + 70 * Math.exp(-tt / 0.04))) / SR;
    let v = Math.sin(ph) * Math.exp(-tt / 0.16) * 1.1 + lp.p(rnd()) * Math.exp(-tt / 0.05) * 0.9;
    v = Math.tanh(v * 1.5) * 0.9 * g;
    put(drums, s0 + i, v, v);
  }
}
function clapStack(t, g = 0.8) { clap(t - 0.006, g * 0.55); clap(t, g); clap(t + 0.009, g * 0.5); }
function tamb(t, g = 0.1, pan = 0.3) {
  const s0 = S(t), len = S(0.12);
  const b1 = new Biquad('bp', 6800, 3), b2 = new Biquad('hp', 9000, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR, n = rnd();
    const v = (b1.p(n) * 1.6 + b2.p(n) * 0.6) * Math.exp(-tt / 0.035) * Math.min(1, tt / 0.001) * g;
    put(drums, s0 + i, v * (1 - pan), v * (1 + pan));
  }
}

/** Taiko / toms: pitched membrane with a skin slap. */
function drum(t, g, f0, body, pan = 0, bus = drums) {
  const s0 = S(t), len = S(body * 2.4);
  const lp = new Biquad('lp', 900, 0.7);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = f0 * (1 + 0.8 * Math.exp(-tt / 0.035));
    ph += (2 * Math.PI * f) / SR; ph2 += (2 * Math.PI * f * 1.58) / SR;
    let v = Math.sin(ph) * Math.exp(-tt / body) + Math.sin(ph2) * Math.exp(-tt / (body * 0.3)) * 0.35 + lp.p(rnd()) * Math.exp(-tt / 0.04) * 0.8;
    v = Math.tanh(v * 1.6) * g * 0.9;
    put(bus, s0 + i, v * (1 - pan * 0.5), v * (1 + pan * 0.5));
  }
}
function taiko(t, g = 1, f0 = 58) { kicks.push([t, g * 0.5]); drum(t, g, f0, 0.38); }
function tom(t, g = 0.6, f0 = 120, pan = 0) { drum(t, g, f0, 0.18, pan); }
function shaker(t, g = 0.08, pan = 0.2) {
  const s0 = S(t), len = S(0.07), bp = new Biquad('bp', 5200, 1.5);
  for (let i = 0; i < len; i++) { const tt = i / SR; const v = bp.p(rnd()) * Math.min(1, tt / 0.008) * Math.exp(-tt / 0.025) * g * 2; put(drums, s0 + i, v * (1 - pan), v * (1 + pan)); }
}
function rim(t, g = 0.3) {
  const s0 = S(t), len = S(0.05), bp = new Biquad('bp', 1800, 3);
  let ph = 0;
  for (let i = 0; i < len; i++) { const tt = i / SR; ph += (2 * Math.PI * 820) / SR; const v = (bp.p(rnd()) * 1.5 + Math.sin(ph) * 0.4) * Math.exp(-tt / 0.012) * g; put(drums, s0 + i, v * 0.8, v); }
}

const VOWELS = { ah: [800, 1150, 2800], oh: [480, 850, 2600], ee: [320, 2200, 3000] };
/** Formant "voice": a saw through three vowel band-passes — choir pads and vocal-chop plucks, no real vocals. */
function vox(b, notes, t0, dur, o = {}) {
  const { g = 0.2, vowel = 'ah', attack = 0.01, decay = 0, release = 0.08, vib = 0.004, pan = 0 } = o;
  const [f1, f2, f3] = VOWELS[vowel];
  const s0 = S(t0), len = S(dur + release);
  const gl = Math.sqrt((1 - pan) / 2) * 3, gr = Math.sqrt((1 + pan) / 2) * 3;
  for (const m of notes) {
    const f = mtof(m), osc = new Saw(f);
    const b1 = new Biquad('bp', f1, 6), b2 = new Biquad('bp', f2, 8), b3 = new Biquad('bp', f3, 10);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      if (vib && i % 16 === 0) osc.dt = (f * (1 + vib * Math.sin(2 * Math.PI * 5.2 * tt))) / SR;
      const s = osc.next();
      let v = b1.p(s) + b2.p(s) * 0.55 + b3.p(s) * 0.25;
      let a = tt < attack ? tt / attack : 1;
      if (decay && tt > attack) a *= Math.exp(-(tt - attack) / decay);
      if (tt > dur) a *= Math.max(0, 1 - (tt - dur) / release);
      v *= a * g / Math.sqrt(notes.length);
      put(b, s0 + i, v * gl, v * gr);
    }
  }
}

/** FM electric piano (Rhodes-ish): bright attack that mellows, tremolo panning, a faint tine bell. */
function rhodes(b, notes, t0, dur, o = {}) {
  const { g = 0.22, release = 0.25 } = o;
  const s0 = S(t0), len = S(dur + release);
  for (const m of notes) {
    const f = mtof(m), w = (2 * Math.PI * f) / SR;
    const nd = 1.6 * Math.pow(2, -(m - 60) / 24);
    const end = Math.min(len, S(nd * 7 + 0.05));
    const tp = rnd() * Math.PI;
    for (let i = 0; i < end; i++) {
      const tt = i / SR;
      const I = 1.6 * Math.exp(-tt / 0.25) + 0.25;
      let e = Math.exp(-tt / nd) * Math.min(1, tt / 0.003);
      if (tt > dur) e *= Math.max(0, 1 - (tt - dur) / release);
      const car = w * i;
      const v = (Math.sin(car + Math.sin(car) * I) + Math.sin(car * 14.1) * Math.exp(-tt / 0.04) * 0.05) * e * g / Math.sqrt(notes.length);
      const trem = 0.25 * Math.sin(2 * Math.PI * 4.5 * tt + tp);
      put(b, s0 + i, v * (1 + trem), v * (1 - trem));
    }
  }
}

/** Sine sub with a touch of saturation. */
function subBass(b, m, t0, dur, g = 0.5) {
  const s0 = S(t0), rel = 0.06, len = S(dur + rel), w = (2 * Math.PI * mtof(m)) / SR;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let e = Math.min(1, tt / 0.01);
    if (tt > dur) e *= Math.max(0, 1 - (tt - dur) / rel);
    const v = Math.tanh(Math.sin(w * i) * 1.3) * e * g;
    put(b, s0 + i, v, v);
  }
}

// ---------- shared helpers ----------
const ARP = [0, 2, 4, 3, 5, 4, 2, 1, 0, 2, 4, 5, 3, 4, 2, 4];
const PLUCK = { voices: 2, detune: 8, cutoff: 700, envCut: 6000, envDecay: 0.09, decay: 0.18, release: 0.15, spread: 0.3 };
const before = (t, end) => t < end - 1e-9;
function eachBar(start, end, fn) { for (let bt = start; before(bt, end); bt += BAR) fn(bt, Math.round((bt - start) / BAR), Math.min(bt + BAR, end)); }
/** Note length for melody lines written as 8ths with `null` rests: hold until the next note. */
const holdOf = (line, j) => { let n = 1; while (j + n < line.length && line[j + n] == null) n++; return n * (BEAT / 2) - 0.05; };
function snareFill(tEnd) { for (let j = 0; j < 4; j++) snare(tEnd - BEAT + j * (BEAT / 4), 0.3 + 0.12 * j); }
function snareRoll(tEnd) { for (let j = 0; j < 8; j++) snare(tEnd - BEAT + j * (BEAT / 8), 0.2 + 0.08 * j); }
function glassyArp(start, end, prog, g) {
  eachBar(start, end, (bt, bi) => {
    const P = prog[bi % 4], ext = [...P.chord.map((m) => m + 12), ...P.chord.map((m) => m + 24)];
    for (let s = 0; s < 16; s++) { const t = bt + (s * BEAT) / 4; if (!before(t, end)) break; synth(lead, [ext[ARP[s % 16] % ext.length]], t, 0.05, { ...PLUCK, g }); }
  });
}
/** Cue-grid effects shared by the candidate styles (b/c/d): the same risers, impacts and crashes as style a. */
function commonCues() {
  riser(15, 3, 0.5); revCymbal(16.5, 1.5, 0.45);
  impact(18, 1);
  crash(27, 0.45);
  riser(49, 3, 0.5); revCymbal(51, 1, 0.4);
  crash(52, 0.45); for (const t of [62, 72, 82]) crash(t, 0.45);
  crash(90, 0.3);
  riser(116, 2, 0.55);
  impact(118, 1); crash(126, 0.55);
  revCymbal(136.5, 0.5, 0.45);
  riser(140, 2, 0.5); revCymbal(141, 1, 0.4); impact(142, 0.7);
}

// =====================================================================================
// STYLE A · the current track (C major electro-pop). Kept exactly as it was.
// =====================================================================================
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
// A minor colour for the moonlit section: Am–Em–F–Dm.
const PROG_MOON = [
  { root: 45, chord: [57, 60, 64] }, // Am
  { root: 40, chord: [55, 59, 64] }, // Em
  { root: 41, chord: [57, 60, 65] }, // F
  { root: 38, chord: [57, 62, 65] }, // Dm
];
const LEAD_PLUCK = { g: 0.28, voices: 2, detune: 6, cutoff: 1200, envCut: 5000, envDecay: 0.12, decay: 0.3, release: 0.1, spread: 0.3 };
const LEAD_SAW = { g: 0.32, voices: 7, detune: 20, cutoff: 2500, envCut: 3000, envDecay: 0.2, release: 0.12, spread: 0.7 };

function groove(start, end, o) {
  for (let bt = start; bt < end - 1e-9; bt += BAR) {
    const barIdx = Math.round((bt - start) / BAR);
    const P = (o.prog ?? PROG)[barIdx % 4];
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

function bigHit(t, chordIdx, dur = 0.7, release = 0.4) {
  const P = PROG[chordIdx];
  kick(t, 1.1);
  impact(t, 0.8);
  synth(music, [P.root, ...P.chord, P.chord[0] + 12], t, dur, { g: 0.55, voices: 7, detune: 25, cutoff: 4000, envCut: 4000, envDecay: 0.3, release, spread: 0.9, sub: 0.3 });
}

function arrangeA() {
  const FULL = { kick: 'four', clap: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 3000, g: 0.22 }, arp: 0.18 };
  const DROP2 = { kick: 'four', kickG: 1.05, clap: true, snareLayer: true, hats: '16', openHat: true, bass: 'pump', stabs: true, pad: { cutoff: 5000, g: 0.22 }, arp: 0.18, lead: 'saw' };

  // ACT 1 · 0–18 reflective opening under subtitles: warm pad + soft arp, a light pulse, no full drums
  groove(0, 8, { pad: { cutoff: 800, g: 0.22, attack: 0.8 }, arp: 0.1 });
  groove(8, 14, { kick: 'faint', hats: '8', hatG: 0.3, bass: 'sustain', bassG: 0.25, pad: { cutoff: 1400, g: 0.24, attack: 0.4 }, arp: 0.16 });
  groove(14, 18, { kick: 'faint', hats: '8', hatG: 0.35, arp: 0.18 });
  synth(music, [41, 57, 60, 65, 72], 14, 3.95, { g: 0.42, voices: 7, detune: 22, cutoff: 2600, attack: 3.0, release: 0.05, spread: 0.9 });
  riser(15, 3, 0.5);
  revCymbal(16.5, 1.5, 0.45);

  // ACT 2 · 18.0 first drop (key press, canvas burst); change at 20; cast hits on every beat 27–33
  impact(18, 1);
  groove(18, 20, { ...FULL });
  groove(20, 27, { ...FULL, lead: 'pluck' });
  crash(27, 0.45);
  groove(27, 33, { hats: '16', bass: 'pump', pad: { cutoff: 3000, g: 0.18 } });
  for (let t = 27; t < 33 - 1e-9; t += BEAT) {
    const P = PROG[Math.floor((t - 27) / BAR) % 4];
    kick(t, 1);
    synth(music, P.chord.map((m) => m + 12), t, 0.16, { g: 0.4, voices: 5, detune: 22, cutoff: 1200, envCut: 5000, envDecay: 0.08, release: 0.1, spread: 0.8 });
  }

  // ACT 3 · 33–47 voice demo: nearly nothing, a soft low-passed pad under the character voices
  groove(33, 47, { pad: { cutoff: 450, g: 0.1, attack: 0.5 } });

  // ACT 4a · 47–52 launcher: airy glassy arp, riser into 52
  groove(47, 52, { pad: { cutoff: 3500, g: 0.12, attack: 0.3 }, arp: 0.22 });
  riser(49, 3, 0.5);
  revCymbal(51, 1, 0.4);

  // ACT 4b · 52–90 four worlds, a layer added every 10 s
  groove(52, 62, { kick: 'four', hats: '8', bass: 'pump', pad: { cutoff: 1500, g: 0.25 } });
  groove(62, 72, { kick: 'four', clap: true, hats: '16', bass: 'pump', pad: { cutoff: 1800, g: 0.25 } });
  groove(72, 82, { kick: 'four', clap: true, hats: '16', bass: 'pump', stabs: true, pad: { cutoff: 2500, g: 0.24 } });
  groove(82, 90, { ...FULL, lead: 'pluck' });
  crash(52, 0.45);
  for (const t of [62, 72, 82]) { snareFill(t); crash(t, 0.45); }
  snareRoll(90);

  // ACT 5 · 90–118 infinite exploration (moonlit): minor colour, melodic, lighter, no clap
  crash(90, 0.3);
  groove(90, 118, { prog: PROG_MOON, kick: 'soft', hats: '8', hatG: 0.4, bass: 'sustain', bassG: 0.35, pad: { cutoff: 2200, g: 0.28, attack: 0.3 }, arp: 0.24 });
  riser(116, 2, 0.55);

  // ACT 6 · 118–136 second drop
  impact(118, 1);
  groove(118, 136, DROP2);
  crash(126, 0.55);

  // ACT 7 · 136–150 formula: one silent beat, three hits, hit + swell, brief groove, final hit, outro
  revCymbal(136.5, 0.5, 0.45);
  bigHit(137, 0); bigHit(138, 1); bigHit(139, 2);
  bigHit(140, 3, 0.4, 0.2);
  synth(music, [41, 57, 60, 65, 72], 140, 2.0, { g: 0.5, voices: 7, detune: 25, cutoff: 2500, attack: 1.8, release: 0.05, spread: 0.9 });
  riser(140, 2, 0.5);
  revCymbal(141, 1, 0.4);
  impact(142, 0.7);
  groove(142, 144, DROP2);
  bigHit(144, 0, 1.4, 1.0);
  synth(music, [36, 48, 60, 64, 67, 72], 144.3, 5.0, { g: 0.3, voices: 7, detune: 20, cutoff: 1800, attack: 0.8, release: 0.7, spread: 0.9 });
  groove(146, 150, { arp: 0.07 });
}

// =====================================================================================
// STYLE B · "Sunrise Pop" — D major, vi–IV–I–V. Piano, stomp-and-clap, tambourine, a whistled hook.
// =====================================================================================
const PROG_B = [
  { root: 35, chord: [62, 66, 71] }, // Bm
  { root: 43, chord: [62, 67, 71] }, // G
  { root: 38, chord: [62, 66, 69] }, // D
  { root: 33, chord: [61, 64, 69] }, // A
];
const PROG_B_MOON = [
  { root: 35, chord: [62, 66, 71] }, // Bm
  { root: 43, chord: [62, 67, 71] }, // G
  { root: 40, chord: [59, 64, 67] }, // Em
  { root: 42, chord: [61, 66, 69] }, // F#m
];
const HOOK_B = [
  [78, null, 78, 81, 78, 76, 74, null],
  [74, null, 74, 79, 78, 76, 74, 71],
  [74, 76, 78, null, 78, 81, 83, null],
  [81, null, 78, 76, 73, null, 76, null],
];

function grooveB(start, end, o) {
  const prog = o.prog ?? PROG_B;
  eachBar(start, end, (bt, bi, be) => {
    const P = prog[bi % 4];
    for (let k = 0; k < 4; k++) {
      const t = bt + k * BEAT;
      if (!before(t, end)) break;
      if (o.stomp === 'full') { if (k === 0 || k === 2) stomp(t, 1); if (k === 1) stomp(t + BEAT / 2, 0.55); }
      if (o.stomp === 'half' && k === 0) stomp(t, 0.8);
      if (o.stomp === 'faint' && k % 2 === 0) stomp(t, 0.25);
      if (o.clap && (k === 1 || k === 3)) clapStack(t, o.clapG ?? 0.8);
      const tg = o.tambG ?? 1;
      if (o.tamb === '16') for (let j = 0; j < 4; j++) tamb(t + (j * BEAT) / 4, (j % 2 ? 0.07 : 0.11) * tg, j % 2 ? 0.35 : -0.25);
      if (o.tamb === '8') { tamb(t, 0.06 * tg, -0.2); tamb(t + BEAT / 2, 0.1 * tg, 0.3); }
      if (o.piano === 'quarter') piano(music, P.chord, t, 0.42, { g: o.pianoG ?? 0.3 });
      if (o.piano === 'eighth') {
        piano(music, P.chord, t, 0.2, { g: (o.pianoG ?? 0.3) * 0.9 });
        piano(music, P.chord.map((m) => m + 12), t + BEAT / 2, 0.2, { g: (o.pianoG ?? 0.3) * 0.55 });
      }
    }
    if (o.piano === 'whole') piano(music, [P.chord[0] - 12, ...P.chord], bt, be - bt - 0.05, { g: o.pianoG ?? 0.25, release: 0.6 });
    if (o.piano === 'broken') {
      const ns = [P.chord[0] - 12, P.chord[0], P.chord[1], P.chord[2], P.chord[0] + 12, P.chord[2], P.chord[1], P.chord[0]];
      for (let j = 0; j < 8; j++) { const t = bt + (j * BEAT) / 2; if (!before(t, end)) break; piano(music, [ns[j]], t, 0.45, { g: o.pianoG ?? 0.22 }); }
    }
    if (o.leftHand) { piano(music, [P.root + 12], bt, 0.9, { g: 0.26 }); if (before(bt + 2 * BEAT, end)) piano(music, [P.root + 12], bt + 2 * BEAT, 0.9, { g: 0.2 }); }
    if (o.bass === 'bounce') {
      for (let j = 0; j < 8; j++) {
        const t = bt + (j * BEAT) / 2;
        if (!before(t, end)) break;
        synth(music, [P.root + (j % 2 ? 12 : 0)], t, 0.2, { g: 0.42, voices: 1, cutoff: 500, envCut: 900, envDecay: 0.05, sub: 0.8, release: 0.04 });
      }
    }
    if (o.bass === 'sustain') synth(music, [P.root], bt, be - bt - 0.05, { g: o.bassG ?? 0.35, voices: 1, cutoff: 400, sub: 0.9, attack: 0.02, release: 0.1 });
    if (o.pad) synth(music, [...P.chord, P.chord[1] + 12], bt, be - bt - 0.02, { g: o.pad.g, voices: 6, detune: 14, cutoff: o.pad.cutoff, attack: o.pad.attack ?? 0.15, release: 0.3, spread: 0.9 });
    if (o.hook) {
      const line = HOOK_B[bi % 4];
      for (let j = 0; j < 8; j++) {
        const t = bt + (j * BEAT) / 2;
        if (line[j] == null || !before(t, end)) continue;
        whistle(lead, line[j], t, Math.min(holdOf(line, j), 0.7), o.hook);
      }
    }
  });
  if (o.arp) glassyArp(start, end, prog, o.arp);
}

function clapFill(tEnd) { for (let j = 0; j < 4; j++) clap(tEnd - BEAT + j * (BEAT / 4), 0.3 + 0.12 * j); }
function bigHitB(t, idx, dur = 0.7, release = 0.4) {
  const P = PROG_B[idx];
  stomp(t, 1.2); kick(t, 0.8); impact(t, 0.8); clapStack(t, 0.7);
  piano(music, [P.root + 12, P.chord[0] - 12, ...P.chord, P.chord[0] + 12], t, dur + 0.6, { g: 0.45, release: release + 0.4 });
  synth(music, [P.root, ...P.chord, P.chord[0] + 12], t, dur, { g: 0.36, voices: 7, detune: 18, cutoff: 3500, envCut: 3000, envDecay: 0.3, release, spread: 0.9, sub: 0.3 });
}

function arrangeB() {
  commonCues();
  const FULL_B = { stomp: 'full', clap: true, tamb: '16', piano: 'quarter', leftHand: true, bass: 'bounce', pad: { cutoff: 2500, g: 0.14 } };
  const DROP2_B = { ...FULL_B, piano: 'eighth', pianoG: 0.3, hook: 0.26, arp: 0.1, pad: { cutoff: 4000, g: 0.15 } };

  // ACT 1 · soft piano, then a pulse; swell at 14; claps build into the drop
  grooveB(0, 8, { piano: 'whole', pianoG: 0.2, pad: { cutoff: 900, g: 0.14, attack: 0.8 } });
  grooveB(8, 14, { stomp: 'faint', tamb: '8', tambG: 0.5, piano: 'quarter', pianoG: 0.18, bass: 'sustain', bassG: 0.2, pad: { cutoff: 1400, g: 0.13 } });
  grooveB(14, 18, { stomp: 'faint', tamb: '16', tambG: 0.6, piano: 'eighth', pianoG: 0.2 });
  synth(music, [38, 62, 66, 69, 74], 14, 3.95, { g: 0.36, voices: 7, detune: 16, cutoff: 2600, attack: 3.0, release: 0.05, spread: 0.9 });
  for (let j = 0; j < 8; j++) clap(16 + j * 0.25, 0.15 + 0.07 * j);

  // ACT 2 · first drop, hook from 20, cast hits every beat 27–33
  grooveB(18, 20, FULL_B);
  grooveB(20, 27, { ...FULL_B, hook: 0.24 });
  grooveB(27, 33, { tamb: '16', bass: 'bounce', pad: { cutoff: 2500, g: 0.12 } });
  for (let t = 27; before(t, 33); t += BEAT) {
    const P = PROG_B[Math.floor((t - 27) / BAR) % 4];
    stomp(t, 1);
    if (Math.round((t - 27) / BEAT) % 2) clapStack(t, 0.6);
    piano(music, [P.chord[0] - 12, ...P.chord, P.chord[0] + 12], t, 0.3, { g: 0.34 });
  }

  // ACT 3 · voice demo: a soft low pad only
  grooveB(33, 47, { pad: { cutoff: 450, g: 0.09, attack: 0.5 } });
  // ACT 4a · launcher: glassy arp
  grooveB(47, 52, { pad: { cutoff: 3500, g: 0.09, attack: 0.3 }, arp: 0.2 });

  // ACT 4b · four worlds, a layer every 10 s
  grooveB(52, 62, { stomp: 'full', tamb: '8', bass: 'bounce', piano: 'whole', pianoG: 0.22 });
  grooveB(62, 72, { stomp: 'full', clap: true, tamb: '16', bass: 'bounce', piano: 'quarter', pianoG: 0.26 });
  grooveB(72, 82, { stomp: 'full', clap: true, tamb: '16', bass: 'bounce', piano: 'quarter', leftHand: true, hook: 0.14, pad: { cutoff: 2200, g: 0.12 } });
  grooveB(82, 90, { ...FULL_B, hook: 0.24 });
  for (const t of [62, 72, 82]) clapFill(t);
  for (let j = 0; j < 8; j++) { clap(89.5 + j * (BEAT / 8), 0.2 + 0.08 * j); tamb(89.5 + j * (BEAT / 8), 0.08, 0); }

  // ACT 5 · moonlit: minor turn, broken piano, sparse long whistle notes
  grooveB(90, 118, { prog: PROG_B_MOON, stomp: 'half', tamb: '8', tambG: 0.45, piano: 'broken', pianoG: 0.24, bass: 'sustain', bassG: 0.28, pad: { cutoff: 2000, g: 0.17, attack: 0.4 } });
  const MOON_TUNE = [78, 74, 76, 73];
  eachBar(90, 116, (bt, bi) => { if (bi % 2 === 1) whistle(lead, MOON_TUNE[(bi >> 1) % 4], bt, 1.7, 0.12); });

  // ACT 6 · second drop
  grooveB(118, 136, DROP2_B);

  // ACT 7 · formula
  bigHitB(137, 0); bigHitB(138, 1); bigHitB(139, 2);
  bigHitB(140, 3, 0.4, 0.2);
  synth(music, [33, 57, 61, 64, 69], 140, 2.0, { g: 0.42, voices: 7, detune: 20, cutoff: 2500, attack: 1.8, release: 0.05, spread: 0.9 });
  grooveB(142, 144, DROP2_B);
  bigHitB(144, 2, 1.4, 1.0);
  piano(music, [38, 50, 62, 66, 69, 74], 144.3, 5.0, { g: 0.3, release: 0.7 });
  synth(music, [38, 50, 62, 66, 69], 144.3, 5.0, { g: 0.18, voices: 6, detune: 14, cutoff: 1600, attack: 0.8, release: 0.7, spread: 0.9 });
  glassyArp(146, 150, PROG_B, 0.06);
}

// =====================================================================================
// STYLE C · "Epic Hybrid" — D minor, i–VI–III–VII. Taiko ostinato, braams, strings, a horn theme, choir.
// =====================================================================================
const PROG_C = [
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 34, chord: [62, 65, 70] }, // Bb
  { root: 41, chord: [60, 65, 69] }, // F
  { root: 36, chord: [60, 64, 67] }, // C
];
const PROG_C_MOON = [
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 34, chord: [62, 65, 70] }, // Bb
  { root: 33, chord: [61, 64, 69] }, // A
];
const HOOK_C = [
  [74, null, null, 77, 76, null, 74, null],
  [74, null, null, 72, 70, null, 69, null],
  [69, null, 72, null, 77, null, 76, 74],
  [76, null, null, null, 72, null, null, null],
];
const TAIKO = { 0: 1, 3: 0.55, 6: 0.7, 8: 0.9, 11: 0.5, 14: 0.65 };
const TOMS = { 4: [0.45, 150], 12: [0.5, 130], 15: [0.35, 175] };
const OST = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 0, 2, 3, 2];

function strings(b, notes, t0, dur, o = {}) {
  synth(b, notes, t0, dur, { g: o.g ?? 0.2, voices: 8, detune: 12, cutoff: o.cutoff ?? 2400, attack: o.attack ?? 0.35, release: o.release ?? 0.5, spread: 1 });
}
function brassStab(notes, t0, dur, g) {
  synth(music, notes, t0, dur, { g, voices: 5, detune: 10, cutoff: 280, envCut: 2200, envDecay: 0.22, attack: 0.02, release: 0.18, spread: 0.6, sub: 0.25 });
}
function braam(t, dur, root, g = 0.6) {
  synth(music, [root, root + 7, root + 12, root + 19], t, dur, { g, voices: 9, detune: 28, cutoff: 220, envCut: 2600, envDecay: 0.8, attack: 0.03, release: 1.0, spread: 1, sub: 0.5 });
}
function choir(notes, t0, dur, g = 0.18, attack = 0.6) { vox(music, notes, t0, dur, { g, vowel: 'ah', attack, release: 0.6, vib: 0.005 }); }

function grooveC(start, end, o) {
  const prog = o.prog ?? PROG_C;
  eachBar(start, end, (bt, bi, be) => {
    const P = prog[bi % 4];
    for (let s = 0; s < 16; s++) {
      const t = bt + (s * BEAT) / 4;
      if (!before(t, end)) break;
      if (o.taiko === 'full' && TAIKO[s]) taiko(t, TAIKO[s] * (o.taikoG ?? 1), 58);
      if (o.taiko === 'light' && (s === 0 || s === 8)) taiko(t, 0.45, 56);
      if (o.toms && TOMS[s]) tom(t, TOMS[s][0], TOMS[s][1], s % 2 ? 0.4 : -0.4);
      if (o.shaker && s % 2 === 0) shaker(t, s % 4 ? 0.05 : 0.08, s % 4 ? 0.3 : -0.3);
      if (o.ost) {
        const ext = [P.chord[0] - 12, P.chord[1] - 12, P.chord[2] - 12, P.chord[0]];
        synth(music, [ext[OST[s]]], t, 0.09, { g: o.ost, voices: 3, detune: 10, cutoff: o.ostCut ?? 1400, envCut: 2500, envDecay: 0.06, decay: 0.1, release: 0.06, spread: 0.8 });
      }
    }
    for (let k = 0; k < 4; k++) {
      const t = bt + k * BEAT;
      if (!before(t, end)) break;
      if (o.kickDown && k % 2 === 0) kick(t, 0.8);
      if (o.snareHit && (k === 1 || k === 3)) { snare(t, 0.75); clap(t, 0.4); }
    }
    if (o.brass) { brassStab([P.root + 12, ...P.chord.map((m) => m - 12)], bt, 0.3, o.brass); if (before(bt + 1.5 * BEAT, end)) brassStab([P.root + 12, ...P.chord.map((m) => m - 12)], bt + 1.5 * BEAT, 0.2, o.brass * 0.8); }
    if (o.bass) synth(music, [P.root], bt, be - bt - 0.05, { g: o.bass, voices: 3, detune: 8, cutoff: 260, sub: 0.8, attack: 0.02, release: 0.15, spread: 0.2 });
    if (o.pad) strings(music, [P.chord[0] - 12, ...P.chord, P.chord[2] + 12], bt, be - bt - 0.02, o.pad);
    if (o.choir) choir([P.chord[0], P.chord[1], P.chord[2]], bt, be - bt - 0.05, o.choir, 0.5);
    if (o.hook) {
      const line = HOOK_C[bi % 4];
      for (let j = 0; j < 8; j++) {
        const t = bt + (j * BEAT) / 2;
        if (line[j] == null || !before(t, end)) continue;
        synth(lead, [line[j] - 12, line[j]], t, holdOf(line, j), { g: o.hook, voices: 3, detune: 8, cutoff: 900, envCut: 1600, envDecay: 0.3, attack: 0.06, release: 0.2, spread: 0.4 });
      }
    }
  });
  if (o.arp) glassyArp(start, end, prog, o.arp);
}
function tomFill(tEnd) { [190, 160, 130, 100].forEach((f, j) => tom(tEnd - BEAT + j * (BEAT / 4), 0.5 + 0.1 * j, f, j % 2 ? 0.4 : -0.4)); }
function bigHitC(t, idx, dur = 0.7, release = 0.4) {
  const P = PROG_C[idx];
  taiko(t, 1.3, 55); kick(t, 0.9); impact(t, 0.9);
  braam(t, dur + 0.3, P.root, 0.5);
  brassStab([P.root + 12, ...P.chord.map((m) => m - 12)], t, dur, 0.45);
  strings(music, [P.chord[0] - 12, ...P.chord, P.chord[0] + 12], t, dur, { g: 0.3, attack: 0.02, release });
}

function arrangeC() {
  commonCues();
  const FULL_C = { taiko: 'full', toms: true, kickDown: true, snareHit: true, shaker: true, bass: 0.4, pad: { g: 0.2, cutoff: 3000, attack: 0.2 }, ost: 0.16, brass: 0.34 };
  const DROP2_C = { ...FULL_C, taikoG: 1.1, hook: 0.3, choir: 0.12, pad: { g: 0.22, cutoff: 4200, attack: 0.15 } };

  // ACT 1 · strings and choir wake up; a light taiko heartbeat; swell at 14; toms build into 18
  grooveC(0, 8, { pad: { g: 0.18, cutoff: 900, attack: 1.2 }, choir: 0.07 });
  grooveC(8, 14, { taiko: 'light', pad: { g: 0.18, cutoff: 1300, attack: 0.5 }, ost: 0.08, ostCut: 900, bass: 0.2 });
  grooveC(14, 18, { taiko: 'light', ost: 0.12, ostCut: 1300 });
  strings(music, [38, 50, 62, 65, 69, 74], 14, 3.95, { g: 0.4, cutoff: 2600, attack: 3.0, release: 0.05 });
  choir([62, 65, 69], 14, 3.95, 0.16, 3.0);
  for (let j = 0; j < 16; j++) tom(16 + j * 0.125, 0.18 + 0.03 * j, 120 + (j % 4) * 15, j % 2 ? 0.4 : -0.4);

  // ACT 2 · braam on the drop; theme from 20; cast hits every beat 27–33
  braam(18, 2.0, 38, 0.6);
  grooveC(18, 20, FULL_C);
  grooveC(20, 27, { ...FULL_C, hook: 0.3 });
  grooveC(27, 33, { shaker: true, bass: 0.35, pad: { g: 0.16, cutoff: 3000, attack: 0.1 } });
  for (let t = 27; before(t, 33); t += BEAT) {
    const P = PROG_C[Math.floor((t - 27) / BAR) % 4];
    taiko(t, 0.9, 58); kick(t, 0.7);
    brassStab([P.root + 12, ...P.chord.map((m) => m - 12)], t, 0.16, 0.4);
  }

  // ACT 3 · voice demo: a distant string pad only
  grooveC(33, 47, { pad: { g: 0.09, cutoff: 450, attack: 0.6 } });
  // ACT 4a · launcher: glassy celesta-like arp over high strings
  grooveC(47, 52, { pad: { g: 0.08, cutoff: 3500, attack: 0.4 }, arp: 0.2 });

  // ACT 4b · four worlds
  grooveC(52, 62, { taiko: 'full', taikoG: 0.8, bass: 0.35, pad: { g: 0.18, cutoff: 1800 } });
  grooveC(62, 72, { taiko: 'full', toms: true, snareHit: true, bass: 0.38, pad: { g: 0.18, cutoff: 2200 }, ost: 0.14 });
  grooveC(72, 82, { taiko: 'full', toms: true, snareHit: true, shaker: true, bass: 0.4, pad: { g: 0.18, cutoff: 2600 }, ost: 0.15, brass: 0.3 });
  grooveC(82, 90, { ...FULL_C, hook: 0.3 });
  for (const t of [62, 72, 82]) tomFill(t);
  for (let j = 0; j < 8; j++) taiko(89.5 + j * (BEAT / 8), 0.3 + 0.09 * j, 70);

  // ACT 5 · moonlit: choir, harp-like arp, soft heartbeat, sparse theme
  grooveC(90, 118, { prog: PROG_C_MOON, taiko: 'light', choir: 0.16, pad: { g: 0.18, cutoff: 2000, attack: 0.5 }, ost: 0.08, ostCut: 1500, bass: 0.28, arp: 0.14 });
  eachBar(98, 114, (bt, bi) => { if (bi % 2 === 0) synth(lead, [74, 62], bt, 1.8, { g: 0.16, voices: 3, detune: 8, cutoff: 900, attack: 0.3, release: 0.4, spread: 0.4 }); });

  // ACT 6 · second drop
  braam(118, 2.0, 38, 0.65);
  grooveC(118, 136, DROP2_C);

  // ACT 7 · formula
  bigHitC(137, 0); bigHitC(138, 1); bigHitC(139, 2);
  bigHitC(140, 3, 0.4, 0.2);
  strings(music, [33, 45, 57, 61, 64, 69], 140, 2.0, { g: 0.42, cutoff: 2500, attack: 1.8, release: 0.05 });
  choir([61, 64, 69], 140, 2.0, 0.16, 1.8);
  braam(142, 1.5, 38, 0.5);
  grooveC(142, 144, DROP2_C);
  bigHitC(144, 0, 1.4, 1.0);
  strings(music, [38, 50, 62, 65, 69, 74], 144.3, 5.0, { g: 0.3, cutoff: 1800, attack: 0.8, release: 0.7 });
  choir([62, 65, 69], 144.3, 5.0, 0.12, 0.8);
  glassyArp(146, 150, PROG_C, 0.06);
}

// =====================================================================================
// STYLE D · "Future Garage" — F minor, rootless 9ths. 2-step shuffle, Rhodes, formant vocal chops, deep sub.
// =====================================================================================
const PROG_D = [
  { root: 41, chord: [56, 60, 63, 67] }, // Fm9
  { root: 37, chord: [60, 61, 65, 68] }, // Dbmaj7
  { root: 34, chord: [56, 60, 61, 65] }, // Bbm9
  { root: 39, chord: [55, 58, 62, 65] }, // Eb(add9)
];
const PROG_D_MOON = [
  { root: 41, chord: [56, 60, 63, 67] }, // Fm9
  { root: 44, chord: [55, 60, 63, 67] }, // Abmaj7
  { root: 37, chord: [60, 61, 65, 68] }, // Dbmaj7
  { root: 36, chord: [55, 60, 64, 67] }, // C
];
const CHOP_STEPS = [2, 5, 8, 10, 13];
const CHOP_D = [
  [72, 75, 72, 68, 70],
  [72, 77, 75, 72, 68],
  [70, 72, 75, 77, 75],
  [68, 70, 72, 70, 67],
];
const CHOP_VOWELS = ['ah', 'oh', 'ah', 'ee', 'oh'];
const SW = 0.034; // 16th swing
const swung = (bt, s) => bt + (s * BEAT) / 4 + (s % 2 ? SW : 0);

function grooveD(start, end, o) {
  const prog = o.prog ?? PROG_D;
  eachBar(start, end, (bt, bi, be) => {
    const P = prog[bi % 4];
    for (let s = 0; s < 16; s++) {
      const t = swung(bt, s);
      if (!before(t, end)) break;
      if (o.drums === '2step') {
        if (s === 0) kick(t, 1);
        if (s === 10) kick(t, 0.85);
        if (o.busy && s === 7) kick(t, 0.5);
        if (s === 4 || s === 12) { snare(t, 0.55); clap(t, 0.55); }
        if (s === 6 || s === 14 || s === 9) snare(t, 0.12);
        if (s % 2 === 1) hat(t, 0.13 * (o.hatG ?? 1), false, s % 4 === 1 ? -0.3 : 0.3);
        else if (s % 4 === 2) hat(t, 0.05 * (o.hatG ?? 1), false, 0.1);
        if (o.busy && (s === 2 || s === 10)) hat(t, 0.1, true, 0.1);
        if (s === 11) rim(t, 0.22);
      }
      if (o.drums === 'half') {
        if (s === 0) kick(t, 0.9);
        if (s === 8) { snare(t, 0.5); clap(t, 0.45); }
        if (s % 2 === 1) hat(t, 0.08, false, s % 4 === 1 ? -0.3 : 0.3);
        if (s === 11) rim(t, 0.18);
      }
      if (o.drums === 'hats' && s % 2 === 1) hat(t, 0.07 * (o.hatG ?? 1), false, s % 4 === 1 ? -0.3 : 0.3);
      if (o.shaker && s % 2 === 0) shaker(t, 0.05, s % 4 ? 0.3 : -0.3);
    }
    if (o.keys === 'comp') {
      rhodes(music, P.chord, swung(bt, 0), 0.8, { g: o.keysG ?? 0.3 });
      if (before(swung(bt, 6), end)) rhodes(music, P.chord, swung(bt, 6), 0.22, { g: (o.keysG ?? 0.3) * 0.7 });
      if (before(swung(bt, 11), end)) rhodes(music, P.chord.map((m) => m + 12), swung(bt, 11), 0.3, { g: (o.keysG ?? 0.3) * 0.5 });
    }
    if (o.keys === 'whole') rhodes(music, P.chord, bt, be - bt - 0.05, { g: o.keysG ?? 0.25, release: 0.5 });
    if (o.sub) subBass(music, P.root, bt, be - bt - 0.04, o.sub);
    if (o.reese) synth(music, [P.root, P.root + 12], bt, be - bt - 0.05, { g: o.reese, voices: 4, detune: 30, cutoff: 420, attack: 0.02, release: 0.08, spread: 0.5 });
    if (o.pad) synth(music, P.chord.map((m) => m + 12), bt, be - bt - 0.02, { g: o.pad.g, voices: 6, detune: 18, cutoff: o.pad.cutoff, attack: o.pad.attack ?? 0.3, release: 0.4, spread: 1 });
    if (o.chops) {
      const line = CHOP_D[bi % 4];
      CHOP_STEPS.forEach((s, j) => {
        if (o.sparse && j % 2 === 1) return;
        const t = swung(bt, s);
        if (!before(t, end)) return;
        vox(lead, [line[j]], t, 0.1, { g: o.chops, vowel: CHOP_VOWELS[j], attack: 0.006, decay: 0.12, release: 0.05, vib: 0, pan: j % 2 ? 0.35 : -0.35 });
      });
    }
  });
  if (o.arp) glassyArp(start, end, prog, o.arp);
}
function bigHitD(t, idx, dur = 0.7, release = 0.4) {
  const P = PROG_D[idx];
  kick(t, 1.1); impact(t, 0.8); clap(t, 0.6);
  rhodes(music, [P.root + 12, ...P.chord, P.chord[0] + 12], t, dur + 0.5, { g: 0.45, release: release + 0.3 });
  subBass(music, P.root, t, dur, 0.55);
  vox(lead, [P.chord[1] + 12, P.chord[3] + 12], t, dur * 0.6, { g: 0.3, vowel: 'ah', attack: 0.005, decay: 0.25, release: 0.1, vib: 0 });
  synth(music, P.chord, t, dur, { g: 0.22, voices: 6, detune: 18, cutoff: 3000, envCut: 2500, envDecay: 0.3, release, spread: 1 });
}

function arrangeD() {
  commonCues();
  const FULL_D = { drums: '2step', keys: 'comp', sub: 0.45, reese: 0.14, pad: { g: 0.1, cutoff: 1800 } };
  const DROP2_D = { ...FULL_D, busy: true, shaker: true, chops: 0.3, reese: 0.2, keysG: 0.32, pad: { g: 0.12, cutoff: 2600 } };

  // ACT 1 · Rhodes alone, then shuffled hats and sub; swell at 14; chops tease into the drop
  grooveD(0, 8, { keys: 'whole', keysG: 0.22, pad: { g: 0.09, cutoff: 900, attack: 1.0 } });
  grooveD(8, 14, { drums: 'hats', hatG: 0.7, keys: 'comp', keysG: 0.2, sub: 0.25, pad: { g: 0.09, cutoff: 1200 } });
  grooveD(14, 18, { drums: 'hats', keys: 'comp', keysG: 0.22, chops: 0.18, sparse: true });
  rhodes(music, [53, 56, 60, 63, 67], 14, 3.95, { g: 0.32, release: 0.1 });
  synth(music, [41, 56, 60, 63, 67], 14, 3.95, { g: 0.3, voices: 7, detune: 18, cutoff: 2400, attack: 3.0, release: 0.05, spread: 1 });

  // ACT 2 · drop into the 2-step; chops from 20; cast hits every beat 27–33
  grooveD(18, 20, FULL_D);
  grooveD(20, 27, { ...FULL_D, chops: 0.26 });
  grooveD(27, 33, { drums: 'hats', sub: 0.4, pad: { g: 0.1, cutoff: 2000 } });
  for (let t = 27; before(t, 33); t += BEAT) {
    const i = Math.round((t - 27) / BEAT), P = PROG_D[Math.floor((t - 27) / BAR) % 4];
    kick(t, 1);
    if (i % 2) clap(t, 0.6);
    rhodes(music, P.chord, t, 0.25, { g: 0.34 });
    vox(lead, [P.chord[2] + 12], t, 0.08, { g: 0.2, vowel: i % 2 ? 'oh' : 'ah', attack: 0.005, decay: 0.1, release: 0.04, vib: 0 });
  }

  // ACT 3 · voice demo: a soft low pad only
  grooveD(33, 47, { pad: { g: 0.1, cutoff: 450, attack: 0.6 } });
  // ACT 4a · launcher: glassy arp, high soft Rhodes
  grooveD(47, 52, { keys: 'whole', keysG: 0.08, pad: { g: 0.06, cutoff: 3500 }, arp: 0.2 });

  // ACT 4b · four worlds
  grooveD(52, 62, { drums: 'hats', hatG: 1.2, sub: 0.42, keys: 'comp', keysG: 0.26 });
  for (let t = 52; before(t, 62); t += BAR) { kick(t, 1); kick(swung(t, 10), 0.85); }
  grooveD(62, 72, { drums: '2step', sub: 0.42, keys: 'comp', keysG: 0.28 });
  grooveD(72, 82, { drums: '2step', sub: 0.44, reese: 0.12, keys: 'comp', chops: 0.18, pad: { g: 0.09, cutoff: 1800 } });
  grooveD(82, 90, { ...FULL_D, chops: 0.26 });
  for (const t of [62, 72, 82]) snareFill(t);
  snareRoll(90);

  // ACT 5 · moonlit: half-time, spacious Rhodes, sparse chops through the delay
  grooveD(90, 118, { prog: PROG_D_MOON, drums: 'half', keys: 'whole', keysG: 0.28, sub: 0.34, chops: 0.2, sparse: true, pad: { g: 0.13, cutoff: 2000, attack: 0.5 } });

  // ACT 6 · second drop
  grooveD(118, 136, DROP2_D);

  // ACT 7 · formula
  bigHitD(137, 0); bigHitD(138, 1); bigHitD(139, 2);
  bigHitD(140, 3, 0.4, 0.2);
  synth(music, [39, 55, 58, 62, 65], 140, 2.0, { g: 0.4, voices: 7, detune: 20, cutoff: 2500, attack: 1.8, release: 0.05, spread: 1 });
  grooveD(142, 144, DROP2_D);
  bigHitD(144, 0, 1.4, 1.0);
  rhodes(music, [41, 53, 56, 60, 63, 67], 144.3, 5.0, { g: 0.32, release: 0.7 });
  synth(music, [41, 56, 60, 63, 67], 144.3, 5.0, { g: 0.16, voices: 6, detune: 18, cutoff: 1600, attack: 0.8, release: 0.7, spread: 1 });
  glassyArp(146, 150, PROG_D, 0.06);
}

({ a: arrangeA, b: arrangeB, c: arrangeC, d: arrangeD })[STYLE]();

// ---------- mix ----------
const { scDepth, delayMix, delayFb } = META[STYLE];
const sc = new Float32Array(N).fill(1);
for (const [t, g] of kicks) {
  if (g < 0.2) continue;
  const s0 = S(t), len = S(0.4);
  for (let i = 0; i < len && s0 + i < N; i++) {
    const tt = i / SR;
    const env = tt < 0.004 ? tt / 0.004 : Math.exp(-(tt - 0.004) / 0.11);
    const v = 1 - scDepth * Math.min(1, g) * env;
    if (v < sc[s0 + i]) sc[s0 + i] = v;
  }
}

// Ping-pong dotted-8th delay on the lead bus.
{
  const d = S(BEAT * 0.75), fb = delayFb, mix = delayMix;
  const dl = new Float32Array(N), dr = new Float32Array(N);
  for (let i = d; i < N; i++) {
    const inp = (lead[0][i - d] + lead[1][i - d]) * 0.5;
    dl[i] = inp + dr[i - d] * fb;
    dr[i] = dl[i - d] * fb;
  }
  for (let i = 0; i < N; i++) { lead[0][i] += dl[i] * mix; lead[1][i] += dr[i] * mix; }
}

const L = new Float32Array(N), R = new Float32Array(N);
const gOffA = S(136), gOnA = S(137), gOnFx = S(136.5), fadeIn = S(0.005);
for (let i = 0; i < N; i++) {
  // Everything but fx is gated 136–137; fx (reverse cymbal pickup) returns at 136.5.
  let gA = 1, gF = 1;
  if (i >= gOffA - fadeIn && i < gOffA) gA = gF = (gOffA - i) / fadeIn;
  if (i >= gOffA && i < gOnA) gA = 0;
  if (i >= gOffA && i < gOnFx) gF = 0;
  const lg = 0.55 + 0.45 * sc[i];
  L[i] = (drums[0][i] + music[0][i] * sc[i] + lead[0][i] * lg) * gA + fx[0][i] * gF;
  R[i] = (drums[1][i] + music[1][i] * sc[i] + lead[1][i] * lg) * gA + fx[1][i] * gF;
}

// Master: pre-normalize, tanh soft clip, final peak at -1.2 dBFS (headroom for voice + foley), fade-out 149.2–150.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const drive = META[STYLE].drive / peak;
let peak2 = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * drive); R[i] = Math.tanh(R[i] * drive);
  peak2 = Math.max(peak2, Math.abs(L[i]), Math.abs(R[i]));
}
const target = Math.pow(10, -1.2 / 20) / peak2;
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
console.log(`style ${STYLE} → wrote ${OUT_WAV}`);

// Cues describe the shared grid; only the default style-a run rewrites them (candidates use the same grid).
if (STYLE === 'a' && !ARGS.out) {
  const cues = {
    file: 'music/placeholder-120.wav',
    bpm: BPM, beatSec: BEAT, barSec: BAR, fps: 30, framesPerBeat: 15, framesPerBar: 60, durationSec: DUR,
    gridNote: 'Beats fall on multiples of 0.5 s from t=0. Chord bars restart at each section start.',
    sections: [
      { id: 'ACT1', name: 'reflective-opening', start: 0, end: 18, swell: 14 },
      { id: 'ACT2', name: 'first-drop-canvas', start: 18, end: 27, change: 20 },
      { id: 'ACT2-cast', name: 'cast-hits-every-beat', start: 27, end: 33 },
      { id: 'ACT3', name: 'voice-demo-quiet', start: 33, end: 47 },
      { id: 'ACT4-launcher', name: 'launcher-glassy', start: 47, end: 52 },
      { id: 'ACT4-worlds', name: 'four-worlds-build', start: 52, end: 90, blocks: [52, 62, 72, 82] },
      { id: 'ACT5', name: 'infinite-exploration-moonlit', start: 90, end: 118 },
      { id: 'ACT6', name: 'second-drop', start: 118, end: 136 },
      { id: 'ACT7', name: 'formula-and-logo', start: 136, end: 150 },
    ],
    impacts: [18, 118, 137, 138, 139, 140, 142, 144],
    crashes: [27, 52, 62, 72, 82, 90, 126],
    fills: [{ start: 61.5, end: 62 }, { start: 71.5, end: 72 }, { start: 81.5, end: 82 }, { start: 89.5, end: 90, kind: 'roll' }],
    risers: [{ start: 15, end: 18 }, { start: 49, end: 52 }, { start: 116, end: 118 }, { start: 140, end: 142 }],
    silence: { start: 136, end: 136.5 },
    formulaHits: [137, 138, 139],
    swell: { start: 140, end: 142 },
    finalHit: 144,
    outro: { start: 144, end: 150 },
  };
  mkdirSync(dirname(OUT_CUES), { recursive: true });
  writeFileSync(OUT_CUES, JSON.stringify(cues, null, 2) + '\n');
  console.log(`wrote ${OUT_CUES}`);
}
