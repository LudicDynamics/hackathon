/**
 * audio.ts — AIRP Web Audio synthesis engine.
 *
 * T2.0 discipline: zero audio assets, every voice synthesized at runtime.
 * One module-level AudioContext; everything hangs under a single master gain
 * so mute is one ramp away. Three ambient layers (rain / fireplace / cellar
 * drip) crossfade over 1.5s, three BGM drone moods crossfade the same way,
 * and eight foley one-shots cover card/backpack/dice/gate interactions.
 *
 * Every burst voice runs through an attack/decay envelope so nothing clicks.
 * A future asset pass may swap individual voices for buffered files behind
 * the same playFoley / setAmbient surface (loading note per voice).
 */

export type FoleyName =
  | 'paper-slide'
  | 'bag-pack'
  | 'dice-roll'
  | 'unlock'
  | 'pen-scratch'
  | 'gate-open'
  | 'crit-chime'
  | 'fumble-break';

export type BGMood = 'calm' | 'tense' | 'crisis';

type ToneKey = 'rain' | 'fireplace' | 'drip';

/** Seconds — crossfade used for ambient layers and BGM moods alike. */
const AMBIENT_FADE = 1.5;

/** Bed level per ambient layer (the drip layer is interval-scheduled; its
 *  voices envelope on top of this engine gain). */
const AMBIENT_TARGETS: Record<ToneKey, number> = {
  rain: 0.05,
  fireplace: 0.09,
  drip: 0.05,
};

/** Section gain per BGM mood — deliberately low, drones must never fight the
 *  narration. */
const BGM_TARGETS: Record<BGMood, number> = {
  calm: 0.03,
  tense: 0.045,
  crisis: 0.06,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let mutedState = false;

// Whether the app has ever picked an ambient/BGM explicitly. unlock() seeds
// the default world bed (rain + calm drone) only when nobody chose yet.
let ambientRequested = false;
let bgmRequested = false;

const noiseCache = new Map<'white' | 'brown', AudioBuffer>();

/** Lazily create the shared context + master bus. Idempotent, safe to call
 *  from anywhere; returns null when Web Audio is unavailable. */
export function initAudio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0; // silent until the first unlock()/setMuted() reasserts
    master.connect(ctx.destination);
  } catch (err) {
    console.warn('Web Audio unavailable:', err);
    ctx = null;
  }
  return ctx;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 2s noise buffer (cached): white = flat static, brown = leaky-integrator
 *  rumble. Short voices just play the head of the same buffer. */
function makeNoise(kind: 'white' | 'brown'): AudioBuffer {
  const c = ctx!;
  const cached = noiseCache.get(kind);
  if (cached) return cached;
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // one-pole leaky integrator ≈ brown spectrum
      data[i] = last * 3.5; // compensate the integrator's attenuation
    }
  }
  noiseCache.set(kind, buf);
  return buf;
}

function noiseSource(kind: 'white' | 'brown'): AudioBufferSourceNode {
  const src = ctx!.createBufferSource();
  src.buffer = makeNoise(kind);
  return src;
}

interface BurstOpts {
  /** total envelope length in seconds */
  dur: number;
  kind?: 'white' | 'brown';
  filter?: { type: BiquadFilterType; freqA: number; freqB?: number; q?: number };
  peak: number;
  attack?: number;
}

/** One-shot enveloped noise burst — the building block of every foley voice.
 *  Attack ramps 0→peak linearly (no click), decay falls exponentially to
 *  −60dB. Frequency is swept when freqB is given. */
function noiseBurst(dest: AudioNode, opts: BurstOpts, at?: number): void {
  const c = ctx!;
  const t = at ?? c.currentTime;
  const attack = opts.attack ?? 0.005;
  const dur = Math.max(opts.dur, attack + 0.01);
  const src = noiseSource(opts.kind ?? 'white');
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (opts.filter) {
    const f = c.createBiquadFilter();
    f.type = opts.filter.type;
    f.Q.value = opts.filter.q ?? 1;
    f.frequency.setValueAtTime(opts.filter.freqA, t);
    if (opts.filter.freqB !== undefined) {
      f.frequency.linearRampToValueAtTime(opts.filter.freqB, t + dur);
    }
    src.connect(f);
    f.connect(g);
  } else {
    src.connect(g);
  }
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Pitched thump/pop: sine with a downward glide + enveloped decay. Used for
 *  bag thuds, gate bass, drip plinks and fumble tones. */
function toneThump(
  dest: AudioNode,
  opts: { from: number; to: number; dur: number; peak: number; attack?: number; decay?: number },
  at?: number
): void {
  const c = ctx!;
  const t = at ?? c.currentTime;
  const attack = opts.attack ?? 0.004;
  const decay = opts.decay ?? opts.dur + 0.1;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(opts.from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + decay + 0.05);
}

/** Microscopic square click — mechanical latches (lock, pen), no ringing. */
function squareClick(dest: AudioNode, time: number, freq: number, dur: number, peak: number): void {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, time);
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + 0.0008);
  g.gain.linearRampToValueAtTime(0, time + dur);
  o.connect(g);
  g.connect(dest);
  o.start(time);
  o.stop(time + dur + 0.02);
}

