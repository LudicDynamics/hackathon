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
  const sessionsDir = sessionsDirOf(worldRoot);

  const args = [
    '--approve',
    '--preset',
    presetId,
    '--session-dir',
    sessionsDir,
    ...extensionArgs(repoRoot, worldRoot),
    ...skillArgs(repoRoot, worldRoot),
    ...(process.env.AIRP_WRITER_MODEL ? ['--model', process.env.AIRP_WRITER_MODEL] : []),
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
 * character preset (same choice `lifecycle` made before). Characters get no
 * `--skill`: unlike the writer they carry no craft skills.
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
      ...extensionArgs(repoRoot, worldRoot),
    ],
    env: toEnv(airpEnv({ role: `${CHARACTER_ROLE_PREFIX}${characterId}` }), agentDirEnv(repoRoot), {
      PI_CODING_AGENT_SESSION_DIR: sessionsDir,
    }),
  };
}
