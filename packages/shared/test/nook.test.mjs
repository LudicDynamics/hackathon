/**
 * N1「角色小天地」— BLOCKER-N1 acceptance (contract 00 §2.7; docs/nook/05 §3.7).
 *
 * Two defects, same function `LocalWorldStore.seatUnplaced`:
 *   (a) `occupied` was built from EXISTING rows only — the batch never pushed
 *       its own freshly-seated boxes → every rowless card in one pass spirals
 *       to the same first cell and they all stack (distinct (x,y) === 1).
 *   (b) `nextZ` was computed once outside the loop and never advanced →
 *       a whole batch shared one `z_index` (stacking order undefined).
 *
 * Contract §2.7 第 6 条 boundary (do NOT widen): the parallel `reseatLayer`
 * already pushes twice (:807/:826) and `seatNear` seats a single card with a
 * fresh maxZ per call — both are OUT of scope. Only `seatUnplaced` was broken.
 *
 * Assertion shape follows docs/nook/05 §3.7:
 *   N1-A13 / N1-A14 — distinct seat positions === N   (x/y ONLY)
 *   N1-A27          — distinct z_index      === N
 * `z` does NOT participate in seat geometry, so N1-A13 cannot catch (b):
 * patching only `occupied.push` leaves A13 green and A27 red. Both must be
 * green together for the fix to count as complete.
 *
 * Fixtures use REAL archived template content (archive/templates/pre-bilingual-2026-09-14/holmes-world/world/baker-street)
 * — not synthetic markdown — so a drift in the declared-size path is visible.
 *
 * Build first:  pnpm --filter @airp/shared build
 * Run:          node --test packages/shared/test/nook.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { CARD_FORMS } from '../dist/schemas/forms.js';
import { LocalWorldStore } from '../dist/store/local-store.js';

const NOTE = CARD_FORMS.note; // 200 x 168

// ------------------------------------------------------------------ fixture

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const REAL_DIR = path.join(REPO_ROOT, 'archive/templates/pre-bilingual-2026-09-14/holmes-world/world/baker-street');

/** The three real baker-street cards: chalk / chalk / note (mixed declared). */
const REAL_FILES = [
  { name: 'evening.md', kind: 'chalk' },
  { name: 'late-night.md', kind: 'chalk' },
  { name: 'raindrops.md', kind: 'note' },
];

async function realContent() {
  const out = new Map();
  for (const f of REAL_FILES) {
    out.set(f.name, await fs.readFile(path.join(REAL_DIR, f.name), 'utf8'));
  }
  return out;
}

/** Real markdown bodies, but uniform declared size → the honest same-size batch. */
function sameSizeFiles(content) {
  return REAL_FILES.map((f) => {
    const rel = `characters/ryo/${f.name}`;
    return { path: rel, kind: 'note', w: NOTE.w, h: NOTE.h, body: content.get(f.name) };
  });
}

/** Real markdown bodies, real declared sizes (chalk/chalk/note). */
function realSizedFiles(content, dir) {
  return REAL_FILES.map((f) => {
    const rel = `${dir}/${f.name}`;
    const form = CARD_FORMS[f.kind];
    return { path: rel, kind: f.kind, w: form.w, h: form.h, body: content.get(f.name) };
  });
}

async function tempStore(prefix, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const store = new LocalWorldStore(root);
  for (const f of files) await store.writeFile(f.path, f.body);
  return {
    store,
    root,
    async cleanup() {
      store.close();
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

const xyKey = (r) => `${r.x},${r.y}`;
const distinctCount = (arr, key) => new Set(arr.map(key)).size;

// ------------------------------------------------- N1-A13 (position, x/y)

test('nook §N1-A13: a same-batch seat assigns N DISTINCT positions (BLOCKER-N1)', async () => {
  const content = await realContent();
  const files = sameSizeFiles(content);
  const { store, cleanup } = await tempStore('airp-nook-seat-', files);
  const warns = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warns.push(args.join(' '));
  try {
    const seats = await store.seatUnplaced('characters/ryo', files);

    // Non-emptiness body: pre-fix every card shares the first spiral cell
    // (distinct (x,y) === 1 — all on the seat anchor, i.e. 860,456 at note size).
    assert.equal(
      distinctCount(seats, xyKey),
      files.length,
      `every unplaced card needs its own seat; got ${distinctCount(seats, xyKey)}/${files.length}`
    );

    // A starved spiral (600 candidates exhausted) means the fixture/anchor is
    // off, not that the seat is fine — the fix must seat cleanly.
    assert.deepEqual(warns, [], 'no "no free cell" starvation warn for a 3-card batch');

    // Persisted rows must be distinct too (guards "returned right, INSERT wrong").
    const rows = store.getLayerCards(files.map((f) => f.path));
    assert.equal(rows.length, files.length);
    assert.equal(distinctCount(rows, xyKey), rows.length, 'persisted rows must be distinct too');
  } finally {
    console.warn = originalWarn;
    await cleanup();
  }
});

// ------------------------------------------- N1-A27 (z order — the twin half)

test('nook §N1-A27: a same-batch seat assigns distinct z (BLOCKER-N1, second half)', async () => {
  // Same fixture, same pass as N1-A13. Pre-fix: z values [1,1,1] → distinct 1/3.
  const content = await realContent();
  const files = sameSizeFiles(content);
  const { store, cleanup } = await tempStore('airp-nook-seat-z-', files);
  try {
    const seats = await store.seatUnplaced('characters/ryo', files);
    assert.equal(
      distinctCount(seats, (s) => s.z),
      files.length,
      'each new seat needs its own z_index (stacking order is z, AGENTS §7.5 第 6 条)'
    );

    const rows = store.getLayerCards(files.map((f) => f.path));
    assert.equal(distinctCount(rows, (r) => r.z), rows.length, 'persisted z must be distinct too');
  } finally {
    await cleanup();
  }
});

// ------------------------------------------- N1-A14 (attribution lock, normal layer)

test('nook §N1-A14: the same batch seats distinctly in a NORMAL layer (attribution lock)', async () => {
  // Pins the red on `seatUnplaced` itself: if a route were the problem, this
  // would stay green while N1-A13 stayed red. Both go red/green together.
  const content = await realContent();
  const files = realSizedFiles(content, 'world/baker-street');
  const { store, cleanup } = await tempStore('airp-nook-seat-normal-', files);
  try {
    const seats = await store.seatUnplaced('world/baker-street', files);
    assert.equal(
      distinctCount(seats, xyKey),
      files.length,
      'the bug is in seatUnplaced, not in the nook route'
    );
  } finally {
    await cleanup();
  }
});
