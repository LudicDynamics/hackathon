import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { parseFrontmatter } from '../../packages/shared/dist/index.js';
import { currentLayer, worldStore } from './deps.js';

/** One player action, not one model/tool iteration. Initialization has its own budget. */
export function registerWriterBeatGuard(pi: ExtensionAPI): void {
  let calls = 0, blocked = 0;
  let target: string | null = null;
  let landed = false;
  const edits = new Set<string>();
  const enabled = () => process.env.AIRP_AGENT_ROLE === 'writer' && process.env.AIRP_INIT_IN_FLIGHT !== '1';
  pi.on('agent_start', () => { calls = 0; blocked = 0; target = null; landed = false; edits.clear(); });
  pi.on('tool_call', async (event, ctx) => {
    if (!enabled()) return;
    const refuse = (reason: string, terminal = false) => {
      if (terminal || ++blocked >= 2) ctx.abort();
      return { block: true as const, reason };
    };
    if (++calls > 24) return refuse('This action reached its tool budget. Stop and wait for the player to continue.', true);
    const input = event.input as Record<string, unknown>;
    if (event.toolName === 'chalk') {
      if (landed) return refuse('One narration is already on the canvas. Edit it if needed, then stop. Do not create another Chalk.');
      const requested = input.append_to ?? input.path;
      if (typeof requested === 'string') {
        if (target && target !== requested) return refuse(`Reuse ${target}; do not rename a duplicate Chalk.`);
        target = requested;
        if (input.path && await worldStore(ctx).statKind(requested) !== 'missing') return refuse(`Read and edit ${target} in place, preserving its frontmatter. Do not create a renamed copy.`);
      }
      if (typeof input.content === 'string' && (input.content.length > 1000 || input.content.trim().split(/\n\s*\n/).length > 1)) return refuse('Write one concise final paragraph under 1000 characters, not a dialogue transcript.');
      if (!input.append_to && typeof input.content === 'string' && ctx.cwd) {
        const layer = currentLayer(ctx);
        const directory = typeof requested === 'string' ? path.posix.dirname(requested) : layer === 'map' ? 'world' : layer;
        if (directory) {
          const normalized = input.content.replace(/\s+/g, ' ').trim();
          for (const file of await worldStore(ctx).listFiles(directory)) {
            if (path.posix.dirname(file) !== directory || !file.endsWith('.md')) continue;
            const parsed = parseFrontmatter(await worldStore(ctx).readFile(file));
            if (parsed.frontmatter?.type === 'chalk' && parsed.body.replace(/\s+/g, ' ').trim() === normalized) {
              target = file;
              return refuse(`This narration already exists at ${file}. Reuse it; do not create another copy.`);
            }
          }
        }
      }
    }
    if (event.toolName === 'write' || event.toolName === 'edit') {
      if (typeof input.path !== 'string') return;
      const file = path.relative(ctx.cwd, path.resolve(ctx.cwd, input.path)).split(path.sep).join('/');
      if (!file.endsWith('.md')) return;
      let isChalk = event.toolName === 'write' && typeof input.content === 'string' && parseFrontmatter(input.content).frontmatter?.type === 'chalk';
      try { isChalk ||= parseFrontmatter(await worldStore(ctx).readFile(file)).frontmatter?.type === 'chalk'; } catch { /* New files use the payload check. */ }
      if (!isChalk) return;
      if (event.toolName === 'write') return refuse('Use chalk for new narration, or edit existing narration. Do not create Chalk with raw write.');
      if (target && target !== file) return refuse(`This action uses ${target}; do not write another narrative file.`);
      target = file; edits.add(event.toolCallId);
    }
  });
  pi.on('tool_result', event => {
    if (!enabled()) return;
    const edited = edits.delete(event.toolCallId);
    if (event.isError) return;
    if (event.toolName === 'chalk') {
      const details = event.details as { path?: string } | undefined;
      if (typeof details?.path === 'string') { target = details.path; landed = true; }
    } else if (edited) landed = true;
  });
}
