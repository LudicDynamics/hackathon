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
 *
 * Convention: entries are keyed by route and matched on the `fetch('<route>', …)`
 * text. A read-only GET (e.g. `GET /api/live/config`, `GET /api/tts/config`) has
 * no body to pin, so it is NOT registered — the gate's whole premise is a frozen
 * request-body key set, and a bodyless route has none.
 */
const BODIES = [
  {
    route: '/api/material-review',
    file: 'apps/web/src/components/narrative/EntityInteractions.tsx',
    keys: ['world', 'path', 'choice', 'revision', 'selections'],
    doc: 'docs/gameplay/多槽材料与统一行动入口.md',
  },
  {
    route: '/api/dice',
    file: 'apps/web/src/components/narrative/DiceRoller.tsx',
    keys: ['path'],
    doc: 'docs/wiring/00-共同上下文.md §6',
  },
  {
    route: '/api/tts',
    file: 'apps/web/src/components/overlay/CharacterModal.tsx',
    keys: ['text', 'voice', 'language', 'characterId', 'emotion'],
    doc: 'docs/wiring/00-共同上下文.md §6',
  },
  // The gateway (`airp-gateway.ts`) wraps bodies in `json('POST', {...})` rather
  // than an inline `fetch(... JSON.stringify({...}))` — so `bodyKeysFor` MUST also
  // read that shape, or a rename here sails through unseen. This is exactly how
  // `/api/god-action` shipped posting `filePath` against the server's `path`
  // (2026-09-13 merge): the gate's scan missed the wrapper entirely.
  {
    route: '/api/god-action',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['action', 'path', 'content'],
    doc: 'docs/wiring/00-共同上下文.md §6',
  },
  {
    route: '/api/use-item',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['item', 'target'],
    doc: 'docs/tools/12-工具注册与路由统一.md §6',
  },
  {
    route: '/api/move',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['from', 'to'],
    doc: 'docs/tools/12-工具注册与路由统一.md §6',
  },
  {
    route: '/api/choice',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['path', 'choice'],
    doc: 'docs/tools/12-工具注册与路由统一.md §6',
  },
  {
    route: '/api/card/position',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['path', 'x', 'y'],
    doc: 'docs/tools/12-工具注册与路由统一.md §6',
  },
  {
    route: '/api/following',
    file: 'apps/web/src/lib/airp-gateway.ts',
    keys: ['character', 'following'],
    doc: 'docs/presence/00-共同上下文.md §3.3',
  },
  // docs/live-voice/00-共同上下文.md §2.2 freezes the two bodies. Only the two
  // POSTs carry one; `GET /api/live/config` is a bodyless readiness probe (see
  // the note above BODIES) and is deliberately not registered here.
  {
    route: '/api/live/session',
    file: 'apps/web/src/lib/live-call.ts',
    keys: ['character', 'sdp', 'language'],
    doc: 'docs/live-voice/00-共同上下文.md §2.2',
  },
  {
    route: '/api/live/close',
    file: 'apps/web/src/lib/live-call.ts',
    keys: ['character'],
    doc: 'docs/live-voice/00-共同上下文.md §2.2',
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
 * Extract the body key set for `route`, from whichever call shape carries it:
 *   1. inline `fetch('<route>', { … body: JSON.stringify({...}) })`;
 *   2. the gateway wrapper `request('<route>', json('POST', {...}))`.
 *
 * Handles both `name: value` and shorthand `name` properties — the shorthand
 * form is common and MUST not be read as an empty key set (that would make the
 * gate fire on already-correct code).
 *
 * Pure — takes file text, returns `{ keys, line } | null`. `null` means neither
 * shape could be found (itself a finding).
 */
export function bodyKeysFor(text, route) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(route)) continue;
    // A comment that merely MENTIONS the route (e.g. a doc note `fetch('/api/tts'`
    // in a JSDoc block) must not be taken for the call: it has no balanced body,
    // so the scan would stop there and report a false "call site moved". Skip
    // comment-only lines and take the first real call.
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (lines[i].includes('fetch(')) {
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
      if (s) return { keys: keysOfObjectLiteral(s[1]), line: i + 1 };
      return null;
    }
    // Shape 2: gateway `json('POST', {...})`. The route and the body may be on
    // adjacent lines, so scan the call until parens balance.
    if (lines[i].includes('json(')) {
      let depth = 0;
      let chunk = '';
      let sawParen = false;
      for (let j = i; j < Math.min(lines.length, i + 15); j++) {
        chunk += lines[j] + '\n';
        depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
        if (lines[j].includes('(')) sawParen = true;
        if (sawParen && depth <= 0) break;
      }
      const s = chunk.match(/json\(\s*['"][A-Z]+['"]\s*,\s*\{([\s\S]*?)\}\s*\)/);
      if (s) return { keys: keysOfObjectLiteral(s[1]), line: i + 1 };
      return null;
    }
  }
  return null;
}

/** Property keys of an object literal's inner text (`name:` / shorthand `name`). */
function keysOfObjectLiteral(inner) {
  const keys = [];
  for (const part of splitTopLevel(inner)) {
    // `name:` (explicit) or `name` (shorthand); a `...spread` contributes none.
    const m = part.match(/^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (m && !part.trim().startsWith('...')) keys.push(m[1]);
  }
  return keys;
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
