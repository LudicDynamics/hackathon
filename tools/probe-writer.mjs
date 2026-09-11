#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writerLaunch, characterLaunch } from '../apps/server/dist/engine/launch.js';
import { RpcClient } from '../vendor/pi-rp/packages/coding-agent/dist/index.js';
import { LocalWorldStore, parseFrontmatter } from '../packages/shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor/pi-rp/packages/coding-agent/dist/cli.js');
const TEST_WORLD = path.join(REPO_ROOT, 'templates/holmes-world');
const PROBE_PROVIDER = path.join(__dirname, 'probe-provider.ts');
const PROBE_CHALK_REL = 'world/baker-street/probe-chalk.md';

/** Preset-loading failures must fail the probe, never degrade silently (AGENTS.md §6.4). */
function presetWarnings(client) {
  return client
    .getStderr()
    .split('\n')
    .filter((line) => line.includes('not found') || line.includes('unknown slot'))
    .map((line) => line.trim());
}

/**
 * Spawns a spec from `engine/launch.js`, waits for it to settle, and asserts the
 * preset actually loaded. Passing the spec the server itself uses is the point —
 * a broken path or a renamed slot fails here rather than silently at runtime.
 */
async function checkSpawn(label, spec) {
  console.log(`\n[${label}] Spawning from shared launch spec...`);
  console.log(`  args: ${spec.args.join(' ')}`);
  console.log(`  session dir: ${spec.env.PI_CODING_AGENT_SESSION_DIR ?? '(none)'}`);

  const client = new RpcClient({
    cliPath: spec.cliPath,
    cwd: spec.cwd,
    args: spec.args,
    env: { ...spec.env, PI_OFFLINE: '1' },
  });
  await client.start();
  await new Promise((r) => setTimeout(r, 1500));

  const warnings = presetWarnings(client);
  if (warnings.length > 0) {
    throw new Error(`${label}: preset was not loaded:\n${warnings.join('\n')}`);
  }
  console.log(`✓ ${label} spawned; preset resolved (no "not found" / "unknown slot").`);
  await client.stop();
  console.log(`✓ ${label} stopped.`);
}

async function runProbe() {
  console.log('=== [AIRP Gate Probe] Testing Monorepo Pipeline ===');

  // 1. Verify LocalWorldStore & SQLite schemas
  console.log('[Probe 1] Testing LocalWorldStore on templates/holmes-world...');
  const store = new LocalWorldStore(TEST_WORLD);
  const manifest = await store.getManifest();
  console.log(`✓ Manifest loaded: "${manifest.name}" (ID: ${manifest.id}, Genre: ${manifest.genre})`);

  const files = await store.listFiles();
  console.log(`✓ Files listed: ${files.length} items found in world.`);

  const testEvt = await store.appendWorldEvent('probe_test', { timestamp: Date.now() });
  console.log(`✓ SQLite history event created: [${testEvt.type}] id: ${testEvt.id}`);

  store.close();

  // 2 & 3. Writer / character spawn through the single source of spawn args.
  await checkSpawn('Probe 2', writerLaunch(REPO_ROOT, TEST_WORLD, VENDOR_CLI));
  await checkSpawn('Probe 3', characterLaunch(REPO_ROOT, TEST_WORLD, VENDOR_CLI, 'watson'));

  // 4. Real narrative round-trip.
  await runNarrativeRoundTrip();

  // The template must stay clean — Probe 4 runs on a tmp copy.
  if (fs.existsSync(path.join(TEST_WORLD, PROBE_CHALK_REL))) {
    throw new Error(`Probe 4 leaked probe-chalk.md into the template at ${PROBE_CHALK_REL}`);
  }
  console.log('✓ Template world untouched by Probe 4.');

  console.log('\n=== [AIRP Gate Probe] ALL CHECKS PASSED ===');
}

async function runNarrativeRoundTrip() {
  console.log('\n[Probe 4] Narrative round-trip with deterministic provider...');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'airp-probe-'));
  fs.cpSync(TEST_WORLD, tmp, { recursive: true });
  fs.rmSync(path.join(tmp, '.airpworld', 'sessions'), { recursive: true, force: true });

  const spec = writerLaunch(REPO_ROOT, tmp, VENDOR_CLI);
  const realModel = process.env.AIRP_PROBE_REAL === '1';
  const client = new RpcClient({
    cliPath: spec.cliPath,
    cwd: spec.cwd,
    args: realModel ? spec.args : [...spec.args, '--extension', PROBE_PROVIDER],
    env: { ...spec.env, PI_OFFLINE: '1' },
    ...(realModel ? {} : { provider: 'airp-probe', model: 'deterministic' }),
  });

  const events = [];
  client.onEvent((event) => events.push(event));

  try {
    await client.start();

    const state = await client.getState();
    const provider = state.model?.provider;
    if (!realModel && provider !== 'airp-probe') {
      console.log(`[Probe 4] SKIPPED: deterministic provider not loaded (provider=${provider ?? 'none'})`);
      throw new Error('Probe 4 SKIPPED: deterministic provider not loaded');
    }

    await client.prompt('walk into the kitchen and look around');
    await client.waitForIdle(30000);

    const sawDelta = events.some(
      (e) => e.type === 'message_update' && e.assistantMessageEvent?.type === 'text_delta'
    );
    if (!sawDelta) throw new Error('Probe 4: no streamed text_delta event observed');

    const wrote = events.some(
      (e) => e.type === 'tool_execution_end' && e.toolName === 'write' && e.isError === false
    );
    if (!wrote) throw new Error('Probe 4: no successful tool_execution_end(write) observed');

    const landed = path.join(tmp, PROBE_CHALK_REL);
    if (!fs.existsSync(landed)) throw new Error(`Probe 4: chalk file not written to ${landed}`);
    const fm = parseFrontmatter(fs.readFileSync(landed, 'utf-8'));
    if (fm.frontmatter?.type !== 'chalk') {
      throw new Error(`Probe 4: frontmatter.type is ${JSON.stringify(fm.frontmatter?.type)}, expected 'chalk'`);
    }

    console.log('✓ Streamed text_delta received (streaming channel).');
    console.log('✓ tool_execution_end(write) succeeded (tool channel).');
    console.log('✓ probe-chalk.md landed in the tmp world copy.');
    console.log("✓ parseFrontmatter resolved type: 'chalk'.");
  } finally {
    await client.stop().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

runProbe().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
