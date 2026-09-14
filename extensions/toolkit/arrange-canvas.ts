import { Type } from 'typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ArrangeCanvasDetails } from '../../packages/shared/dist/index.js';
import {
  ActionError,
  createActionService,
  resolveFunctionalArrangerActor,
} from '../../packages/shared/dist/index.js';
import { worldStore } from './deps.js';
import { fail, ok } from './result.js';

const ARRANGER_ROLE = 'functional:canvas-arranger';
const ARRANGER_SCOPE = 'functional-canvas-arranger';
const ARRANGER_AGENT_ID = 'canvas-arranger';

/**
 * The sole model-facing write tool for the functional arranger.  It accepts
 * intent and version fences, never candidate coordinates; the shared action
 * owns full-layer planning and the atomic transaction.
 */
export const arrangeCanvasTool = defineTool({
  name: 'arrange_canvas',
  label: 'Arrange Canvas Safely',
  description:
    'Arrange the complete current layer using server-side collision safety. ' +
    'Provide intent and the exact snapshot/version from view_canvas; never provide coordinates.',
  parameters: Type.Object(
    {
      operationId: Type.String({ description: 'Server-issued operation identity.' }),
      layer: Type.String({ description: 'Exact current canvas layer.' }),
      mode: Type.Union([Type.Literal('grid'), Type.Literal('circle'), Type.Literal('row')]),
      expectedRevision: Type.Integer({ minimum: 0 }),
      expectedCanvasVersion: Type.Integer({ minimum: 0 }),
      snapshotId: Type.String({ description: 'Exact snapshot identity from view_canvas.' }),
      policy: Type.Literal('deoverlap'),
      allowMoveStableCards: Type.Literal(true),
      preserveLinks: Type.Literal(true),
    },
    { additionalProperties: false },
  ),
  promptSnippet: 'arrange_canvas — atomically de-overlap the complete layer (server chooses coordinates)',
  promptGuidelines: [
    'Call view_canvas(auto) first and pass its exact layer, snapshotId, and canvasVersion.',
    'Never invent x/y coordinates; the server owns geometry and collision checks.',
    'Use this at most once, except one retry after an uncommitted conflict and a fresh view_canvas(auto).',
  ],
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    if (signal.aborted) {
      throw new ActionError({ code: 'conflict', message: 'Canvas arrangement was cancelled before commit.' });
    }
    const role = process.env.AIRP_AGENT_ROLE;
    const scope = process.env.AIRP_AGENT_SCOPE;
    const operationId = process.env.AIRP_ARRANGER_OPERATION_ID;
    const turnId = process.env.AIRP_ARRANGER_TURN_ID;
    if (
      role !== ARRANGER_ROLE ||
      scope !== ARRANGER_SCOPE ||
      !operationId ||
      !turnId ||
      params.operationId !== operationId
    ) {
      throw new ActionError({ code: 'internal', message: 'Invalid functional arranger identity or scope.' });
    }
    let actor;
    try {
      actor = resolveFunctionalArrangerActor(role, scope);
    } catch {
      throw new ActionError({ code: 'internal', message: 'Invalid functional arranger identity or scope.' });
    }
    try {
      const service = createActionService(worldStore(ctx), actor.actor, {
        turn: turnId,
        agentScope: actor.agentScope,
      });
      const result = await service.arrangeCanvas({
        operationId,
        layer: params.layer,
        mode: params.mode,
        expectedRevision: params.expectedRevision,
        expectedCanvasVersion: params.expectedCanvasVersion,
        snapshotId: params.snapshotId,
        policy: params.policy,
        allowMoveStableCards: params.allowMoveStableCards,
        preserveLinks: params.preserveLinks,
      });
      return ok(result as { text: string; details: ArrangeCanvasDetails });
    } catch (err) {
      return fail(err);
    }
  },
});
