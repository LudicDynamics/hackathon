// Launch-spec regression — the isolated canvas-arranger extension.
//
// `extensions/canvas-arranger.ts` registers `view_canvas` / `screenshot_canvas`
// / `arrange_canvas` for the functional arranger process ONLY (docs/layout/08
// §5.2/§6). The Writer and Character processes get those same names from
// `extensions/tools.ts`. Because `extensionArgs` discovers every `.ts` under
// `extensions/`, a regression once handed BOTH files to writer/character and
// pi-rp threw `Tool "screenshot_canvas" conflicts with …` — every agent launch
// failed, and no gate noticed (there was no launch-spec test).
//
// These assertions defend the observable contract: the two launch shapes load
// DISJOINT extension sets, and the arranger keeps its explicit isolated one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor', 'pi-rp', 'packages', 'coding-agent', 'dist', 'cli.js');
const rel = (abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/');

const { ISOLATED_EXTENSIONS, extensionArgs } = await import(
  path.join(REPO_ROOT, 'apps/server/dist/engine/presets.js')
);
const { canvasArrangerLaunch, characterLaunch, writerLaunch } = await import(
  path.join(REPO_ROOT, 'apps/server/dist/engine/launch.js')
);

/** `--extension` targets of one launch spec, repo-relative and sorted. */
function extensionTargets(spec) {
  const out = [];
  for (let i = 0; i < spec.args.length; i += 1) {
    if (spec.args[i] === '--extension') out.push(rel(spec.args[i + 1]));
  }
  return out.sort();
}

/** Tools a tool definition registers are its `name`; read them off the source. */
function registeredToolNames(file) {
  const src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
  return [...src.matchAll(/\{\s*name:\s*'([a-z_]+)',\s*tool:/g)].map((m) => m[1]);
}

test('the generic extension scan never loads an isolated extension', () => {
  const generic = extensionArgs(REPO_ROOT).map((p, i, arr) => (arr[i - 1] === '--extension' ? rel(p) : null)).filter(Boolean);
  for (const name of ISOLATED_EXTENSIONS) {
    assert.ok(
      !generic.includes(`extensions/${name}`),
      `extensions/${name} is isolated (only its own launch spec may load it) but the generic scan loaded it`
    );
  }
});

test('writer and character processes do not load a tool-defining isolated extension', () => {
  const world = path.join(REPO_ROOT, 'templates', 'wuwu');
  for (const [label, spec] of [
    ['writer', writerLaunch(REPO_ROOT, world, VENDOR_CLI)],
    ['character', characterLaunch(REPO_ROOT, world, VENDOR_CLI, 'vera')],
  ]) {
    const targets = extensionTargets(spec);
    for (const name of ISOLATED_EXTENSIONS) {
      assert.ok(
        !targets.includes(`extensions/${name}`),
        `${label} launch loads isolated extensions/${name}; pi-rp keys tools by name, so a duplicated tool throws at boot`
      );
    }
  }
});

test('no two extensions loaded by one agent define the same tool name', () => {
  const world = path.join(REPO_ROOT, 'templates', 'wuwu');
  const specs = {
    writer: writerLaunch(REPO_ROOT, world, VENDOR_CLI),
    character: characterLaunch(REPO_ROOT, world, VENDOR_CLI, 'vera'),
    'canvas-arranger': canvasArrangerLaunch(REPO_ROOT, world, VENDOR_CLI, 'operation-1', 'functional:canvas-arranger:test'),
  };
  for (const [label, spec] of Object.entries(specs)) {
    const owners = new Map();
    for (const target of extensionTargets(spec)) {
      for (const tool of registeredToolNames(target)) {
        const previous = owners.get(tool);
        assert.ok(
          !previous || previous === target,
          `${label}: tool "${tool}" is registered by both ${previous} and ${target} — pi-rp throws on the duplicate and the agent cannot boot`
        );
        owners.set(tool, target);
      }
    }
  }
});

test('the canvas-arranger process still loads its isolated extension explicitly', () => {
  const spec = canvasArrangerLaunch(
    REPO_ROOT,
    path.join(REPO_ROOT, 'templates', 'wuwu'),
    VENDOR_CLI,
    'operation-1',
    'functional:canvas-arranger:test'
  );
  const targets = extensionTargets(spec);
  assert.deepEqual(
    targets,
    ISOLATED_EXTENSIONS.map((name) => `extensions/${name}`).sort(),
    'the arranger must load exactly its isolated extension(s) — no generic discovery, no extra tools'
  );
  for (const name of ISOLATED_EXTENSIONS) {
    assert.ok(
      fs.statSync(path.join(REPO_ROOT, 'extensions', name), { throwIfNoEntry: false })?.isFile(),
      `ISOLATED_EXTENSIONS names extensions/${name}, which does not exist`
    );
  }
});
