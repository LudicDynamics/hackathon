#!/usr/bin/env node
/**
 * check-request-bodies.mjs — mechanical gate for the HTTP request-body keys the
 * browser sends to the AIRP action routes.
 *
 * The WS gate (`check-ws-contract.mjs`) catches frame-name drift between the
 * two ends. Request bodies have no such net: they are plain `JSON.stringify`
 * literals on the frontend and destructured fields on the server, with no
 * shared type to make the compiler complain when one side renames a key. That
 * is exactly how `/api/dice` shipped broken — `DiceRoller.tsx` posted
 * `{ filePath, rollType, expect }` while `routes/world.ts` read `body.path`,
 * so every player-initiated roll returned 400 (fixed in the wiring A batch).
 *
 * This gate pins the frozen bodies (docs/wiring/00 §6) to the call sites, so a
 * rename on either end fails loudly instead of silently 400ing at runtime.
 *
 * Run:  node tools/check-request-bodies.mjs          (0 = clean, 1 = findings)
 *       node tools/check-request-bodies.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JSON_OUT = process.argv.includes('--json');

/**
 * The frozen request bodies (docs/wiring/00-共同上下文.md §6). Each entry names
 * the frontend file that posts the body, the route literal to locate the call,
 * and the exact key set that MUST appear in `JSON.stringify({...})`.
 */
const BODIES = [
  {
    route: '/api/dice',
    file: 'apps/web/src/components/narrative/DiceRoller.tsx',
    keys: ['path'],
    doc: 'docs/wiring/00-共同上下文.md §6',
  },
  {
    route: '/api/tts',
    file: 'apps/web/src/components/overlay/CharacterModal.tsx',
    keys: ['text', 'voice', 'language'],
    doc: 'docs/wiring/00-共同上下文.md §6',
  },
];

/**
 * Split an object literal's inner text on TOP-LEVEL commas, ignoring commas
 * nested inside (), [], {}, strings and template literals. Returns the raw
 * property chunks so each can be inspected for its key.
 */
function splitTopLevel(inner) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += inner[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/**
 * Extract the key set of the object literal passed to `JSON.stringify({...})`
 * inside a `fetch('<route>', { ... body: JSON.stringify({...}) ... })` call.
 *
 * Handles both `name: value` and shorthand `name` properties — the shorthand
 * form is common and MUST not be read as an empty key set (that would make the
 * gate fire on already-correct code).
 *
 * Pure — takes file text, returns `{ keys, line } | null`. `null` means the
 * fetch/stringify shape could not be found (itself a finding).
 */
export function bodyKeysFor(text, route) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('fetch(') || !lines[i].includes(route)) continue;
    // Gather the fetch call's text until parens balance (bounded window).
    let depth = 0;
    let chunk = '';
    let sawParen = false;
    for (let j = i; j < Math.min(lines.length, i + 15); j++) {
      chunk += lines[j] + '\n';
      depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
      if (lines[j].includes('(')) sawParen = true;
      if (sawParen && depth <= 0) break;
    }
    const s = chunk.match(/JSON\.stringify\(\s*\{([\s\S]*?)\}\s*\)/);
    if (!s) return null;
    const keys = [];
    for (const part of splitTopLevel(s[1])) {
      // `name:` (explicit) or `name` (shorthand); anything else is not a key.
      const m = part.match(/^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?::|$)/);
      if (m) keys.push(m[1]);
    }
    return { keys, line: i + 1 };
  }
  return null;
}

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf-8');

/**
 * Pure comparison, exported so `check-request-bodies.test.mjs` can drive it
 * with synthetic input (the gate stays non-empty by construction).
 *
 * `found` = `{ keys, line } | null` from `bodyKeysFor`.
 */
export function compare({ bodies, found }) {
  const out = [];
  for (const b of bodies) {
    const f = found.get(b.route);
    if (!f) {
      out.push({
        check: 'missing-call',
        file: b.file,
        line: 0,
        message: `no \`fetch('${b.route}', … JSON.stringify({...}))\` call found`,
        fix: 'the call site moved or was renamed; update BODIES in tools/check-request-bodies.mjs',
        doc: b.doc,
      });
      continue;
    }
    const want = [...b.keys].sort();
    const got = [...f.keys].sort();
    if (want.join(',') !== got.join(',')) {
      out.push({
        check: 'key-drift',
        file: b.file,
        line: f.line,
        message: `POST ${b.route} body keys = [${got.join(', ')}], contract says [${want.join(', ')}]`,
        fix: `post exactly ${JSON.stringify(want)} (frozen in ${b.doc})`,
        doc: b.doc,
      });
    }
  }
  return out;
}

function main() {
  const found = new Map();
  for (const b of BODIES) found.set(b.route, bodyKeysFor(read(b.file), b.route));

  const findings = compare({ bodies: BODIES, found });

  if (JSON_OUT) {
    console.log(JSON.stringify({ findings, summary: { routes: BODIES.length, findings: findings.length } }, null, 2));
  } else if (!findings.length) {
    console.log(`check-request-bodies: clean (${BODIES.length} route(s) pinned)`);
  } else {
    for (const f of findings) {
      console.log(`${f.check.toUpperCase().padEnd(12)} ${f.file}:${f.line}`);
      console.log(`             ${f.message}`);
      console.log(`             fix: ${f.fix}`);
    }
    console.log(`\ncheck-request-bodies: ${findings.length} finding(s)`);
  }
  return findings.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main() ? 1 : 0);
}
