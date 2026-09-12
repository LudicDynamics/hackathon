import fs from 'node:fs';
import path from 'node:path';

export type ModelPreference = { provider: string; model: string; thinking: 'off' | 'low' | 'medium' | 'high' };
export type ModelPreferences = Partial<Record<'writer' | 'character', ModelPreference>>;
export function readModelPreferences(worldRoot: string): ModelPreferences {
  try { return JSON.parse(fs.readFileSync(path.join(worldRoot, '.airpworld/model-preferences.json'), 'utf8')); }
  catch { return {}; }
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
