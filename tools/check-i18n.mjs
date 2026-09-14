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
 * than gated here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translationCalls } from './lib/i18n-call-keys.mjs';

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

if (problems.length > 0) {
  console.error('i18n key gate FAILED:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`ok   i18n keys: ${used.size} used keys resolve with full zh-CN/ja translations (${Object.keys(messages).length} entries)`);
