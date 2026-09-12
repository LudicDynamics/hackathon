#!/usr/bin/env node
/**
 * Voice-corpus gate (`pnpm check:voices`) — docs/tts/07 §4.
 *
 * The bugs this exists to catch, all three of which shipped once (07 §0):
 *   1. `voice: Eldric` — a raw id that is NOT a DashScope voice (the real one
 *      is `Eldric Sage`), so the character was silent on every page.
 *   2. `voice: Sage` — the other half of the same mistake.
 *   3. `voice: Eldric Sage` reaching `POST /api/tts` and being silently
 *      rewritten to the default, because the old shape regex forbade spaces.
 *
 * The palette (`resolveVoice`) is the single vocabulary; this walks every
 * character README in every template and asserts its declaration RESOLVES.
 * A file that declares nothing is fine — it means "use the server default".
 *
 * This is a CONTENT gate, not a runtime one: it never touches the network.
 * Whether a palette id actually synthesises is established by 07 §5's recorded
 * run, not re-litigated here (a gate that needs an API key is a gate that gets
 * skipped).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VOICES, VOICE_COUNT, resolveVoice } from '../packages/shared/dist/index.js';
import { parseFrontmatter } from '../vendor/pi-rp/packages/coding-agent/dist/utils/frontmatter.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rel = (abs) => path.relative(REPO, abs).split(path.sep).join('/');

let failed = 0;
const check = (label, ok, extra = '') => {
  if (ok) {
    console.log(`  ok  ${label}`);
  } else {
    console.error(`FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
    failed++;
  }
};

// --------------------------------------------------------------------- V0

// A vacuous pass would hide everything below: an empty palette resolves nothing,
// and an empty README walk checks nothing.
check('palette is non-empty', VOICE_COUNT > 0, `${VOICE_COUNT} entries`);
assert.ok(VOICES.length > 0, 'palette is empty — the import is wrong, not the corpus');

const missingDist = !fs.existsSync(path.join(REPO, 'packages/shared/dist/rules/voices.js'));
if (missingDist) {
  console.error(
    '\npackages/shared/dist/rules/voices.js is missing — run `pnpm --filter @airp/shared build` first (AGENTS.md §6.5).'
  );
  process.exit(1);
}

// --------------------------------------------------------------------- V1

// Alias and id are BOTH vocabularies; each must resolve, and no two aliases may
// collide (a duplicate alias would make resolution order-dependent).
const seenAlias = new Set();
const seenId = new Set();
for (const v of VOICES) {
  check(`palette alias is kebab-case: ${v.alias}`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.alias));
  check(`palette alias is unique: ${v.alias}`, !seenAlias.has(v.alias));
  seenAlias.add(v.alias);
  check(`palette id is unique: ${v.id}`, !seenId.has(v.id));
  seenId.add(v.id);
  check(
    `palette entry resolves to itself: ${v.alias} → ${v.id}`,
    resolveVoice(v.alias) === v.id && resolveVoice(v.id) === v.id
  );
}

// --------------------------------------------------------------------- V2

// The shape the old regex broke: a real voice id may contain a space. If the
// palette ever loses this property the gate's own premise is gone, so assert a
// spaced id survives, then assert the whole palette does.
const spaced = VOICES.filter((v) => v.id.includes(' ')).map((v) => v.id);
check('at least one palette id contains a space (07 §0 regression)', spaced.length > 0, spaced.join(', '));
for (const id of spaced) {
  check(`spaced id resolves: ${id}`, resolveVoice(id) === id);
}

// --------------------------------------------------------------------- V3

/** Every `templates/<world>/characters/<id>/README.md`. */
function characterReadmes() {
  const out = [];
  const templates = path.join(REPO, 'templates');
  if (!fs.existsSync(templates)) return out;
  for (const world of fs.readdirSync(templates, { withFileTypes: true })) {
    if (!world.isDirectory()) continue;
    const chars = path.join(templates, world.name, 'characters');
    if (!fs.existsSync(chars)) continue;
    for (const c of fs.readdirSync(chars, { withFileTypes: true })) {
      if (!c.isDirectory()) continue;
      const readme = path.join(chars, c.name, 'README.md');
      if (fs.existsSync(readme)) out.push({ world: world.name, id: c.name, file: readme });
    }
  }
  return out;
}

const readmes = characterReadmes();
check('character README walk finds the corpus', readmes.length > 0, `${readmes.length} found`);

/** world → { id, voice|null } — used by V5's "no duplicate voice" check. */
const byWorld = new Map();

for (const { world, id, file } of readmes) {
  const { frontmatter } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
  const raw = frontmatter?.voice;
  const where = `${rel(file)}`;

  if (raw === undefined || raw === null) {
    // No declaration = the server default. Legal, and worth SEEING: a world
    // whose characters are all voiceless is a content decision, not a bug.
    console.log(`  --  ${where}: no voice declared (server default)`);
    if (!byWorld.has(world)) byWorld.set(world, []);
    byWorld.get(world).push({ id, voice: null });
    continue;
  }

  if (typeof raw !== 'string' || raw.trim() === '') {
    check(`${where}: voice is a non-empty string`, false, JSON.stringify(raw));
    continue;
  }

  const declared = raw.trim();
  const resolved = resolveVoice(declared);
  check(
    `${where}: voice "${declared}" resolves`,
    resolved !== null,
    resolved === null
      ? `not in the palette — add it to packages/shared/src/rules/voices.ts (07 §5) or use an alias from the table`
      : ''
  );

  // The whole point of the alias vocabulary: a raw id is accepted for
  // compatibility, but new content should name the EFFECT (07 §2).
  if (resolved !== null && declared === resolved && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(declared)) {
    console.warn(`  ~~  ${where}: declares the raw id "${declared}"; prefer its effect alias (07 §2)`);
  }

  if (!byWorld.has(world)) byWorld.set(world, []);
  byWorld.get(world).push({ id, voice: resolved });
}

// --------------------------------------------------------------------- V4

// Two characters in the SAME world sharing one voice makes them
// indistinguishable when both can speak; across worlds it is fine (the same
// actor, or a deliberate house style).
for (const [world, chars] of byWorld) {
  const voices = chars.map((c) => c.voice).filter((v) => v !== null);
  const dupes = voices.filter((v, i) => voices.indexOf(v) !== i);
  check(
    `${world}: no two characters share a voice`,
    dupes.length === 0,
    dupes.length > 0 ? `${[...new Set(dupes)].join(', ')} used by multiple characters` : ''
  );
}

console.log(`\n${failed === 0 ? 'ALL VOICE-CORPUS ASSERTIONS PASSED' : `${failed} ASSERTION(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
