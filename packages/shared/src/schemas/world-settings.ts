import { z } from 'zod';

/**
 * Per-world player preferences for automatic writer turns (docs/settings/00).
 *
 * Three states, because the two automatic turns are different kinds of work:
 *   - `scenes`: walking into an unwritten gate materialises the scene. That is
 *     the I1 initialiser's job (scene-init preset, structured brief, W2
 *     fallback), NOT a writer turn — the engine owns it.
 *   - `scenes-and-choices`: additionally, resolving a choice advances the
 *     story with a writer turn.
 *
 * The frozen contract (docs/protocols/doc-21 §5.5) is that an event landing in
 * the table never starts an agent turn BY ITSELF; whether one follows is this
 * setting's call. The default is `scenes-and-choices` (niko, 2026-09-15 — a
 * player picking a choice expects the story to move without pressing Send);
 * `off` remains the quiet mode where the writer only sees events in the hook
 * injection of the player's next input.
 */
export const AutoWriteSchema = z.enum(['off', 'scenes', 'scenes-and-choices']);
export type AutoWrite = z.infer<typeof AutoWriteSchema>;

export const WorldSettingsSchema = z.object({
  autoWrite: AutoWriteSchema,
}).strict();
export type WorldSettings = z.infer<typeof WorldSettingsSchema>;

export const DEFAULT_WORLD_SETTINGS: WorldSettings = { autoWrite: 'scenes-and-choices' };

/** True when walking into an unwritten scene should start the I1 initialiser. */
export function startsSceneInit(autoWrite: AutoWrite): boolean {
  return autoWrite === 'scenes' || autoWrite === 'scenes-and-choices';
}

/** True when resolving a choice should start a writer turn. */
export function startsChoiceTurn(autoWrite: AutoWrite): boolean {
  return autoWrite === 'scenes-and-choices';
}
