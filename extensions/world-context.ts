import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseFrontmatter } from '../packages/shared/dist/index.js';
import { agentActor, worldStore } from './toolkit/deps.js';
import { currentTurnAnchor } from './toolkit/turn.js';

/** Native file tools need their own receipt; AIRP tools already append theirs. */
export default function registerWorldContext(pi: ExtensionAPI): void {
  const writes = new Map<string, { file: string; existed: boolean }>();
  pi.on('before_agent_start', async (_event, ctx) => {
    const store = worldStore(ctx);
    const manifest = await store.getManifest();
    const events = await store.getEventsSince(Math.max(0, (await store.getMaxSeq()) - 12));
    return {
      message: {
        customType: 'airp-world-context',
        display: false,
        content: `[World] ${manifest.name}\n[Genre] ${manifest.genre}\n[Recent Events]\n${JSON.stringify(events)}\nRead world.json and the relevant world skill before acting. Read the actual scene and prop Markdown files before editing them. Only chalk files are shown as narration; assistant chat does not appear on the canvas.`,
      },
    };
  });
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
      await store.appendEvent({ type: 'layer_initialized', actor, turn, layer: layer ?? undefined,
        subject: layer ?? tracked.file, detail: { layer: layer ?? tracked.file.replace('/README.md', ''), name, by: 'writer', files: [tracked.file] } });
      return;
    }
    const kind = fm?.type === 'chalk' ? 'chalk' : fm?.type === 'letter' ? 'letter' : fm?.type === 'note' ? 'note' : 'other';
    await store.appendEvent({ type: tracked.existed ? 'entity_edited' : 'entity_created', actor, turn,
      layer: layer ?? undefined, subject: tracked.file, detail: { path: tracked.file, name, kind } });
  });
}
