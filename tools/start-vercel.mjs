import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep generated worlds and provider configuration off the deployment image.
// Every new instance starts empty; selecting a template uses the normal copy flow.
const sourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimeRoot = await mkdtemp(path.join(tmpdir(), 'airp-vercel-'));
for (const name of ['apps', 'packages', 'vendor', 'node_modules', 'assets', 'templates', 'extensions', 'presets', 'skills', 'config']) {
  await symlink(path.join(sourceRoot, name), path.join(runtimeRoot, name), 'dir');
}
await mkdir(path.join(runtimeRoot, 'worlds'));
await mkdir(path.join(runtimeRoot, '.pi', 'agent'), { recursive: true });
process.env.AIRP_REPO_ROOT = runtimeRoot;
// Do not open or mutate a bundled template on a cold start.
process.env.AIRP_WORLD = 'worlds/select-a-world';
await import('../apps/server/dist/index.js');
