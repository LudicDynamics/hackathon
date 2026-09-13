#!/usr/bin/env node
/**
 * gen-emotions.mjs — batch-produce 6-emotion differential portraits for a
 * character, from the workshop `base.png`.
 *
 * Pipeline (docs/assets/00 §4.1):
 *   base.png --(flow image, img2img, portrait)--> <emo>-green.jpg
 *            --(chromakey + despill)-------------> <emo>.png   (transparent)
 *            --(cwebp q82)------------------------> publish webp
 *
 * Images are FREE on the current Flow tier (measured delta 0), so this runs
 * 6-wide. It is idempotent: an emotion whose green source already exists is
 * skipped unless --force. Nothing here touches video or credits.
 *
 * Usage:
 *   node tools/gen-emotions.mjs --world whitechapel [--id watson] [--force]
 *   node tools/gen-emotions.mjs --world firstsnow --all
 *   node tools/gen-emotions.mjs --list
 *
 * Requires: FLOW_API_KEY (proxy at 127.0.0.1:8317), ffmpeg, cwebp on PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSHOP = path.resolve(ROOT, 'assets/worlds');

const EMOTIONS = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

/** Per-emotion face direction. Everything else is locked by the anchor. */
const FACE = {
  normal: 'a calm, neutral, attentive expression, mouth closed and relaxed',
  smile: 'a warm, relieved, genuine smile with the corners of the eyes softened',
  shock: 'wide startled eyes, eyebrows raised high, mouth slightly open in surprise',
  sad: 'downcast eyes, somber defeated expression, mouth corners turned down',
  angry: 'brows drawn together tightly, a stern hard glare, jaw clenched, mouth a tight line',
  thinking: 'eyes glancing to one side, a slight concentrated frown, thoughtful closed mouth',
};

/**
 * Character roster. `base` is relative to the workshop world dir; it may point
 * at an alias dir (firstsnow's `sumi/`) while `id` is the canonical publish id.
 * `anchor` locks identity so the img2img pass only moves the face.
 */
const CHARACTERS = {
  whitechapel: {
    workshop: 'whitechapel-demo',
    style: 'refined british victorian anime illustration, clean line art with painterly shading, muted sepia and charcoal palette with cold gaslight-teal accents, 1888 london fog atmosphere',
    cast: {
      watson: {
        base: 'watson/base.png',
        anchor: 'a warm sturdy victorian army doctor in his forties, neat moustache, brown tweed waistcoat and coat, a leather medical bag at his side, arms crossed, waist-up half-body shot',
      },
      edith: {
        base: 'edith/base.png',
        anchor: 'a young victorian woman novelist, tired frightened eyes, high-collared dark dress, ink stains on her fingers, clutching a manuscript, waist-up half-body shot',
      },
      wayne: {
        base: 'wayne/base.png',
        anchor: 'a gaunt victorian illustrator with a hollow intense stare, paint-stained shirt cuffs with a trace of ultramarine blue, a bandaged right wrist, waist-up half-body shot',
      },
      blackburn: {
        base: 'blackburn/base.png',
        anchor: 'a portly victorian newspaper editor in a dark suit, a gold watch chain across his waistcoat, waist-up half-body shot',
      },
      tom: {
        base: 'tom/base.png',
        anchor: 'a young victorian typesetter with ink-black hands, a simple tired honest face, sleeves rolled up, an apron dusted with lead type grime, waist-up half-body shot',
      },
    },
  },
  firstsnow: {
    workshop: 'firstsnow-demo',
    style: 'beautiful modern anime illustration, clean cel shading with soft gradients, expressive detailed anime eyes, winter night palette of pale blue and snow white with warm amber light accents',
    cast: {
      nanami: {
        base: 'nanami/base.png',
        anchor: 'a japanese university girl radio host with headphones around her neck, soft shoulder-length hair, a gentle familiar presence, waist-up half-body shot',
      },
      // Canonical id `sumi-yukimura`, workshop dir is the legacy `sumi/`.
      'sumi-yukimura': {
        base: 'sumi/base.png',
        anchor: 'a young japanese singer with a knit cap and scarf, clear earnest eyes with a trace of loneliness, snow-dusted coat, waist-up half-body shot',
      },
    },
  },
};

const LOCK =
  'Keep this EXACT same character — identical face, hair, outfit, color palette and cel-shaded art style as the reference image. ' +
  'Keep the same waist-up framing, the same pose and the same camera angle. ' +
  'Change ONLY the facial expression to';
const GREEN =
  'Replace the background with a completely flat pure chroma-key green screen: uniform solid bright green (#00FF00), no gradient, no shadow, no texture. ' +
  'Crisp clean edges with no green spill on the character. No text, no watermark, no border.';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function has(bin) {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(bin, args) {
  execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 28 });
}

/** Run the flow image tool for one emotion; resolves on a written file. */
function genGreen({ basePath, anchor, emo, outPath }) {
  return new Promise((resolve, reject) => {
    const prompt = `${LOCK} ${FACE[emo]}. ${anchor}. ${GREEN}`;
    const child = spawn(
      process.execPath,
      [
        path.join(ROOT, 'tools/flow-gen.mjs'),
        'image',
        '--model', 'nano-banana-2',
        '--aspect', 'portrait',
        '--ref-image', basePath,
        '--prompt', prompt,
        '-o', outPath,
      ],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let err = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve();
      else reject(new Error(`flow image failed (${code}) for ${path.basename(outPath)}: ${err.slice(-240)}`));
    });
  });
}