/* ============================================================
 * Ambient layers — each engine: a looping bed + an interval
 * scheduler for the random detail voices (drops/crackles).
 * ============================================================ */

interface AmbientEngine {
  key: ToneKey;
  gain: GainNode;
  active: boolean;
  /** Re-arm the layer's random detail scheduler (self-rescheduling). */
  spawn: () => void;
}

const ambientEngines = new Map<ToneKey, AmbientEngine>();
let activeTone: ToneKey | null = null;

function buildAmbientEngines(): void {
  if (ambientEngines.size > 0 || !ctx) return;
  const c = ctx;

  // ---- rain: 2s white loop → 900Hz lowpass (steady hiss bed) ----
  const rainSrc = noiseSource('white');
  rainSrc.loop = true;
  const rainLp = c.createBiquadFilter();
  rainLp.type = 'lowpass';
  rainLp.frequency.value = 900;
  const rainG = c.createGain();
  rainG.gain.value = 0;
  rainSrc.connect(rainLp);
  rainLp.connect(rainG);
  rainG.connect(master!);
  rainSrc.start();
  const rain: AmbientEngine = {
    key: 'rain',
    gain: rainG,
    active: false,
    spawn: function loop() {
      window.setTimeout(() => {
        loop();
        if (!rain.active) return;
        // droplet: 3–6ms white ticklet through a ~4k bandpass, random level
        noiseBurst(rainG, {
          dur: 0.003 + Math.random() * 0.003,
          filter: { type: 'bandpass', freqA: 3800 + Math.random() * 600, q: 2.5 },
          peak: 0.01 + Math.random() * 0.02,
          attack: 0.001,
        });
      }, 40 + Math.random() * 50);
    },
  };
  ambientEngines.set('rain', rain);

  // ---- fireplace: brown loop → 350Hz lowpass (warm rumble bed) ----
  const fireSrc = noiseSource('brown');
  fireSrc.loop = true;
  const fireLp = c.createBiquadFilter();
  fireLp.type = 'lowpass';
  fireLp.frequency.value = 350;
  const fireG = c.createGain();
  fireG.gain.value = 0;
  fireSrc.connect(fireLp);
  fireLp.connect(fireG);
  fireG.connect(master!);
  fireSrc.start();
  const fire: AmbientEngine = {
    key: 'fireplace',
    gain: fireG,
    active: false,
    spawn: function loop() {
      window.setTimeout(() => {
        loop();
        if (!fire.active) return;
        // crackle: 1–4ms white spark through a ~1.5k bandpass
        noiseBurst(fireG, {
          dur: 0.001 + Math.random() * 0.003,
          filter: { type: 'bandpass', freqA: 1500, q: 3 },
          peak: 0.05 + Math.random() * 0.04,
          attack: 0.001,
        });
      }, 1000 + Math.random() * 1000);
    },
  };
  ambientEngines.set('fireplace', fire);

  // ---- cellar drip: no loop, a plink per 0.4–1.2s ----
  const dripG = c.createGain();
  dripG.gain.value = 0;
  dripG.connect(master!);
  const drip: AmbientEngine = {
    key: 'drip',
    gain: dripG,
    active: false,
    spawn: function loop() {
      window.setTimeout(() => {
        loop();
        if (!drip.active) return;
        // water drop: 900→200Hz sine slide over 60ms + fast decay = "plink"
        toneThump(dripG, { from: 900, to: 200, dur: 0.06, peak: 0.05, attack: 0.002, decay: 0.18 });
      }, 400 + Math.random() * 800);
    },
  };
  ambientEngines.set('drip', drip);
}

