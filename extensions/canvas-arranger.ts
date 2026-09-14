/**
 * The isolated extension for the functional canvas-arranger process.
 *
 * This file is deliberately not `extensions/tools.ts`: the launch spec disables
 * extension discovery and passes this entry explicitly, so a world extension or
 * a Writer-only tool can never enter the arranger's process.
 */
import type { ExtensionAPI, ToolDefinition, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { ActionError, createActionService, resolveFunctionalArrangerActor } from '../packages/shared/dist/index.js';
import type { ViewCanvasDetails } from '../packages/shared/dist/index.js';
import { worldStore } from './toolkit/deps.js';
import { ok, fail } from './toolkit/result.js';
import { viewCanvasTool } from './toolkit/look-at.js';
import { screenshotCanvasTool } from './toolkit/screenshot-canvas.js';
import { arrangeCanvasTool } from './toolkit/arrange-canvas.js';
import { CANVAS_ARRANGER_INSTRUCTION } from './instructions.js';

const ARRANGER_ROLE = 'functional:canvas-arranger';
const ARRANGER_SCOPE = 'functional-canvas-arranger';

function functionalViewCanvasTool(): ToolDefinition {
  return {
    ...viewCanvasTool,
    async execute(_toolCallId, params, signal, _onUpdate, ctx: ExtensionContext) {
      if (signal?.aborted) throw new ActionError({ code: 'internal', message: 'Canvas view was cancelled.' });
      const role = process.env.AIRP_AGENT_ROLE;
      const scope = process.env.AIRP_AGENT_SCOPE;
      const turnId = process.env.AIRP_ARRANGER_TURN_ID;
      if (role !== ARRANGER_ROLE || scope !== ARRANGER_SCOPE || !turnId) {
        throw new ActionError({ code: 'internal', message: 'Invalid functional arranger identity or scope.' });
      }
      try {
        const actor = resolveFunctionalArrangerActor(role, scope);
        const result = await createActionService(worldStore(ctx), actor.actor, { turn: turnId, agentScope: actor.agentScope }).viewCanvas(params);
        return ok(result as { text: string; details: ViewCanvasDetails });
      } catch (error) {
        return fail(error);
      }
    },
  };
}

const functionalViewTool = functionalViewCanvasTool();
export const CANVAS_ARRANGER_TOOLS: ReadonlyArray<{ name: string; tool: ToolDefinition }> = [
  { name: 'view_canvas', tool: functionalViewTool },
  { name: 'screenshot_canvas', tool: screenshotCanvasTool },
  { name: 'arrange_canvas', tool: arrangeCanvasTool },
];

export const CANVAS_ARRANGER_TOOL_NAMES = CANVAS_ARRANGER_TOOLS.map(({ name }) => name);

export default function registerCanvasArranger(pi: ExtensionAPI): void {
  pi.registerSlot({
    name: 'canvas-arranger-instruction',
    description: 'AIRP functional canvas-arranger safety and verification procedure',
    render: () => CANVAS_ARRANGER_INSTRUCTION,
  });
  for (const { name, tool } of CANVAS_ARRANGER_TOOLS) {
    if (tool.name !== name) throw new Error(`canvas-arranger: tool name mismatch for ${name}`);
    pi.registerTool(tool);
  }
}
