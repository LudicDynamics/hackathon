#!/usr/bin/env node
/**
 * i18n key gate (`pnpm check:i18n`).
 *
 * Why this exists: `translate()` (apps/web/src/lib/i18n.ts) falls back to the
 * KEY ITSELF when a locale entry is missing — `entry?.[locale] ?? key`. So a
 * `t('Some English sentence')` whose key is absent from messages.json renders
 * the English sentence in EVERY locale: a silent de-localisation. That is
 * exactly how the origin/niko merge dropped seven keys (scene chalk, the ghost
 * failure lines, the writer-writing line) plus one added call site — the page
 * still worked, it just quietly stopped being Japanese/Chinese.
 *
 * The gate fails on the sound direction only: a used key with no (complete)
 * translation. The reverse — a defined key with no visible call site — is a
 * WARNING, because `t()` is also called with a variable (`t(writerStage)`),
 * which a literal scan cannot follow.
 *
 * Known, deliberately out of scope: inline `locale === 'ja' ? … : …` ternaries
 * bypass `t()` entirely (zh-CN silently gets English). That is a niko-side
 * pattern predating this gate; it is reported in docs/settings/00 §5 rather
 * than gated here. The OTHER dynamic-key pattern — mapping `UI_COPY.en` VALUES
 * into message keys via `translate(locale, value)` — used to sit in the same
 * blind spot but is now covered by §3 below (shrink-only baseline).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blindCopyKeyReads, compareBlindKeys, englishCopyValues, translationCalls } from './lib/i18n-call-keys.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webSrc = path.join(repoRoot, 'apps/web/src');
const messagesPath = path.join(webSrc, 'lib/messages.json');

const LOCALES = ['zh-CN', 'ja'];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Collect the keys of every `t(…)` call, with source positions.
 *
 * Parse only the first argument, including conditional key alternatives.
 * Interpolation values and conditions are not translation keys. Dynamic keys
 * (`t(someVariable)`) yield nothing and are intentionally not gated.
 */
function callKeys(file, text) {
  return translationCalls(file, text).map(hit => ({ ...hit, file: path.relative(repoRoot, file) }));
}

const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
const problems = [];
const used = new Map();

// 1. used-but-undefined (or half-translated) — the fail-worthy direction.
for (const file of walk(webSrc)) {
  for (const hit of callKeys(file, fs.readFileSync(file, 'utf8'))) {
    if (!used.has(hit.key)) used.set(hit.key, []);
    used.get(hit.key).push(hit);
    const entry = messages[hit.key];
    if (!entry) {
      problems.push(`${hit.file}:${hit.line} — t('${hit.key}') has no messages.json entry (renders as English in every locale)`);
    } else {
      for (const loc of LOCALES) {
        if (typeof entry[loc] !== 'string' || entry[loc] === '') {
          problems.push(`${hit.file}:${hit.line} — t('${hit.key}') is missing the '${loc}' translation`);
        }
      }
    }
  }
}

// 2. defined-but-unused — a WARNING (see the header note).
for (const key of Object.keys(messages)) {
  if (!used.has(key)) {
    console.warn(`warn apps/web/src/lib/messages.json — key '${key}' has no literal t('…') call site`);
  }
}

// 3. dynamic-key reads — the `translate(locale, UI_COPY.en[x])` pattern
//    (docs/live-voice/30 §3.3). The literal scan above intentionally skips
//    dynamic keys, so this pattern is invisible to it. Files that map UI_COPY
//    VALUES into message keys are registered explicitly, and the blind keys
//    found today are a SHRINK-ONLY baseline: a new blind key fails, and fixing
//    one without shrinking the list ALSO fails (so the list cannot rot green).
const DYNAMIC_KEY_CONSUMERS = [
  'apps/web/src/components/nook/NookView.tsx',
  'apps/web/src/lib/live-call-store.ts',
];
/** Blind keys as of 2026-09-15 (docs/live-voice/35 §2.3). SHRINK-ONLY. */
const BLIND_KEY_BASELINE = new Set([
  'liveCallStart', 'liveCallModalBlocked', 'liveErrorUnconfigured',
  'liveErrorMicUnsupported', 'liveErrorConnection', 'liveErrorGeneric',
  'nookEmptyPrompt', 'nookInitSkip',
]);

// A `copy.<key>` read is blind when UI_COPY's ENGLISH value for that key is not
// itself a messages.json entry: `translate()` then falls back to the English
// sentence in every locale. Registered consumers must not grow lookalike local
// objects; if one appears, drop the file from the list and say why in the commit.
const copyValues = englishCopyValues(fs.readFileSync(path.join(webSrc, 'lib/legacy-ui-copy.ts'), 'utf8'));
const blind = new Map();
for (const file of DYNAMIC_KEY_CONSUMERS) {
  const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  for (const read of blindCopyKeyReads(text, 'copy', copyValues, messages)) {
    if (!blind.has(read.key)) blind.set(read.key, { key: read.key, value: read.value, file });
  }
}
const dynamicProblems = compareBlindKeys([...blind.values()], BLIND_KEY_BASELINE);
problems.push(...dynamicProblems);

if (problems.length > 0) {
  console.error('i18n key gate FAILED:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`ok   i18n keys: ${used.size} used keys resolve with full zh-CN/ja translations (${Object.keys(messages).length} entries)`);
if (!dynamicProblems.length) console.log(`ok   i18n dynamic keys: ${blind.size} registered blind key(s), none new (baseline ${BLIND_KEY_BASELINE.size}; shrink-only)`);
