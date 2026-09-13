import fs from 'node:fs';
import path from 'node:path';
import { AgentModelSelectionSchema } from '@airp/shared';

export type ModelPreference = { provider: string; model: string; thinking: 'off' | 'low' | 'medium' | 'high' };
export type ModelPreferences = Partial<Record<'writer' | 'character', ModelPreference>>;

/**
 * Validate a single stored preference before it reaches the CLI argv.
 *
 * Why: `readModelPreferences` feeds `--provider/--model/--thinking` straight
 * into the spawned pi-rp process. An illegal `--model` makes pi-rp's
 * `findInitialModel` call `process.exit(1)`, which burns the lifecycle's crash
 * backoff loop and can wedge the world. This file is user-editable, so treat it
 * as untrusted: parse with the strict (`.strict()`) `AgentModelSelectionSchema`
 * and drop anything malformed (fail-soft) rather than passing it through.
 *
 * `.partial()` is used because the on-disk entry carries only the three
 * selection fields — the schema's `role`/`world` are context for the UI, not
 * part of the file. All three fields must still be present so we never emit a
 * `--provider undefined`.
 */
function parsePreference(value: unknown): ModelPreference | undefined {
  const parsed = AgentModelSelectionSchema.partial().safeParse(value);
  if (!parsed.success) return undefined;
  const { provider, model, thinking } = parsed.data;
  if (!provider || !model || !thinking) return undefined;
  return { provider, model, thinking };
}

export function readModelPreferences(worldRoot: string): ModelPreferences {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(worldRoot, '.airpworld/model-preferences.json'), 'utf8')
    );
    if (typeof raw !== 'object' || raw === null) return {};
    const source = raw as Record<string, unknown>;
    const result: ModelPreferences = {};
    for (const role of ['writer', 'character'] as const) {
      const preference = parsePreference(source[role]);
      if (preference) result[role] = preference;
    }
    return result;
  } catch {
    return {};
  }
}
export function modelPreferenceArgs(worldRoot: string, role: 'writer' | 'character'): string[] {
  const preference = readModelPreferences(worldRoot)[role];
  return preference ? ['--provider', preference.provider, '--model', preference.model, '--thinking', preference.thinking] : [];
}
export function writeModelPreferences(worldRoot: string, preferences: ModelPreferences): void {
  const dir = path.join(worldRoot, '.airpworld');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'model-preferences.json');
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(preferences, null, 2) + '\n');
  fs.renameSync(`${file}.tmp`, file);
}
