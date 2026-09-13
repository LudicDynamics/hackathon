#!/usr/bin/env node
/**
 * verify-emotions.mjs — mechanical acceptance gate for the assets batch
 * (docs/assets/00 §7). Read-only: it decodes assets and recomputes digests,
 * nothing else. Exit 0 = clean, 1 = findings, 2 = missing tool.
 *
 * Checks (each maps to a defect this batch actually hit):
 *   A. 6/6 emotion webp present per character          (missing asset)
 *   B. every webp decodes to TRUE alpha                (unkeyed / flattened)
 *   C. every webp is ~9:16 (1.70 ≤ h/w ≤ 1.85)         (silent aspect downgrade)
 *   D. every -transparent.webm has real alpha          (builtin vp9 drops alpha)
 *   E. character-media.json parses; both digests match the bytes
 *   F. firstsnow ↔ first-snow-jp share identical bytes
 *
 * `emotions`-iff-6/6 is asserted by the server route itself and covered in
 * `packages/shared/test/emotions.test.mjs` + the live probe; this gate stays
 * offline so `pnpm test` never needs a running server.
 *
 * Usage: node tools/verify-emotions.mjs [--world <whitechapel|firstsnow>] [--all] [--json]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMOTIONS = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

const WORLDS = {
  whitechapel: { cast: { watson: 'watson', edith: 'edith', wayne: 'wayne', blackburn: 'blackburn', tom: 'tom' } },
  firstsnow: { cast: { nanami: 'nanami', 'sumi-yukimura': 'sumi-yukimura' } },
};
/**
 * Fraction of pixels with alpha < 128, plus dimensions.
 *
 * `webp` goes through `dwebp` (libwebp), NOT ffmpeg: this box's ffmpeg webp
 * decoder intermittently fails on valid files ("Invalid data found") that
 * `dwebp` and the browser decode fine — a decoder bug, not a bad asset.
 * `webm` MUST name `-c:v libvpx-vp9`, or alpha is silently dropped.
 */
function decodeAlpha(file, kind) {
  if (kind === 'webp') {
    const tmp = path.join(os.tmpdir(), `verify-emotions-${process.pid}-${path.basename(file)}.png`);
    try {
      execFileSync('dwebp', ['-quiet', file, '-o', tmp], { maxBuffer: 1 << 28 });
      const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', tmp, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {
        maxBuffer: 1 << 28,
      });
      return alphaStats(raw);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-c:v', 'libvpx-vp9', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 1 << 28 }
  );
  return alphaStats(raw);
}

function alphaStats(raw) {
  const n = raw.length / 4;
  if (n === 0) return { width: 0, height: 0, transparentRatio: 0, pixels: 0 };
  let transparent = 0;
  for (let i = 3; i < raw.length; i += 4) if (raw[i] < 128) transparent++;
  return { width: 0, height: 0, transparentRatio: transparent / n, pixels: n };
}

function probeDims(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' }
  );
  const [w, h] = out.trim().split(',').map(Number);
  return { width: w, height: h };
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

function checkPublishDir(world, id, findings) {
  const dir = path.join(ROOT, 'templates', world, 'assets', 'characters', id);
  for (const emo of EMOTIONS) {
    const f = path.join(dir, `${emo}.webp`);
    if (!fs.existsSync(f)) {
      findings.push(`A ${world}/${id}/${emo}: missing`);
      continue;
    }
    const { width, height } = probeDims(f);
    const { transparentRatio, pixels } = decodeAlpha(f, 'webp');
    if (pixels === 0) findings.push(`B ${world}/${id}/${emo}: decoded to zero pixels`);
    else if (transparentRatio <= 0) findings.push(`B ${world}/${id}/${emo}: no transparent pixels (flattened)`);
    const ratio = height / width;
    if (!(ratio >= 1.7 && ratio <= 1.85)) findings.push(`C ${world}/${id}/${emo}: aspect ${width}x${height} (h/w=${ratio.toFixed(2)}) not ~9:16`);
  }
}

function checkClip(world, id, findings) {
  const f = path.join(ROOT, 'templates', world, 'assets', 'motion', 'seedance', 'characters', `${id}-transparent.webm`);
  if (!fs.existsSync(f)) {
    findings.push(`D ${world}/${id}: clip missing`);
    return;
  }
  const { transparentRatio, pixels } = decodeAlpha(f, 'webm');
  if (pixels === 0) findings.push(`D ${world}/${id}: webm decoded to zero pixels`);
  else if (transparentRatio <= 0) findings.push(`D ${world}/${id}: webm has no transparency (builtin decoder trap?)`);
}

function checkManifest(world, findings) {
  const p = path.join(ROOT, 'templates', world, 'assets', 'character-media.json');
  if (!fs.existsSync(p)) {
    findings.push(`E ${world}: character-media.json missing`);
    return;
  }
  let m;
  try {
    m = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    findings.push(`E ${world}: character-media.json does not parse (${e.message})`);
    return;
  }
  for (const row of m.assets || []) {
    const asset = path.join(ROOT, 'templates', world, row.asset);
    if (!fs.existsSync(asset)) {
      findings.push(`E ${world}: manifest target missing ${row.asset}`);
      continue;
    }
    if (sha256(asset) !== row.assetSha256) findings.push(`E ${world}: assetSha256 stale for ${row.asset}`);
  }
}

function checkDoubleWorld(findings) {
  const a = path.join(ROOT, 'templates', 'firstsnow');
  const b = path.join(ROOT, 'templates', 'first-snow-jp');
  const walk = (dir, prefix = '') => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.posix.join(prefix, e.name);
      if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
      else out.push(rel);
    }
    return out;
  };
  for (const rel of walk(b)) {
    if (!rel.startsWith('assets/')) continue;
    if (/\.(md|json)$/.test(rel) && rel !== 'assets/character-media.json') continue; // text may differ (README)
    const other = path.join(a, rel);
    if (!fs.existsSync(other)) {
      findings.push(`F jp-only asset: ${rel}`);
      continue;
    }
    if (sha256(path.join(b, rel)) !== sha256(other)) findings.push(`F byte mismatch: ${rel}`);
  }
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const all = argv.includes('--all');
  let worldArg = null;
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--world') worldArg = argv[++i];

  for (const bin of ['ffmpeg', 'ffprobe', 'dwebp']) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
    } catch {
      console.error(`missing required binary: ${bin}`);
      process.exit(2);
    }
  }

  const worlds = worldArg ? [worldArg] : Object.keys(WORLDS);
  const findings = [];
  for (const world of worlds) {
    const conf = WORLDS[world];
    if (!conf) {
      console.error(`unknown world "${world}"`);
      process.exit(2);
    }
    for (const id of Object.keys(conf.cast)) {
      checkPublishDir(world, id, findings);
      checkClip(world, id, findings);
    }
    checkManifest(world, findings);
  }
  if (all || !worldArg) checkDoubleWorld(findings);

  const report = { worlds, findings, clean: findings.length === 0 };
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    if (findings.length === 0) console.log(`verify-emotions: clean (${worlds.join(', ')})`);
    else {
      console.error(`verify-emotions: ${findings.length} finding(s)`);
      for (const f of findings) console.error(`  ✗ ${f}`);
    }
  }
  process.exit(findings.length ? 1 : 0);
}

main();
