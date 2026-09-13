import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** The subset of a pi-rp model definition that the bundled DeepSeek model needs. */
export interface DeepSeekModelDefinition {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
  compat: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function bundledDefinition(source: unknown): { provider: JsonObject; model: DeepSeekModelDefinition } | undefined {
  if (!isObject(source) || !isObject(source.providers) || !isObject(source.providers.deepseek)) return undefined;
  const rawProvider = source.providers.deepseek;
  if (
    rawProvider.apiKey !== '$DEEPSEEK_API_KEY' ||
    rawProvider.baseUrl !== 'https://api.deepseek.com' ||
    rawProvider.api !== 'openai-completions' ||
    !Array.isArray(rawProvider.models)
  ) return undefined;
  const model = rawProvider.models.find((candidate: unknown) => isObject(candidate) && candidate.id === 'deepseek-flash');
  if (!isObject(model)) return undefined;
  if (
    typeof model.name !== 'string' ||
    model.reasoning !== true ||
    !Array.isArray(model.input) ||
    !model.input.every((item: unknown) => typeof item === 'string') ||
    typeof model.contextWindow !== 'number' ||
    typeof model.maxTokens !== 'number' ||
    !isObject(model.compat)
  ) return undefined;
  return {
    provider: {
      baseUrl: rawProvider.baseUrl,
      api: rawProvider.api,
      apiKey: '$DEEPSEEK_API_KEY',
      models: [model],
    },
    model: model as unknown as DeepSeekModelDefinition,
  };
}

/**
 * Add the shipped DeepSeek model without replacing local providers, credentials,
 * or model overrides. Invalid local JSON is left untouched for an operator to fix.
 */
export function ensureProviderConfig(repoRoot: string): void {
  const sourceFile = path.join(repoRoot, 'config', 'deepseek-models.example.json');
  const targetFile = path.join(repoRoot, '.pi', 'agent', 'models.json');
  const definition = bundledDefinition(readJson(sourceFile));
  if (!definition) return;

  let config: JsonObject = {};
  if (fs.existsSync(targetFile)) {
    if (!fs.lstatSync(targetFile).isFile()) return;
    const parsed = readJson(targetFile);
    if (!isObject(parsed)) return;
    config = parsed;
  }
  const providers = config.providers === undefined ? {} : config.providers;
  if (!isObject(providers)) return;
  const existing = providers.deepseek;
  if (existing !== undefined && !isObject(existing)) return;
  if (isObject(existing) && Array.isArray(existing.models) && existing.models.some((candidate) => isObject(candidate) && candidate.id === definition.model.id)) return;

  const deepseek = isObject(existing)
    ? { ...existing, models: [...(Array.isArray(existing.models) ? existing.models : []), definition.model] }
    : { ...definition.provider, models: [definition.model] };
  const next = { ...config, providers: { ...providers, deepseek } };
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  const tempFile = `${targetFile}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(tempFile, targetFile);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}
