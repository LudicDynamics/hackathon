import { Router, type Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readLocalTtsConfig } from './local-tts.js';

const fields = ['DASHSCOPE_API_KEY', 'AIRP_TTS_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'FLOW_API_KEY', 'FLOW_API_BASE', 'DEEPSEEK_API_KEY',
  'AIRP_TTS_LOCAL_BASE_URL', 'AIRP_TTS_LOCAL_VOICE', 'AIRP_TTS_LOCAL_TIMEOUT_MS', 'AIRP_TTS_LOCAL_API_KEY'] as const;
const defaults: Record<string, string> = {
  AIRP_TTS_BASE_URL: 'https://dashscope-intl.aliyuncs.com/api/v1',
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  FLOW_API_BASE: 'http://127.0.0.1:8317',
};
const localHost = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
function localRequest(req: Request): boolean {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return false;
  if (req.headers.forwarded || req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']) return false;
  try {
    if (!localHost(new URL(`http://${req.headers.host}`).hostname)) return false;
    const origin = req.headers.origin;
    return !origin || (localHost(new URL(origin).hostname) && ['http:', 'https:'].includes(new URL(origin).protocol));
  } catch { return false; }
}

export function saveConnectionSettings(repoRoot: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid settings');
  const updates: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!fields.includes(key as typeof fields[number]) || typeof raw !== 'string') throw new Error('Unknown setting');
    const value = raw.trim();
    // An explicitly empty local URL disables this optional provider. Empty
    // credentials still mean "keep", as for every existing service setting.
    if (!value) {
      if (key === 'AIRP_TTS_LOCAL_BASE_URL') updates[key] = '';
      continue;
    }
    if (value.length > 4096 || /[\r\n"'\\\x00]/.test(value)) throw new Error('Invalid setting value');
    if (key === 'AIRP_TTS_LOCAL_VOICE') {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) throw new Error('Invalid local voice ID');
    } else if (key === 'AIRP_TTS_LOCAL_TIMEOUT_MS') {
      if (!/^\d+$/.test(value) || Number(value) < 1000 || Number(value) > 120000) throw new Error('Invalid local TTS timeout');
    } else if (!key.endsWith('_KEY')) {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid service URL');
    }
    updates[key] = value;
  }
  if (!Object.keys(updates).length) return;
  const preferred = path.join(repoRoot, '.local.env');
  const file = fs.existsSync(preferred) ? preferred : path.join(repoRoot, '.env.local');
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw new Error('Unsafe configuration file');
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'gm');
    for (const match of content.matchAll(pattern)) {
      const existing = match[0].slice(match[0].indexOf('=') + 1).trim();
      if (/^["']/.test(existing) && !existing.slice(1).includes(existing[0])) throw new Error('Multiline configuration must be edited on the server');
    }
    content = content.replace(pattern, '');
    content = content.trimEnd() + `\n${key}="${value}"\n`;
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, content, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  Object.assign(process.env, updates);
}

export function createConnectionSettingsRouter(repoRoot: string): Router {
  const router = Router();
  router.use('/connection-settings', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!localRequest(req)) return res.status(403).json({ error: 'Connection settings are available on localhost only.' });
    next();
  });
  router.get('/connection-settings', (_req, res) => {
    const local = readLocalTtsConfig();
    const currentDefaults: Record<string, string> = { ...defaults, AIRP_TTS_LOCAL_BASE_URL: local.baseUrl,
      AIRP_TTS_LOCAL_VOICE: local.voice, AIRP_TTS_LOCAL_TIMEOUT_MS: String(local.timeoutMs) };
    res.json(Object.fromEntries(fields.map(key => [key, key.endsWith('_KEY') ? Boolean(process.env[key]?.trim()) : process.env[key] ?? currentDefaults[key]])));
  });
  router.post('/connection-settings', (req, res) => {
    if (!req.is('application/json') || req.headers['x-airp-settings'] !== '1') return res.status(403).json({ error: 'Invalid settings request' });
    try {
      saveConnectionSettings(repoRoot, req.body);
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ error: 'Could not save settings. Check the values and server file permissions.' });
    }
  });
  return router;
}