function ensureAmbientEngines(): void {
  if (!ctx || ambientEngines.size > 0) return;
  buildAmbientEngines();
  for (const eng of ambientEngines.values()) eng.spawn(); // start detail schedulers once
}

/** Re-assert all ambient gain ramps from the current moment (used on unlock
 *  because ramps scheduled while the context was suspended froze in time). */
function rampAmbient(): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  for (const [key, eng] of ambientEngines) {
    eng.active = key === activeTone;
    const target = eng.active ? AMBIENT_TARGETS[key] : 0;
    eng.gain.gain.cancelScheduledValues(t);
    eng.gain.gain.setValueAtTime(eng.gain.gain.value, t);
    eng.gain.gain.linearRampToValueAtTime(target, t + AMBIENT_FADE);
  }
}

/** Crossfade the world ambience. The server tone vocabulary is loose, so
 *  unknown tones degrade to the default rain bed. */
export function setAmbient(tone: string): void {
  if (!initAudio()) return;
  ensureAmbientEngines();
  ambientRequested = true;
  const t = tone.trim().toLowerCase();
  if (t.includes('fire') || t.includes('hearth') || t === 'warm') activeTone = 'fireplace';
  else if (t.includes('drip') || t.includes('cellar') || t.includes('cave')) activeTone = 'drip';
  else activeTone = 'rain';
  rampAmbient();
}

/* ============================================================
 * BGM drones — three low-intensity moods, crossfaded like the
 * ambience. Default calm when the caller never picks one.
 * ============================================================ */

interface BgmEngine {
  mood: BGMood;
  gain: GainNode;
  active: boolean;
  spawn?: () => void; // crisis beat scheduler (interval-driven voices)
}

const bgmEngines = new Map<BGMood, BgmEngine>();
let activeMood: BGMood | null = null;

function buildBgmEngines(): void {
  if (bgmEngines.size > 0 || !ctx) return;
  const c = ctx;

  // ---- calm: A1 + E2 sines over a breath-thin brown pad ----
  const calmG = c.createGain();
  calmG.gain.value = 0;
  const calmBus = c.createGain();
  calmBus.gain.value = 0.5;
  const a1 = c.createOscillator();
  a1.type = 'sine';
  a1.frequency.value = 55; // A1 root
  const e2 = c.createOscillator();
  e2.type = 'sine';
  e2.frequency.value = 82.5; // E2 fifth
  const calmPad = noiseSource('brown');
  calmPad.loop = true;
  const calmPadLp = c.createBiquadFilter();
  calmPadLp.type = 'lowpass';
  calmPadLp.frequency.value = 120;
  const calmPadG = c.createGain();
  calmPadG.gain.value = 0.008; // air under the sines, not a bed of its own
  a1.connect(calmBus);
  e2.connect(calmBus);
  calmPad.connect(calmPadLp);
  calmPadLp.connect(calmPadG);
  calmBus.connect(calmG);
  calmPadG.connect(calmG);
  calmG.connect(master!);
  a1.start();
  e2.start();
  calmPad.start();
  bgmEngines.set('calm', { mood: 'calm', gain: calmG, active: false });

  // ---- tense: 55 + 58.3Hz near-semitone pair, slow 0.2Hz amplitude shimmer
  //      (the beating pair is the unease; the LFO trembles it) ----
  const tenseG = c.createGain();
  tenseG.gain.value = 0;
  const trem = c.createGain();
  trem.gain.value = 0.5;
  const t1 = c.createOscillator();
  t1.type = 'sine';
  t1.frequency.value = 55;
  const t2 = c.createOscillator();
  t2.type = 'sine';
  t2.frequency.value = 58.3;
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.2;
  const lfoG = c.createGain();
  lfoG.gain.value = 0.05; // ±0.05 around the 0.5 trem base
  t1.connect(trem);
  t2.connect(trem);
  lfo.connect(lfoG);
  lfoG.connect(trem.gain);
  trem.connect(tenseG);
  tenseG.connect(master!);
  t1.start();
  t2.start();
  lfo.start();
  bgmEngines.set('tense', { mood: 'tense', gain: tenseG, active: false });

  // ---- crisis: low pulse every 0.5s + rising noise sweep, interval-driven ----
  const crisisG = c.createGain();
  crisisG.gain.value = 0;
  crisisG.connect(master!);
  const crisisBeat = (): void => {
    // heartbeat thump
    toneThump(crisisG, { from: 110, to: 55, dur: 0.08, peak: 0.4, attack: 0.004, decay: 0.2 });
    // quick bandpass sweep scraping upward under the pulse
    noiseBurst(crisisG, {
      dur: 0.3,
      filter: { type: 'bandpass', freqA: 200, freqB: 800, q: 1 },
      peak: 0.1,
      attack: 0.01,
    });
  };
  const crisis: BgmEngine = {
    mood: 'crisis',
    gain: crisisG,
    active: false,
    spawn: function loop() {
      window.setTimeout(() => {
        loop();
        if (!crisis.active) return;
        crisisBeat();
      }, 500);
    },
  };
  bgmEngines.set('crisis', crisis);
}

