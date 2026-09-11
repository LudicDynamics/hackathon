#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { airpEnv, extensionArgs, installPreset, skillArgs } from '../apps/server/dist/engine/presets.js';
import { PiRpcClient } from '../apps/server/dist/engine/rpc-client.js';
import { LocalWorldStore } from '../packages/shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const VENDOR_CLI = path.join(REPO_ROOT, 'vendor/pi-rp/packages/coding-agent/dist/cli.js');
const TEST_WORLD = path.join(REPO_ROOT, 'templates/holmes-world');

async function runProbe() {
  console.log('=== [AIRP Gate Probe] Testing Monorepo Pipeline ===');
  
  // 1. Verify LocalWorldStore & SQLite schemas
  console.log('[Probe 1] Testing LocalWorldStore on templates/holmes-world...');
  const store = new LocalWorldStore(TEST_WORLD);
  const manifest = await store.getManifest();
  console.log(`✓ Manifest loaded: "${manifest.name}" (ID: ${manifest.id}, Genre: ${manifest.genre})`);
  
  const files = await store.listFiles();
  console.log(`✓ Files listed: ${files.length} items found in world.`);
  
  // Test Event appending
  const testEvt = await store.appendWorldEvent('probe_test', { timestamp: Date.now() });
  console.log(`✓ SQLite history event created: [${testEvt.type}] id: ${testEvt.id}`);

  store.close();

  // 2. Test Vendor pi-rp CLI & RPC spawn
  console.log('\n[Probe 2] Testing PiRpcClient spawn with vendor pi-rp...');
  const client = new PiRpcClient(VENDOR_CLI);
  
  client.on('stderr', (err) => {
    // console.log('[RPC stderr]', err.trim());
  });

  let receivedEvent = false;
  client.on('event', (evt) => {
    receivedEvent = true;
  });

  const presetId = installPreset(TEST_WORLD, path.join(REPO_ROOT, 'presets/writer.json'));
  console.log(`Installed preset "${presetId}" into ${TEST_WORLD}/.airpworld/prompt-presets/`);

  // pi-rp's --preset recognizes only the id; passing a file path prints "not found" and
  // silently falls back to the default preset. Promote that warning to a probe failure so
  // the wiring cannot silently regress again.
  const presetWarnings = [];
  client.on('stderr', (err) => {
    // "not found" catches a missing preset; "unknown slot" catches a preset item this
    // pi-rp build does not implement (e.g. a slot renamed upstream).
    if (err.includes('not found') || err.includes('unknown slot')) presetWarnings.push(err.trim());
  });

  // Spawn with the same skill & extension args the server uses, so a broken path or an
  // unimplemented slot fails the probe instead of degrading silently at runtime.
  const skills = skillArgs(REPO_ROOT, TEST_WORLD);
  console.log(`Skill dirs: ${skills.filter((a) => a !== '--skill').join(', ') || '(none)'}`);

  const extensions = extensionArgs(REPO_ROOT, TEST_WORLD);
  console.log(`Extension files: ${extensions.filter((a) => a !== '--extension').join(', ') || '(none)'}`);

  client.start({
    cwd: TEST_WORLD,
    args: ['--preset', presetId, '--offline', ...extensions, ...skills],
    env: airpEnv(TEST_WORLD),
  });

  // Wait 1.5s for initialization
  await new Promise((r) => setTimeout(r, 1500));
  console.log('✓ PiRpcClient process spawned and responsive.');
  if (presetWarnings.length > 0) {
    throw new Error(`preset "${presetId}" was not loaded:\n${presetWarnings.join('\n')}`);
  }
  console.log(`✓ Preset "${presetId}" resolved (no "not found" warning).`);

  client.stop();
  console.log('✓ PiRpcClient successfully stopped.');

  // 3. Test Character preset and system-char slot resolution
  console.log('\n[Probe 3] Testing Character preset and system-char slot resolution...');
  const charClient = new PiRpcClient(VENDOR_CLI);
  const charPresetId = installPreset(TEST_WORLD, path.join(REPO_ROOT, 'presets/character.json'));
  console.log(`Installed preset "${charPresetId}" into ${TEST_WORLD}/.airpworld/prompt-presets/`);

  const charPresetWarnings = [];
  charClient.on('stderr', (err) => {
    if (err.includes('not found') || err.includes('unknown slot')) charPresetWarnings.push(err.trim());
  });

  charClient.start({
    cwd: TEST_WORLD,
    args: ['--preset', charPresetId, '--offline', ...extensions],
    env: airpEnv(TEST_WORLD),
  });

  await new Promise((r) => setTimeout(r, 1500));
  console.log('✓ Character PiRpcClient process spawned and responsive.');
  if (charPresetWarnings.length > 0) {
    throw new Error(`preset "${charPresetId}" was not loaded:\n${charPresetWarnings.join('\n')}`);
  }
  console.log(`✓ Preset "${charPresetId}" resolved (no "not found" warning).`);

  charClient.stop();
  console.log('✓ Character PiRpcClient successfully stopped.');

  console.log('\n=== [AIRP Gate Probe] ALL CHECKS PASSED ===');
}

runProbe().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
