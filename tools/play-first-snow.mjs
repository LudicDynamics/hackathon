#!/usr/bin/env node
// Opt-in live rehearsal. Uses a NEW save, the real Writer, and real AIRP actions.
// No generated outcome is copied into the template. --explore may call the image provider once.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { writerLaunch } from '../apps/server/dist/engine/launch.js';
import { RpcClient } from '../vendor/pi-rp/packages/coding-agent/dist/index.js';
import { LocalWorldStore, createActionService, parseFrontmatter } from '../packages/shared/dist/index.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (!args.includes('--run')) {
  console.log('Usage: node tools/play-first-snow.mjs --run [--route=nanami|sumi] [--explore]');
  process.exit(0);
}
const route = args.find(a => a.startsWith('--route='))?.slice(8) ?? 'nanami';
assert.ok(['nanami', 'sumi'].includes(route), 'Unsupported route');
try { process.loadEnvFile(path.join(repo, '.env.local')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const id = `first-snow-jp-demo-${route}-${randomUUID().slice(0, 8)}`;
const root = path.join(repo, 'worlds', id);
await fs.cp(path.join(repo, 'templates/first-snow-jp'), root, {
  recursive: true, filter: p => !['.airpworld', '.pi'].includes(path.basename(p)),
});
const manifestPath = path.join(root, 'world.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.id = id;
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const store = new LocalWorldStore(root);
const spec = writerLaunch(repo, root, path.join(repo, 'vendor/pi-rp/packages/coding-agent/dist/cli.js'));
const client = new RpcClient({ cliPath: spec.cliPath, cwd: spec.cwd, args: spec.args, env: spec.env });
const scene = `world/tonight/${route === 'nanami' ? 'radio-studio' : 'amber-cafe'}`;
const absent = `world/tonight/${route === 'nanami' ? 'amber-cafe' : 'radio-studio'}/absence.md`;
const character = route === 'nanami' ? 'nanami' : 'sumi-yukimura';
const memoryBefore = await fs.readFile(path.join(root, `characters/${character}/memory.md`), 'utf8');
const beforeEnding = await fs.readFile(path.join(root, 'world/tonight/first-snow/README.md'), 'utf8');
const results = { save: id, route, turns: [], completed: false, growth: null };
const successfulTools = [];
client.onEvent(event => {
  if (event.type === 'tool_execution_end') {
    if (!event.isError) successfulTools.push(event.toolName);
    console.log(JSON.stringify({ tool: event.toolName, ok: !event.isError }));
  }
});
const player = () => createActionService(store, { type: 'player' }, { turn: `rehearsal:${randomUUID()}` });
async function turn(layer, source, choice) {
  const event = await player().chooseOption({ path: source, choice });
  const started = Date.now();
  await client.prompt(`[Current Layer] ${layer}\n[Player Event] ${JSON.stringify(event.details.event)}\nRead ${JSON.stringify(source)} and the world skill. Resolve this choice, update the source file, and write a chalk response. Do not record the choice a second time.`);
  await client.waitForIdle(180000);
  results.turns.push({ layer, elapsedMs: Date.now() - started });
}
async function read(p) { return fs.readFile(path.join(root, p), 'utf8'); }
try {
  await client.start();
  await player().moveEntity({ from: 'world/request-sheet.md', to: 'player/request-sheet.md' });
  await player().enterLayer({ layer: 'world/tonight' });
  await player().enterLayer({ layer: scene });
  await turn(scene, `${scene}/README.md`, 1);
  const letter = parseFrontmatter(await read('player/tonight-letter.md'));
  assert.equal(letter.frontmatter.type, 'letter');
  assert.ok(letter.body.length > 20, 'Letter must contain an actual exchange');
  assert.notEqual(await read(`characters/${character}/memory.md`), memoryBefore);
  assert.ok((await read(absent)).length > 30, 'Absence must be materialised');
  assert.notEqual(await read('world/tonight/first-snow/README.md'), beforeEnding);
  results.completed = true;
  if (args.includes('--explore')) {
    const end = 'world/tonight/first-snow';
    await player().enterLayer({ layer: end });
    await turn(end, `${end}/01-before-snow.md`, 'もう少し歩いて、近くに雪宿りできる小さな場所を探す');
    const shelter = `${end}/snow-shelter`;
    for (const file of ['README.md', 'resident.md', 'found-object.md', 'arrival.md']) assert.ok((await read(`${shelter}/${file}`)).length > 20, file);
    const fm = parseFrontmatter(await read(`${shelter}/README.md`)).frontmatter;
    const generatedImage = typeof fm.bg === 'string' && fm.bg.startsWith('.airpworld/assets/gen/');
    if (generatedImage) await fs.access(path.join(root, fm.bg));
    results.growth = { textReady: true, generatedImage, imageCallsSucceeded: successfulTools.filter(t => t === 'generate_image').length };
  }
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.failure = 'Live rehearsal did not satisfy all file checks. Inspect this save before retrying.';
  console.error(results.failure);
  process.exitCode = 1;
} finally {
  await client.stop().catch(() => {});
  store.close();
  await fs.mkdir(path.join(root, '.airpworld'), { recursive: true });
  await fs.writeFile(path.join(root, '.airpworld', 'rehearsal.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`Save retained: ${root}`);
}
