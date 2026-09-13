#!/usr/bin/env node
/**
 * gen-motion.mjs — batch-produce transparent "living portrait" clips for a
 * character, from its green-screen `normal` still.
 *
 * Pipeline (docs/assets/00 §4.2, docs/assets/02):
 *   <normal>-green.png --(flow video, omni-1.1-flash i2v 720p 6s)--> <id>-green.mp4
 *                      --(motion-clip: chromakey+despill, 360w, pingpong)-> <id>-transparent.webm
 *                      --(first frame)-----------------------------------------> <id>-poster.png
 *
 * This step COSTS CREDITS (~10/条 measured, shared account). It is serial by
 * default because the reCAPTCHA solver bridge is a single serial loop
 * (flow-proxy-api: one captcha claim at a time). `--parallel 2` is safe;
 * beyond 3 just makes the captcha queue thrash.
 *
 * Idempotent: a character whose clip already exists is skipped unless --force.
 *
 * Usage:
 *   node tools/gen-motion.mjs --world whitechapel [--id watson] [--force] [--parallel 2]
 *   node tools/gen-motion.mjs --list
 *
 * Requires: FLOW_API_KEY (proxy 127.0.0.1:8317), ffmpeg, the normal-green.png
 * produced by gen-emotions.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSHOP = path.resolve(ROOT, 'assets/worlds');

/**
 * Characters to give a living portrait. Keyed by canonical id; `dir` is the
 * workshop subdir that holds the `variants/` dir (may differ from id, e.g.
 * firstsnow's legacy `sumi/`).
 */
const CHARACTERS = {
  whitechapel: {
    workshop: 'whitechapel-demo',
    cast: {
      watson: { dir: 'watson' },
      edith: { dir: 'edith' },
      wayne: { dir: 'wayne' },
      blackburn: { dir: 'blackburn' },
      tom: { dir: 'tom' },
    },
  },
  firstsnow: {
    workshop: 'firstsnow-demo',
    cast: {
      nanami: { dir: 'nanami' },
      'sumi-yukimura': { dir: 'sumi' },
    },
  },
};

/** Motion prompt: a living still. Keep identity locked; only micro-motion. */
function motionPrompt(anchor) {
  return (
    'Animate this still portrait into a transparent living portrait, silent. ' +
    `${anchor} ` +
    'The character stays standing in the same pose and framing. Only a very slight breathing rise and fall, ' +
    'eyes blink once or twice, hair and the hem of clothing stir faintly in a light draft; the hands do not move. ' +
    'Do NOT turn the head, do NOT walk, no large motion. Keep the flat pure chroma-key green screen completely unchanged behind the character. ' +
    'Overall reads as a static living portrait.'
  );
}