function ensureBgmEngines(): void {
  if (!ctx || bgmEngines.size > 0) return;
  buildBgmEngines();
  bgmEngines.get('crisis')?.spawn?.(); // crisis scheduler runs once, gates on active
}

function rampBgm(): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  for (const [mood, eng] of bgmEngines) {
    eng.active = mood === activeMood;
    const target = eng.active ? BGM_TARGETS[mood] : 0;
    eng.gain.gain.cancelScheduledValues(t);
    eng.gain.gain.setValueAtTime(eng.gain.gain.value, t);
    eng.gain.gain.linearRampToValueAtTime(target, t + AMBIENT_FADE);
  }
}

/** Crossfade the BGM drone mood. */
export function setBGM(mood: BGMood): void {
  if (!initAudio()) return;
  ensureBgmEngines();
  bgmRequested = true;
  activeMood = mood;
  rampBgm();
}

/* ============================================================
 * Foley — eight one-shots, all < 1.5s, all with envelopes.
 * ============================================================ */

/** Play a synthesized interaction sound. `intensity` (0–1) scales the
 *  paper-slide level; other voices ignore it. */
export function playFoley(name: FoleyName, intensity = 1): void {
  if (!initAudio() || !master) return;
  const c = ctx!;
  const dest = master;
  const k = clamp01(intensity);
  const t = c.currentTime;

  switch (name) {
    case 'paper-slide': {
      // card dragged across paper: bandpass hiss whose pitch wanders 400–800Hz
      noiseBurst(dest, {
        dur: 0.08 + Math.random() * 0.07,
        filter: { type: 'bandpass', freqA: 400 + Math.random() * 300, freqB: 500 + Math.random() * 300, q: 0.8 },
        peak: 0.04 + 0.1 * k,
        attack: 0.008,
      });
      break;
    }
    case 'bag-pack': {
      // backpack lid thud: 130→55Hz downward sine + a 40ms noise tail
      toneThump(dest, { from: 130, to: 55, dur: 0.06, peak: 0.16, attack: 0.003, decay: 0.12 });
      noiseBurst(dest, { dur: 0.04, filter: { type: 'lowpass', freqA: 300 }, peak: 0.05, attack: 0.002 });
      break;
    }
    case 'dice-roll': {
      // die skittering across felt: 6–10 high ticks, then a settle thud
      const ticks = 6 + Math.floor(Math.random() * 5);
      let at = t;
      for (let i = 0; i < ticks; i++) {
        noiseBurst(
          dest,
          {
            dur: 0.02 + Math.random() * 0.03,
            filter: { type: 'bandpass', freqA: 2500 + Math.random() * 2500, q: 3 },
            peak: 0.06,
            attack: 0.001,
          },
          at
        );
        at += 0.06 + Math.random() * 0.08;
      }
      toneThump(dest, { from: 95, to: 60, dur: 0.06, peak: 0.14, attack: 0.002, decay: 0.16 }, at);
      break;
    }
    case 'unlock': {
      // two 2kHz square clicks 90ms apart + a thin mechanical rub
      squareClick(dest, t, 2000, 0.003, 0.06);
      squareClick(dest, t + 0.09, 2000, 0.003, 0.05);
      noiseBurst(dest, { dur: 0.12, filter: { type: 'lowpass', freqA: 900 }, peak: 0.018, attack: 0.015 });
      break;
    }
    case 'pen-scratch': {
      // three short 8–18ms rips + a faint sandpaper wash (nib on paper)
      for (let i = 0; i < 3; i++) {
        noiseBurst(
          dest,
          {
            dur: 0.008 + Math.random() * 0.01,
            filter: { type: 'bandpass', freqA: 3000 + Math.random() * 2200, q: 5 },
            peak: 0.07,
            attack: 0.001,
          },
          t + i * 0.03
        );
      }
      noiseBurst(dest, { dur: 0.15, filter: { type: 'bandpass', freqA: 6000, q: 0.7 }, peak: 0.02, attack: 0.02 }, t + 0.01);
      break;
    }
    case 'gate-open': {
      // heavy thud, then a 400ms door-yawn: noise swell through a dropping bandpass
      toneThump(dest, { from: 70, to: 45, dur: 0.12, peak: 0.18, attack: 0.004, decay: 0.3 });
      noiseBurst(dest, { dur: 0.4, filter: { type: 'bandpass', freqA: 300, freqB: 150, q: 0.8 }, peak: 0.12, attack: 0.12 }, t + 0.02);
      break;
    }
    case 'crit-chime': {
      // ascending triad C5/E5/G5 blooming in, long warm decay
      const chime = (freq: number, time: number): void => {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = c.createGain();
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(0.09, time + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.65);
        o.connect(g);
        g.connect(dest);
        o.start(time);
        o.stop(time + 0.7);
      };
      chime(523.25, t);
      chime(659.25, t + 0.08);
      chime(783.99, t + 0.16);
      break;
    }
    case 'fumble-break': {
      // two descending tones (E4 → E3) + a low noise snap over 300ms
      toneThump(dest, { from: 330, to: 330, dur: 0.02, peak: 0.1, attack: 0.002, decay: 0.18 });
      toneThump(dest, { from: 196, to: 180, dur: 0.03, peak: 0.12, attack: 0.002, decay: 0.25 }, t + 0.14);
      noiseBurst(dest, { dur: 0.3, filter: { type: 'lowpass', freqA: 220 }, peak: 0.16, attack: 0.005 }, t + 0.02);
      break;
    }
  }
}

