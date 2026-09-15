import { getInputProps } from "remotion";

/**
 * The project's name under the Worldlines wordmark — "Worldlines: LivingCanvas" (default) or another candidate,
 * e.g. --props='{"project":"CharaCanvas"}'. Captions write it as {PROJECT}; make-narration.mjs voices it with
 * PROJECT=<name>.
 */
export const PROJECT = (getInputProps() as { project?: string }).project ?? "LivingCanvas";
export const withProject = (text: string) => text.split("{PROJECT}").join(PROJECT);