/** chromakey + despill → transparent PNG (same family as the video keyer). */
function keyToPng(greenJpg, pngOut) {
  run('ffmpeg', [
    '-y', '-v', 'error', '-i', greenJpg,
    '-vf', 'chromakey=0x00FF00:0.18:0.06,despill=type=green:mix=0.6:expand=0.4,format=rgba',
    pngOut,
  ]);
}

/** cwebp q82 → publish webp (same quality as sync-template-assets). */
function toWebp(pngIn, webpOut) {
  run('cwebp', ['-quiet', '-q', '82', '-m', '6', pngIn, '-o', webpOut]);
}
// ---------------------------------------------------------------------------
// per-character run
// ---------------------------------------------------------------------------

async function runCharacter(worldName, worldConf, id, conf, opts) {
  const wsBase = path.join(WORKSHOP, worldConf.workshop, 'characters', conf.base);
  if (!fs.existsSync(wsBase)) {
    console.log(`  ✗ ${id}: no workshop base at ${path.relative(ROOT, wsBase)} — skipped`);
    return { id, ok: 0, fail: 0, skipped: true };
  }
  const variantsDir = path.join(WORKSHOP, worldConf.workshop, 'characters', path.dirname(conf.base), 'variants');
  fs.mkdirSync(variantsDir, { recursive: true });
  const pubDir = path.join(ROOT, 'templates', worldName, 'assets', 'characters', id);
  fs.mkdirSync(pubDir, { recursive: true });

  // Decide which emotions actually need generation (idempotent).
  const todo = EMOTIONS.filter((e) => opts.force || !fs.existsSync(path.join(variantsDir, `${e}-green.jpg`)));
  if (todo.length === 0) {
    console.log(`  · ${id}: all 6 green sources present — post-processing only`);
  } else {
    console.log(`  → ${id}: generating ${todo.length}/6 (${todo.join(',')})`);
  }

  // Images are free; run in chunks of 6 to stay polite to the image endpoint.
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < todo.length; i += 6) {
    const chunk = todo.slice(i, i + 6);
    const results = await Promise.allSettled(
      chunk.map((emo) =>
        genGreen({
          basePath: wsBase,
          anchor: conf.anchor,
          emo,
          outPath: path.join(variantsDir, `${emo}-green.jpg`),
        })
      )
    );
    results.forEach((r, k) => {
      if (r.status === 'fulfilled') {
        ok++;
        console.log(`     ✓ ${id}/${chunk[k]}`);
      } else {
        fail++;
        console.log(`     ✗ ${id}/${chunk[k]}: ${r.reason.message}`);
      }
    });
  }

  // Post-process every emotion that now has a green source.
  let published = 0;
  for (const emo of EMOTIONS) {
    const green = path.join(variantsDir, `${emo}-green.jpg`);
    if (!fs.existsSync(green)) {
      console.log(`     ⚠ ${id}/${emo}: no green source — publish skipped`);
      continue;
    }
    const png = path.join(variantsDir, `${emo}.png`);
    keyToPng(green, png);
    toWebp(png, path.join(pubDir, `${emo}.webp`));
    published++;
  }
  console.log(`  ✓ ${id}: published ${published}/6 → ${path.relative(ROOT, pubDir)}`);
  return { id, ok, fail, published };
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const opts = { world: null, id: null, force: false, all: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world') opts.world = argv[++i];
    else if (a === '--id') opts.id = argv[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--list') opts.list = true;
    else if (a === '-h' || a === '--help') opts.help = true;
  }
  if (opts.help || (!opts.world && !opts.list)) {
    console.log(`gen-emotions — 6-emotion differential portraits (docs/assets/00)

Usage:
  node tools/gen-emotions.mjs --world <whitechapel|firstsnow> [--id <char>] [--force]
  node tools/gen-emotions.mjs --list

Options:
  --world <name>   world to process
  --id <char>      single character (default: the whole cast)
  --force          regenerate even if the green source exists
  --list           print the roster and exit

Requires FLOW_API_KEY, ffmpeg, cwebp.`);
    return;
  }

  if (opts.list) {
    for (const [w, conf] of Object.entries(CHARACTERS)) {
      console.log(`${w} (${conf.workshop}):`);
      for (const id of Object.keys(conf.cast)) console.log(`  - ${id}`);
    }
    return;
  }

  const worldConf = CHARACTERS[opts.world];
  if (!worldConf) {
    console.error(`unknown world "${opts.world}" — see --list`);
    process.exit(2);
  }
  for (const bin of ['ffmpeg', 'cwebp']) {
    if (!has(bin)) {
      console.error(`missing required binary: ${bin}`);
      process.exit(2);
    }
  }

  const ids = opts.id ? [opts.id] : Object.keys(worldConf.cast);
  for (const id of ids) {
    if (!worldConf.cast[id]) {
      console.error(`unknown character "${id}" in ${opts.world}`);
      process.exit(2);
    }
  }

  console.log(`gen-emotions: ${opts.world} → ${ids.join(', ')}\n`);
  (async () => {
    const summary = [];
    for (const id of ids) {
      summary.push(await runCharacter(opts.world, worldConf, id, worldConf.cast[id], opts));
      await sleep(400);
    }
    console.log('\n=== summary ===');
    for (const s of summary) {
      console.log(`  ${s.id}: published=${s.published ?? 0}${s.skipped ? ' (skipped: no base)' : ''}`);
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
