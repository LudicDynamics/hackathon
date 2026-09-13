import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CARD_FORMS,
  COMPONENT_KINDS,
  COMPONENT_REGISTRY,
  COMPONENT_SCHEMAS,
  cardKindOf,
  componentDocOf,
  resolveComponentKind,
} from '../dist/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const WORLD_ROOT = path.join(REPO_ROOT, 'archive/templates/pre-bilingual-2026-09-14/firstsnow');
const WEBM = path.join(WORLD_ROOT, 'assets/characters/nanami/nanami.webm');
const POSTER = path.join(WORLD_ROOT, 'assets/characters/nanami/nanami-poster.png');

/**
 * Decode an image's first frame to RGBA and report the fraction of pixels with
 * alpha < 128.
 *
 * For the webm the decoder MUST be named explicitly (`-c:v libvpx-vp9`): this
 * box's webm alpha is a separate stream + `alpha_mode=1`, and the implicit
 * decode path does NOT restore it (implicit → 0.0% transparent; explicit →
 * 25.4%). Using the default decoder would make the assertion fail forever, and
 * trusting `ffprobe`'s `alpha_mode` tag would make it pass without ever proving
 * transparency (assets/skills/motion-portrait/SKILL.md warns about both).
 * PNGs carry alpha in a normal pixel format, so the default decoder is used.
 */
function transparentRatio(file, decoder) {
  const ffmpeg = process.env.FFMPEG || (existsSync('/tmp/ffbin/ffmpeg') ? '/tmp/ffbin/ffmpeg' : 'ffmpeg');
  const raw = execFileSync(
    ffmpeg,
    [
      '-v', 'error',
      ...decoder,
      '-i', file,
      '-frames:v', '1',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const n = Math.floor(raw.length / 4);
  assert.ok(n > 0, `${path.basename(file)} decoded to zero pixels`);
  let transparent = 0;
  for (let i = 3; i < raw.length; i += 4) if (raw[i] < 128) transparent++;
  return transparent / n;
}

// --------------------------------------------------------- registry completeness

test('portrait is a registered kind with a form, a schema, and a doc entry', () => {
  assert.ok(COMPONENT_KINDS.includes('portrait'), 'COMPONENT_KINDS includes portrait');
  assert.equal(Object.keys(COMPONENT_REGISTRY).length, 19);
  assert.ok(COMPONENT_SCHEMAS.portrait, 'COMPONENT_SCHEMAS has a portrait entry');
  assert.ok(CARD_FORMS.portrait, 'CARD_FORMS has a portrait row');
  assert.equal(componentDocOf('portrait').form, CARD_FORMS.portrait);
  assert.equal(COMPONENT_REGISTRY.portrait.pack, 'room');
});

test('CARD_FORMS.portrait is the frozen 288×384 (3:4) bare form', () => {
  assert.equal(CARD_FORMS.portrait.w, 288);
  assert.equal(CARD_FORMS.portrait.h, 384);
  assert.equal(CARD_FORMS.portrait.w / CARD_FORMS.portrait.h, 3 / 4);
  assert.equal(CARD_FORMS.portrait.chrome, 'bare');
  assert.equal(CARD_FORMS.portrait.label, 'Portrait');
});

// ------------------------------------------------------ kind resolution / silent downgrade

test('portrait resolves from `component: portrait`, and downgrades silently without it', () => {
  // Positive: the frozen identity source is the `component` field, never `type`.
  assert.equal(resolveComponentKind({ type: 'component', component: 'portrait', title: 'X' }, 'x.md'), 'portrait');
  assert.equal(cardKindOf({ type: 'component', component: 'portrait', title: 'X' }, 'x.md'), 'portrait');

  // Negative: a missing `component` silently falls back to `note` (no throw).
  assert.equal(resolveComponentKind({ type: 'component', title: 'X' }, 'x.md'), 'note');

  // Negative: a misspelled kind name downgrades too, rather than throwing.
  assert.equal(resolveComponentKind({ type: 'component', component: 'portriat', title: 'X' }, 'x.md'), 'note');

  // Negative: `type: portrait` is NOT a second identity source.
  assert.equal(resolveComponentKind({ type: 'portrait', title: 'X' }, 'x.md'), 'note');
});

test('PortraitKindSchema accepts the frontmatter and rejects a wrong component literal', () => {
  const gm = { type: 'component', component: 'portrait', title: 'X', video: 'a/b.webm', poster: 'a/b.png' };
  assert.equal(COMPONENT_SCHEMAS.portrait.safeParse(gm).success, true);
  assert.equal(COMPONENT_SCHEMAS.portrait.safeParse({ ...gm, component: 'Portrait' }).success, false);
  // `video` / `poster` are optional: a still-only room is legal.
  assert.equal(COMPONENT_SCHEMAS.portrait.safeParse({ type: 'component', component: 'portrait', title: 'X' }).success, true);
});

// -------------------------------------------------------------- delivered assets

test('the delivered portrait clip really carries alpha (explicit VP9 decode)', () => {
  assert.ok(existsSync(WEBM), `fixture missing: ${WEBM}`);
  const ratio = transparentRatio(WEBM, ['-c:v', 'libvpx-vp9']);
  assert.ok(ratio > 0, `nanami.webm has ${(ratio * 100).toFixed(1)}% transparent pixels; expected > 0`);
});

test('the delivered poster really carries alpha (encoded alpha channel)', () => {
  assert.ok(existsSync(POSTER), `fixture missing: ${POSTER}`);
  const ratio = transparentRatio(POSTER, []);
  assert.ok(ratio > 0, `nanami-poster.png has ${(ratio * 100).toFixed(1)}% transparent pixels; expected > 0`);
});

test('the delivered portrait.md parses as a portrait and points at the real clip', () => {
  const md = path.join(WORLD_ROOT, 'characters/nanami/portrait.md');
  assert.ok(existsSync(md), `fixture missing: ${md}`);
  const text = readFileSync(md, 'utf8');
  assert.match(text, /^component:\s*portrait\s*$/m);
  const video = text.match(/^video:\s*(\S+)\s*$/m)?.[1];
  assert.ok(video, 'portrait.md declares a `video:`');
  // `video:` is world-root-relative (contract §5.4), so resolve it there.
  assert.ok(existsSync(path.join(WORLD_ROOT, video)), `video target exists: ${video}`);
});
