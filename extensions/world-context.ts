import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { assertNookMutationAllowed, parseFrontmatter, type Actor, type AgentScope } from '../packages/shared/dist/index.js';
import { agentActor, worldStore } from './toolkit/deps.js';
import { currentTurnAnchor } from './toolkit/turn.js';

type TrackedWrite = { file: string; existed: boolean };

function scopeFromEnvironment(actor: Actor): AgentScope {
  const raw = process.env.AIRP_AGENT_SCOPE;
  if (raw === 'character' || raw === 'initializer' || raw === 'player' || raw === 'engine') return raw;
  if (raw === 'writer-top-level') return raw;
  return actor.type === 'character' ? 'character' : actor.type === 'player' ? 'player' : 'writer-top-level';
}

function inputText(input: Record<string, unknown>): string | undefined {
  if (typeof input.content === 'string') return input.content;
  if (typeof input.newText === 'string') return input.newText;
  if (typeof input.text === 'string') return input.text;
  return undefined;
}

function mergedEditText(previous: string, input: Record<string, unknown>): string | undefined {
  const direct = inputText(input);
  if (direct !== undefined) return direct;
  if (typeof input.oldText === 'string' && typeof input.newText === 'string') {
    return previous.replace(input.oldText, input.newText);
  }
  if (Array.isArray(input.edits)) {
    let result = previous;
    for (const edit of input.edits) {
      if (!edit || typeof edit !== 'object') return undefined;
      const item = edit as Record<string, unknown>;
      if (typeof item.oldText !== 'string' || typeof item.newText !== 'string') return undefined;
      result = result.replace(item.oldText, item.newText);
    }
    return result;
  }
  return undefined;
}

function isPhotoContent(raw: string): boolean {
  const { frontmatter } = parseFrontmatter(raw);
  return frontmatter?.component === 'photo';
}

/** Native file tools need their own receipt; AIRP tools already append theirs. */
export default function registerWorldContext(pi: ExtensionAPI): void {
  const writes = new Map<string, TrackedWrite>();
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'write' && event.toolName !== 'edit') return;
    if (typeof event.input.path !== 'string') return;
    const file = path.relative(ctx.cwd, path.resolve(ctx.cwd, event.input.path)).split(path.sep).join('/');
    if (!(file.startsWith('world/') || file.startsWith('player/') || file.startsWith('characters/')) || !file.endsWith('.md')) {
      return { block: true, reason: 'Write scene, prop, or character Markdown under world/, player/, or characters/.' };
    }
    const store = worldStore(ctx);
    const actor = agentActor();
    const agentScope = scopeFromEnvironment(actor);
    const registered = (await store.getManifest()).characters.map((character) => character.id);
    try {
      assertNookMutationAllowed(actor, agentScope, file, event.toolName === 'write' ? 'write' : 'edit', registered);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { block: true, reason };
    }
    const existed = await store.statKind(file) !== 'missing';
    const previous = existed ? await store.readFile(file) : '';
    const proposed = event.toolName === 'write'
      ? inputText(event.input as Record<string, unknown>)
      : mergedEditText(previous, event.input as Record<string, unknown>);
    if (
      (proposed !== undefined && isPhotoContent(proposed)) ||
      (event.toolName === 'edit' && proposed === undefined && isPhotoContent(previous))
    ) {
      return { block: true, reason: 'invalid_argument: native write/edit cannot create or edit component: photo; use a supported photo action.' };
    }
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
