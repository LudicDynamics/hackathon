import fs from 'node:fs';
import path from 'node:path';

/** Add shipped model definitions without replacing local providers or credentials. */
export function ensureProviderConfig(repoRoot: string): void {
  const source = path.join(repoRoot, 'config/deepseek-models.example.json');
  if (!fs.existsSync(source)) return;
  const file = path.join(repoRoot, '.pi/agent/models.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const bundled = JSON.parse(fs.readFileSync(source, 'utf8')).providers.deepseek;
  config.providers ??= {};
  const existing = config.providers.deepseek;
  if (existing?.models?.some((model: { id: string }) => model.id === 'deepseek-flash')) return;
  config.providers.deepseek = existing
    ? { ...existing, models: [...(existing.models ?? []), bundled.models[0]] }
    : bundled;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}
