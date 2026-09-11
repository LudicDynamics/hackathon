import fs from 'node:fs';
import path from 'node:path';

/**
 * AIRP's project config directory name (a system directory inside the world; see doc-05 §7.4).
 *
 * It is also pi-rp's `PI_PROJECT_CONFIG_DIR`: only when it is set to this value
 * will pi-rp look under `<worldRoot>/.airpworld/{prompt-presets,openings}/`.
 */
export const AIRP_CONFIG_DIR = '.airpworld';

/** Checks whether a preset file is a valid pi-rp preset (the top level must have `items`). */
export function readPresetId(file: string): string | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { id?: unknown };
    return typeof parsed?.id === 'string' && parsed.id ? parsed.id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Installs a preset into the world's `<worldRoot>/.airpworld/prompt-presets/` and returns its id.
 *
 * Why we must "install" it rather than hand the file path straight to the engine:
 *  - pi-rp's `--preset` accepts only the preset's **id**; passing an absolute path yields
 *    `Warning: Prompt preset "…" not found` and silently falls back to the default preset;
 *  - preset discovery scans only the **top level** `*.json` of `<configDir>/prompt-presets/`
 *    and does not recurse into subdirectories, so `characters/<name>/preset.json` inside a
 *    character directory can never be discovered on its own.
 */
export function installPreset(worldRoot: string, srcFile: string): string {
  const id = readPresetId(srcFile);
  if (!id) throw new Error(`preset "${srcFile}" is not a valid pi-rp preset (missing top-level id)`);
  const dir = path.join(worldRoot, AIRP_CONFIG_DIR, 'prompt-presets');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(srcFile, path.join(dir, `${id}.json`));
  return id;
}

/**
 * Builds the environment variables needed to spawn the pi-rp process.
 *
 * `PI_PROJECT_CONFIG_DIR` is the master switch: when set, prompt-presets and openings land
 * under the world's `.airpworld/`. `PI_OPENING` takes the **id of the opening preset** (not a
 * file path); it is set only when `<worldRoot>/.airpworld/openings/<id>.json` actually exists,
 * and left empty otherwise so the opening extension skips at zero cost.
 */
export function airpEnv(worldRoot: string, openingId?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PI_PROJECT_CONFIG_DIR: AIRP_CONFIG_DIR };
  if (openingId) {
    const openingFile = path.join(worldRoot, AIRP_CONFIG_DIR, 'openings', `${openingId}.json`);
    if (fs.existsSync(openingFile)) env.PI_OPENING = openingId;
  }
  return env;
}

/**
 * Skill directories handed to pi-rp via `--skill` (accepts a file or a directory, repeatable;
 * see `vendor/pi-rp/packages/coding-agent/src/cli/args.ts`).
 *
 * Two tiers, loaded together:
 *  - project level `<repoRoot>/skills/` — craft that applies to every world: how to generate
 *    images, how to narrate with components, how to pace a reveal, how to mesh narrative
 *    with gameplay;
 *  - world level `<worldRoot>/skills/` — this world's own voice and plot, shipped inside the
 *    world package, sitting next to `world/`.
 *
 * We pass paths explicitly rather than relying on pi-rp's `.pi/skills` discovery because a
 * scaffolded world can live outside this repo, where ancestor discovery would never reach
 * the project-level tier.
 *
 * Only directories that exist are passed, so a world without `skills/` costs nothing.
 * Subagents delegated from the writer (scene-init / nook-init) run in the same process and
 * inherit these skills; their preset only needs the `skills` slot to see them listed.
 */
export function skillArgs(repoRoot: string, worldRoot: string): string[] {
  const args: string[] = [];
  for (const dir of [path.join(repoRoot, 'skills'), path.join(worldRoot, 'skills')]) {
    if (fs.existsSync(dir)) args.push('--skill', dir);
  }
  return args;
}
