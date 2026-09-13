#!/usr/bin/env node
/**
 * record-emotion-assets.mjs — write provenance for this batch's character media
 * (6 emotion portraits + living-portrait clips) into a batch-owned manifest.
 *
 * WHY A SEPARATE MANIFEST: `assets/source-manifest.json` and
 * `assets/motion/seedance/manifest.json` are produced by sync-template-assets /
 * sync-seedance and their tests assert an EXACT row count tied to those tools'
 * mappings (tools/template-assets.test.mjs:11, tools/seedance-assets.test.mjs:13).
 * Appending rows there would break those tests and blur two production flows.
 * This batch therefore owns `templates/<world>/assets/character-media.json`.
 *
 * Shape (one row per produced file):
 *   { character, emo | kind, source, asset, sourceSha256, assetSha256 }
 * `source` is workshop-relative (`assets/worlds/<world>-demo/...`) and resolves
 * against the repo root; `asset` is world-relative and resolves against the
 * template root. A `--check` run recomputes both digests and fails on drift.
 *
 * Idempotent. Run after gen-emotions.mjs / gen-motion.mjs.
 *
 * Usage: node tools/record-emotion-assets.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMOTIONS = ['normal', 'smile', 'shock', 'sad', 'angry', 'thinking'];

/** id → workshop subdir (differs from id for firstsnow's legacy `sumi/`). */
const CAST = {
  whitechapel: { workshop: 'whitechapel-demo', cast: { watson: 'watson', edith: 'edith', wayne: 'wayne', blackburn: 'blackburn', tom: 'tom' } },
  firstsnow: { workshop: 'firstsnow-demo', cast: { nanami: 'nanami', 'sumi-yukimura': 'sumi' } },
  // first-snow-jp is the Japanese entry of the same world: same bytes, its own
  // template copy (docs/assets/00 §6). Provenance is recorded per template.
  'first-snow-jp': { workshop: 'firstsnow-demo', cast: { nanami: 'nanami', 'sumi-yukimura': 'sumi' } },
};

const sha256 = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function buildRows(workshop, cast, tpl) {
  const rows = [];
  const missing = [];
  for (const [id, dir] of Object.entries(cast)) {
    const wsChar = path.join(ROOT, 'assets/worlds', workshop, 'characters', dir);
    for (const emo of EMOTIONS) {
      const src = path.join(wsChar, 'variants', `${emo}.png`);
      const asset = path.join(tpl, 'assets/characters', id, `${emo}.webp`);
      if (!fs.existsSync(src) || !fs.existsSync(asset)) {
        missing.push(`${id}/${emo}`);
        continue;
      }
      rows.push({
        character: id,
        emo,
        source: `assets/worlds/${workshop}/characters/${dir}/variants/${emo}.png`,
        asset: `assets/characters/${id}/${emo}.webp`,
        sourceSha256: sha256(src),
        assetSha256: sha256(asset),
      });
    }
    const green = path.join(wsChar, `${id}-green.mp4`);
    const clip = path.join(tpl, 'assets/motion/seedance/characters', `${id}-transparent.webm`);
    if (fs.existsSync(green) && fs.existsSync(clip)) {
      rows.push({
        character: id,
        kind: 'living-portrait',
        source: `assets/worlds/${workshop}/characters/${dir}/${id}-green.mp4`,
        asset: `assets/motion/seedance/characters/${id}-transparent.webm`,
        sourceSha256: sha256(green),
        assetSha256: sha256(clip),
      });
    } else {
      missing.push(`${id}/living-portrait`);
    }
  }
  return { rows, missing };
}

function main() {
  const check = process.argv.includes('--check');
  let drift = 0;
  let total = 0;

  for (const [world, conf] of Object.entries(CAST)) {
    const tpl = path.join(ROOT, 'templates', world);
    const manifestPath = path.join(tpl, 'assets/character-media.json');
    const { rows, missing } = buildRows(conf.workshop, conf.cast, tpl);
    total += rows.length;

    if (check) {
      const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { assets: [] };
      const key = (r) => `${r.character}:${r.emo ?? r.kind}`;
      const prevMap = new Map(prev.assets.map((r) => [key(r), r]));
      for (const r of rows) {
        const p = prevMap.get(key(r));
        if (!p || p.assetSha256 !== r.assetSha256 || p.sourceSha256 !== r.sourceSha256) {
          console.error(`✗ ${world} ${key(r)}: manifest stale or missing`);
          drift++;
        }
      }
      if (prev.assets.length !== rows.length) {
        console.error(`✗ ${world}: manifest has ${prev.assets.length} rows, expected ${rows.length}`);
        drift++;
      }
    } else {
      fs.writeFileSync(manifestPath, JSON.stringify({ sourceRepository: 'worldlines-assets', encoding: 'webp-q82', assets: rows }, null, 2) + '\n');
      console.log(`${world}: wrote ${rows.length} rows → ${path.relative(ROOT, manifestPath)}`);
    }
    for (const m of missing) console.log(`  ⚠ missing: ${world} ${m}`);
  }

  if (check && drift) {
    console.error(`\n✗ character-media manifest drift (${drift} issue(s)). Re-run without --check.`);
    process.exit(1);
  }
  console.log(check ? `✓ character-media manifests match (${total} rows)` : `done: ${total} rows total`);
}

main();
