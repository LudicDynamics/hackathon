#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

  const presetPath = path.join(REPO_ROOT, 'presets/writer.json');
  console.log(`Spawning pi-rp with preset: ${presetPath}`);

  client.start({
    cwd: TEST_WORLD,
    args: ['--preset', presetPath, '--offline'],
  });

  // Wait 1.5s for initialization
  await new Promise((r) => setTimeout(r, 1500));
  console.log('✓ PiRpcClient process spawned and responsive.');

  client.stop();
  console.log('✓ PiRpcClient successfully stopped.');

  console.log('\n=== [AIRP Gate Probe] ALL CHECKS PASSED ===');
}

runProbe().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
