import fs from 'node:fs';
import path from 'node:path';
import { airpEnv, extensionArgs, installPreset, skillArgs } from './presets.js';
import { CHARACTER_ROLE_PREFIX } from '@airp/shared';

/**
 * Spawn parameters for a pi-rp agent process — the **single source** of truth.
 *
 * Both the server (`lifecycle.ts`) and the gate probe (`tools/probe-writer.mjs`)
 * build their spawn args here, so a session-dir change or a new flag can never
 * drift between the two again (before this module there were three hand-rolled
 * copies, one of which even carried an extra `--offline`).
 */
export interface LaunchSpec {
  cliPath: string;
  /** Working directory for the spawned process — always the world root. */
  cwd: string;
  args: string[];
  /** RpcClient expects `Record<string,string>`, not `NodeJS.ProcessEnv`. */
  env: Record<string, string>;
}

/** Drops `undefined` values — `airpEnv` returns a `ProcessEnv` whose keys may be unset. */
function toEnv(...records: NodeJS.ProcessEnv[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

/** Session storage for a world: `<worldRoot>/.airpworld/sessions/` (T0.3 — memory travels with the world zip). */
export function sessionsDirOf(worldRoot: string): string {
  const dir = path.join(worldRoot, '.airpworld', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resource discovery kill-switches (pi-rp `--no-*` flags).
 *
 * A spawned agent MUST see exactly what AIRP hands it, and nothing the developer machine
 * happens to have installed globally. Without these, pi-rp's discovery walks surfaces we do
 * not control. Measured on this machine (`get_commands` from a real writer spawn):
 *
 *  - `--no-skills`: kills `<home>/.agents/skills/` — **37 skills** leaked into the command
 *    table (`skill:tdd`, `skill:character-sim`, `skill:llm-writing`, …). Also covers
 *    `<cwd>/.airpworld/skills/`, which a world package could otherwise plant. Note
 *    `<home>/.pi/agent/skills/` does NOT leak: `PI_CODING_AGENT_DIR` is pinned to the repo's
 *    `.pi/agent` (see `agentDirEnv`), so the user's own agent dir is never read.
 *  - `--no-extensions`: `<cwd>/.airpworld/extensions/*.ts` — a world package's own extensions
 *    would otherwise be discovered and executed (project trust is granted by `--approve`).
 *  - `--no-context-files`: `<agentDir>/AGENTS.md` plus every `AGENTS.md`/`CLAUDE.md` up the
 *    ancestor chain from the world root. A world living under `<repo>/templates/<x>/` or
 *    `<repo>/worlds/<x>/` therefore picks up the repo's own `AGENTS.md` — 18KB of Chinese
 *    developer handbook — straight into the agent's system prompt.
 *  - `--no-prompt-templates` / `--no-themes`: same discovery shape, no AIRP use.
 *
 * Explicit `--extension` / `--skill` flags still load under `--no-*` (verified: `noSkills` +
 * `additionalSkillPaths` keeps the explicit paths and drops the discovered set — see
 * `resource-loader.ts`, `noExtensions ? cliEnabledExtensions : merge(cli, enabled)`), and
 * pi-rp's own hidden inline extensions (llama.cpp / memories / opening, `builtInExtensions`)
 * are unaffected — they are built-in factories, not discovery. So this isolates discovery
 * without touching AIRP's own tool face or the active preset.
 */
const ISOLATION_ARGS = [
  '--no-extensions',
  '--no-skills',
  '--no-context-files',
  '--no-prompt-templates',
  '--no-themes',
] as const;

/**
 * Pins pi-rp's agent config dir to the repo's `.pi/agent/`.
 *
 * Without it `getAgentDir()` falls back to `~/.pi/agent/`, where whoever runs this
 * machine picked their own providers — the repo would then behave differently per
 * developer. Same mechanism worldlines-rivet uses (`PI_CODING_AGENT_DIR`), just pointing
 * at a repo-local dir so `.pi/agent/models.json` is the one config that matters.
 */
function agentDirEnv(repoRoot: string): Record<string, string> {
  return { PI_CODING_AGENT_DIR: path.join(repoRoot, '.pi', 'agent') };
}

export function hasExistingSession(worldRoot: string): boolean {
  try {
    return fs.readdirSync(sessionsDirOf(worldRoot)).some((f) => f.endsWith('.jsonl'));
  } catch {
    return false;
  }
}

/**
 * Writer ("director") launch spec.
 *
 * Session handling: `--session-dir` pins storage to the world; a world that already
 * has a `.jsonl` resumes it with `--continue` (pi-rp `SessionManager.continueRecent`).
 *
 * No opening seeding: the player-facing opening is a `type: chalk` file already
 * shipped in the layer directory, and chat history never reaches the canvas (doc-05 §7.4).
 */
export function writerLaunch(repoRoot: string, worldRoot: string, vendorCliPath: string): LaunchSpec {
  const presetId = installPreset(worldRoot, path.join(repoRoot, 'presets', 'writer.json'));
  // The two initializer profiles must exist in the WORLD's `.airpworld/prompt-presets/`
  // so the writer process's `subagent_profiles` sees them (R1 delegation) and the
  // `airp-init` command can spawn them (R2). Installed per launch — installPreset
  // overwrites, so a stale world-side copy never wins (docs/init/00 §5).
  installPreset(worldRoot, path.join(repoRoot, 'presets', 'scene-init.json'));
  installPreset(worldRoot, path.join(repoRoot, 'presets', 'nook-init.json'));
  const sessionsDir = sessionsDirOf(worldRoot);

  const args = [
    '--approve',
    '--preset',
    presetId,
    '--session-dir',
    sessionsDir,
    ...ISOLATION_ARGS,
    ...extensionArgs(repoRoot, worldRoot),
    ...skillArgs(repoRoot, worldRoot),
  ];
  if (hasExistingSession(worldRoot)) args.push('--continue');

  return {
    cliPath: vendorCliPath,
    cwd: worldRoot,
    args,
    env: toEnv(airpEnv({ role: 'writer' }), agentDirEnv(repoRoot), {
      PI_CODING_AGENT_SESSION_DIR: sessionsDir,
    }),
  };
}

/**
 * Character launch spec — one session file per character (`char-<id>.jsonl`), so a
 * character overlay's memory survives shutdown and rides along with the world.
 *
 * A character's own `characters/<id>/preset.json` wins over the repo's generic
 * character preset (same choice `lifecycle` made before). Characters get the
 * same two skill tiers as the writer (`skillArgs`): the platform tier teaches
 * how to act with the tools they have, the world tier teaches this world's voice.
 * The `skills` slot in the preset is what puts those descriptions into the
 * prompt — without it the `--skill` flags load nothing the model can see.
 */
export function characterLaunch(
  repoRoot: string,
  worldRoot: string,
  vendorCliPath: string,
  characterId: string
): LaunchSpec {
  const characterPreset = path.join(worldRoot, 'characters', characterId, 'preset.json');
  const presetId = installPreset(
    worldRoot,
    fs.existsSync(characterPreset) ? characterPreset : path.join(repoRoot, 'presets', 'character.json')
  );
  const sessionsDir = sessionsDirOf(worldRoot);

  return {
    cliPath: vendorCliPath,
    cwd: worldRoot,
    args: [
      '--approve',
      '--preset',
      presetId,
      '--session-dir',
      sessionsDir,
      '--session',
      path.join(sessionsDir, `char-${characterId}.jsonl`),
      ...ISOLATION_ARGS,
      ...extensionArgs(repoRoot, worldRoot),
      ...skillArgs(repoRoot, worldRoot),
    ],
    env: toEnv(airpEnv({ role: `${CHARACTER_ROLE_PREFIX}${characterId}` }), agentDirEnv(repoRoot), {
      PI_CODING_AGENT_SESSION_DIR: sessionsDir,
    }),
  };
}
