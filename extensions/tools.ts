/**
 * AIRP tool registration — the ONE registerTool entry point.
 *
 * `extensionArgs` (apps/server/src/engine/presets.ts) only scans TOP-LEVEL
 * `.ts`/`.js` files under `extensions/`, so everything in `toolkit/` is a plain
 * module (never loaded as an extension) — that is exactly why the implementations
 * live in the subdirectory (docs/tools/00 §6.1).
 *
 * This file contains NO business logic: it imports each tool's `ToolDefinition`
 * and registers it. Tool semantics live in `packages/shared/src/actions/*`
 * (caller-independent) and their thin shells in `toolkit/*` (docs/tools/01 §2.1).
 *
 * Extensions run TS directly via jiti — no build step. Shared code is imported
 * by RELATIVE path (`../packages/shared/dist/index.js`); the package name
 * `@airp/shared` does NOT resolve here, because `extensions/` is outside the
 * pnpm workspace (docs/tools/00 §6.1).
 */
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

// ——— tool shells (each exports a `ToolDefinition` constant) ———
import { chalkTool } from './toolkit/chalk.js';                    // doc-tools/02
import { lookAtTool, viewCanvasTool } from './toolkit/look-at.js'; // doc-tools/03
import { moveTool } from './toolkit/move.js';                      // doc-tools/04
import { deleteTool } from './toolkit/delete.js';                  // doc-tools/04
import { moveToTool } from './toolkit/move-to.js';                 // doc-tools/05
import { setFollowingTool } from './toolkit/following.js';         // doc-tools/05
import { chooseTool } from './toolkit/choose.js';                  // doc-tools/06
import { rollDiceTool } from './toolkit/roll-dice.js';             // doc-tools/07
import { useItemOnTool } from './toolkit/use-item.js';             // doc-tools/08
import { linkTool } from './toolkit/link.js';                      // doc-tools/09
import { arrangeTool } from './toolkit/arrange.js';                // doc-tools/09
import { getComponentTool } from './toolkit/component.js';         // doc-tools/10
import { showTool } from './toolkit/show.js';                      // doc-tools/10
import { generateImageTool } from './toolkit/generate-image.js';   // doc-tools/11
import { registerTurnTracking } from './toolkit/turn.js';          // doc-tools/12
import { registerWriterBeatGuard } from './toolkit/writer-beat-guard.js';
import { registerInitCommand } from './toolkit/init-command.js';   // docs/init/00

/**
 * The complete AIRP tool face, in registration order.
 *
 * Exported so the probe can ASSERT the face is non-empty (a `ToolDefinition`
 * export that is not a function makes jiti silently skip the file — see
 * vendor/pi-rp/packages/coding-agent/src/core/extensions/loader.ts:511-515 —
 * and `pnpm probe`'s warning check cannot see that).
 *
 * Names MUST match docs/protocols/doc-20 §1 / docs/tools/00 §6.3 verbatim; a synonym
 * (`write_world_file` for `write`) is forbidden.
 */
export const AIRP_TOOLS: ReadonlyArray<{ name: string; tool: ToolDefinition }> = [
  { name: 'look_at', tool: lookAtTool },
  { name: 'view_canvas', tool: viewCanvasTool },
  { name: 'chalk', tool: chalkTool },
  { name: 'move_to', tool: moveToTool },
  { name: 'move', tool: moveTool },
  { name: 'choose', tool: chooseTool },
  { name: 'roll_dice', tool: rollDiceTool },
  { name: 'use_item_on', tool: useItemOnTool },
  { name: 'set_following', tool: setFollowingTool },
  { name: 'link', tool: linkTool },
  { name: 'arrange', tool: arrangeTool },
  { name: 'delete', tool: deleteTool },
  { name: 'get_component', tool: getComponentTool },
  { name: 'show', tool: showTool },
  { name: 'generate_image', tool: generateImageTool },
];

/** The names alone, in registration order — what the model sees and what `tools.allow` filters on. */
export const AIRP_TOOL_NAMES: readonly string[] = AIRP_TOOLS.map((entry) => entry.name);
export default function registerAirpTools(pi: ExtensionAPI): void {
  // Turn anchor for the A entry (docs/tools/01 §3.7). Registered BEFORE the tools
  // so the very first tool call of the first turn already has an anchor.
  registerTurnTracking(pi);

  // Initialization execution kernel (docs/init/00 §2.2). Registered here — the
  // same `initialize` as the tools — so presets and command share one entry point.
  registerInitCommand(pi);
  registerWriterBeatGuard(pi);


  for (const { name, tool } of AIRP_TOOLS) {
    // Guard against a copy/paste slip between AIRP_TOOLS and the definition:
    // pi-rp keys its registry by `definition.name`, so a mismatch would make
    // `AIRP_TOOLS` lie to the probe.
    if (tool.name !== name) {
      throw new Error(`tools.ts: AIRP_TOOLS entry "${name}" carries a definition named "${tool.name}"`);
    }
    pi.registerTool(tool);
  }
}