const ANCHORS = {
  watson: 'A victorian army doctor in a brown tweed coat with arms crossed.',
  edith: 'A young victorian woman novelist clutching a manuscript.',
  wayne: 'A gaunt victorian illustrator with a bandaged wrist.',
  blackburn: 'A portly victorian newspaper editor in a dark suit.',
  tom: 'A young victorian typesetter with ink-black hands.',
  nanami: 'A japanese university girl radio host with headphones around her neck.',
  'sumi-yukimura': 'A young japanese singer in a knit cap and scarf.',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runFile(bin, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} exited ${code}: ${(err || out).slice(-300)}`))
    );
  });
}

/** Credits remaining, straight from the proxy. */
async function credits() {
  const out = await runFile(process.execPath, [
    '-e',
    `fetch('http://127.0.0.1:8317/v1/credits',{headers:{authorization:'Bearer '+process.env.FLOW_API_KEY}}).then(r=>r.json()).then(j=>console.log(j.credits))`,
  ]);
  return Number(out.trim());
}
async function processOne(worldName, worldConf, id, conf, opts) {
  const variantsDir = path.join(WORKSHOP, worldConf.workshop, 'characters', conf.dir, 'variants');
  const normalGreen = path.join(variantsDir, 'normal-green.jpg');
  const wsGreenMp4 = path.join(WORKSHOP, worldConf.workshop, 'characters', conf.dir, `${id}-green.mp4`);

  const pubDir = path.join(ROOT, 'templates', worldName, 'assets', 'motion', 'seedance', 'characters');
  fs.mkdirSync(pubDir, { recursive: true });
  const webm = path.join(pubDir, `${id}-transparent.webm`);
  const poster = path.join(ROOT, 'templates', worldName, 'assets', 'characters', id, `${id}-poster.png`);

  if (!fs.existsSync(normalGreen)) {
    console.log(`  ✗ ${id}: no normal-green.jpg — run gen-emotions first (${path.relative(ROOT, normalGreen)})`);
    return { id, skipped: true, reason: 'no normal-green.jpg' };
  }
  if (fs.existsSync(webm) && !opts.force) {
    console.log(`  · ${id}: clip exists — skipped (use --force)`);
    return { id, skipped: true, reason: 'exists' };
  }

  console.log(`  → ${id}: i2v 720p 6s …`);
  await runFile(process.execPath, [
    path.join(ROOT, 'tools/flow-gen.mjs'),
    'video',
    '--model', 'omni-1.1-flash',
    '--seconds', '6',
    '--resolution', '720',
    '--aspect', 'portrait',
    '--image', normalGreen,
    '--prompt', motionPrompt(ANCHORS[id] || ''),
    '-o', wsGreenMp4,
  ]);

  console.log(`  → ${id}: keying → 360w transparent webm …`);
  await runFile(process.execPath, [
    path.join(ROOT, 'tools/motion-clip.mjs'),
    wsGreenMp4,
    '-o', webm,
    '--scale', '360',
    '--pingpong',
    '--similarity', '0.06',
  ]);

  // Poster = the clip's own first frame (pixel-identical fallback).
  fs.mkdirSync(path.dirname(poster), { recursive: true });
  await runFile('ffmpeg', [
    '-y', '-v', 'error',
    '-c:v', 'libvpx-vp9', // MUST specify: the default vp9 decoder silently drops alpha
    '-i', webm,
    '-frames:v', '1',
    poster,
  ]);

  console.log(`  ✓ ${id} → ${path.relative(ROOT, webm)} + poster`);
  return { id, webm, poster };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { world: null, id: null, force: false, list: false, parallel: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--world') opts.world = argv[++i];
    else if (a === '--id') opts.id = argv[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--parallel') opts.parallel = Math.max(1, Math.min(3, Number(argv[++i])));
    else if (a === '--list') opts.list = true;
    else if (a === '-h' || a === '--help') opts.help = true;
  }
  if (opts.help || (!opts.world && !opts.list)) {
    console.log(`gen-motion — transparent living-portrait clips (docs/assets/00 §4.2)

Usage:
  node tools/gen-motion.mjs --world <whitechapel|firstsnow> [--id <char>] [--force] [--parallel 1..3]
  node tools/gen-motion.mjs --list

Options:
  --world <name>    world to process
  --id <char>       single character (default: the whole cast)
  --force           regenerate even if the clip exists
  --parallel <n>    videos in flight (1..3; captcha bridge is serial — 2 is fine, 3 max)
  --list            print the roster and exit

COSTS CREDITS (~10 per 6s i2v clip, shared account). Requires FLOW_API_KEY.`);
    return;
  }

  if (opts.list) {
    for (const [w, conf] of Object.entries(CHARACTERS)) {
      console.log(`${w}: ${Object.keys(conf.cast).join(', ')}`);
    }
    return;
  }

  const worldConf = CHARACTERS[opts.world];
  if (!worldConf) {
    console.error(`unknown world "${opts.world}" — see --list`);
    process.exit(2);
  }
  const ids = opts.id ? [opts.id] : Object.keys(worldConf.cast);

  (async () => {
    const start = await credits().catch(() => null);
    console.log(`gen-motion: ${opts.world} → ${ids.join(', ')}`);
    if (start != null) console.log(`credits before: ${start}\n`);

    const summary = [];
    const queue = [...ids];
    const workers = Array.from({ length: opts.parallel }, async () => {
      for (;;) {
        const id = queue.shift();
        if (!id) break;
        try {
          summary.push(await processOne(opts.world, worldConf, id, worldConf.cast[id], opts));
        } catch (e) {
          console.log(`  ✗ ${id}: ${e.message}`);
          summary.push({ id, error: e.message });
        }
        await sleep(500);
      }
    });
    await Promise.all(workers);

    const end = await credits().catch(() => null);
    console.log('\n=== summary ===');
    for (const s of summary) {
      if (s.error) console.log(`  ${s.id}: FAILED — ${s.error}`);
      else if (s.skipped) console.log(`  ${s.id}: skipped (${s.reason})`);
      else console.log(`  ${s.id}: ok`);
    }
    if (start != null && end != null) console.log(`\ncredits after: ${end}  (spent ${start - end})`);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
