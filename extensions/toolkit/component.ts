import { Type } from 'typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { GetComponentDetails } from '../../packages/shared/dist/index.js';
import { getActionService } from './deps.js';
import { fail, ok } from './result.js';

/**
 * `get_component` — the read-only facade of the component registry
 * (doc-tools/10 §2.1, §8.4).
 *
 * It answers "which component kinds exist and what frontmatter does each one
 * take", so the model never has to carry every schema in its context. The
 * action lives in `packages/shared/src/actions/component.ts` and touches
 * nothing: no file, no canvas row, no event.
 */
export const getComponentTool = defineTool({
  name: 'get_component',
  label: 'Get Component',
  description:
    'Look up a canvas component kind: its purpose, its frontmatter fields, and a minimal example. ' +
    'Omitting component lists every registered kind in one line each. Read-only; it writes nothing.',
  parameters: Type.Object(
    {
      component: Type.Optional(
        Type.Union([Type.String(), Type.Array(Type.String())], {
          description:
            'Component kind id(s), e.g. "lock" or ["letter","board"]. Omit to list the whole registry as a one-line-per-kind index.',
        })
      ),
    },
    { additionalProperties: false }
  ),
  promptSnippet:
    "get_component(component?) — look up a component kind's frontmatter contract before writing one",
  promptGuidelines: [
    'Use get_component before writing or editing any file with frontmatter "type: component" — it returns the exact fields for that kind.',
    'Use show for one-off performances (spotlight, lights_out, fireworks). show writes nothing; to place a letter or a lock on the canvas, use chalk or write instead.',
  ],
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    try {
      const result = await getActionService(ctx).getComponent({ component: params.component });
      return ok(result as { text: string; details: GetComponentDetails });
    } catch (err) {
      return fail(err);
    }
  },
});
