import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseFrontmatter } from '../packages/shared/dist/index.js';
import { agentActor, worldStore } from './toolkit/deps.js';
import { currentTurnAnchor } from './toolkit/turn.js';

/** Native file tools need their own receipt; AIRP tools already append theirs. */
export default function registerWorldContext(pi: ExtensionAPI): void {
  const writes = new Map<string, { file: string; existed: boolean }>();
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'write' && event.toolName !== 'edit') return;
    if (typeof event.input.path !== 'string') return;
    const file = path.relative(ctx.cwd, path.resolve(ctx.cwd, event.input.path)).split(path.sep).join('/');
    if (!(file.startsWith('world/') || file.startsWith('player/') || file.startsWith('characters/')) || !file.endsWith('.md')) {
      return { block: true, reason: 'Write scene, prop, or character Markdown under world/, player/, or characters/.' };
    }
    const existed = await worldStore(ctx).statKind(file) !== 'missing';
    writes.set(event.toolCallId, { file, existed });
  });
  pi.on('tool_result', async (event, ctx) => {
    const tracked = writes.get(event.toolCallId);
    writes.delete(event.toolCallId);
    if (!tracked || event.isError) return;
    const store = worldStore(ctx);
    const { frontmatter: fm } = parseFrontmatter(await store.readFile(tracked.file));
    const name = String(fm?.title ?? fm?.name ?? path.basename(tracked.file, '.md'));
    const layer = await store.resolveLayer(tracked.file);
    const actor = agentActor();
    const turn = currentTurnAnchor(ctx);
    if (!tracked.existed && tracked.file.endsWith('/README.md')) {
      // During `airp-init` the command owns `layer_initialized` and records it
      // from the on-disk outcome (docs/init/02 §6); the subagent's native write
      // must not also land one, or the layer gets two rows (docs/tools/00 §6
      // requires the two entry points be mutually exclusive). The flag is set
      // across the spawn by init-command.ts; jiti gives each extension its own
      // module instance, so `process.env` is the only channel between files.
      if (process.env.AIRP_INIT_IN_FLIGHT === '1') return;
      await store.appendEvent({ type: 'layer_initialized', actor, turn, layer: layer ?? undefined,
        subject: layer ?? tracked.file, detail: { layer: layer ?? tracked.file.replace('/README.md', ''), name, by: 'writer', files: [tracked.file] } });
      return;
    }
    const kind = fm?.type === 'chalk' ? 'chalk' : fm?.type === 'letter' ? 'letter' : fm?.type === 'note' ? 'note' : 'other';
    await store.appendEvent({ type: tracked.existed ? 'entity_edited' : 'entity_created', actor, turn,
      layer: layer ?? undefined, subject: tracked.file, detail: { path: tracked.file, name, kind } });
  });
}