/* ============================================================
 * Mute / unlock / charge tone
 * ============================================================ */

export function isMuted(): boolean {
  return mutedState;
}

/** Mute everything with a short ramp (avoids the click of a hard 0 snap). */
export function setMuted(m: boolean): void {
  mutedState = m;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.linearRampToValueAtTime(m ? 0 : 1, t + 0.03);
}

/** Resume the context — required by browser autoplay policy. Idempotent;
 *  call on the first user gesture. Also seeds the default world bed (rain
 *  ambience + calm drone) when the app has not already picked one. */
export async function unlock(): Promise<void> {
  const c = initAudio();
  if (!c || !master) return;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch (err) {
      console.warn('Audio resume blocked:', err);
    }
  }
  if (!ambientRequested) setAmbient('rain');
  if (!bgmRequested) setBGM('calm');
  rampAmbient();
  rampBgm();
  const t = c.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(mutedState ? 0 : 1, t);
}

/** Install a one-time pointerdown/keydown listener that unlocks audio on the
 *  first interaction anywhere (used by Main; Canvas already unlocks its own
 *  pointerdown, so this is belt-and-suspenders). */
export function unlockOnFirstInteraction(): void {
  const kick = (): void => {
    void unlock();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
}

/* --- ceremony charge tone (extra UI voice, not part of the foley set) --- */

let chargeOsc: OscillatorNode | null = null;
let chargeGain: GainNode | null = null;

/** Charge-tone progress for the dice ceremony: 220→440Hz sine whose level
 *  micro-rises with the bar. Call per frame while holding. */
export function playCharge(progress: number): void {
  if (!initAudio() || !master) return;
  const c = ctx!;
  const p = clamp01(progress);
  if (!chargeOsc || !chargeGain) {
    chargeOsc = c.createOscillator();
    chargeOsc.type = 'sine';
    chargeGain = c.createGain();
    chargeGain.gain.value = 0;
    chargeOsc.connect(chargeGain);
    chargeGain.connect(master);
    chargeOsc.start();
  }
  const t = c.currentTime;
  chargeOsc.frequency.setTargetAtTime(220 + 220 * p, t, 0.02);
  chargeGain.gain.setTargetAtTime(0.015 + 0.025 * p, t, 0.03);
}

/** Fade and release the charge tone. */
export function endCharge(): void {
  if (!chargeOsc || !chargeGain || !ctx) return;
  const t = ctx.currentTime;
  chargeGain.gain.setTargetAtTime(0, t, 0.02);
  const osc = chargeOsc;
  const g = chargeGain;
  window.setTimeout(() => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
    g.disconnect();
    if (chargeOsc === osc) {
      chargeOsc = null;
      chargeGain = null;
    }
  }, 120);
}
