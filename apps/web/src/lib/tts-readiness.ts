export type TtsConfig = { configured: boolean; model: string; defaultVoice: string };
let cached: TtsConfig | null = null;
let pending: Promise<TtsConfig> | null = null;
let retryAt = 0;
let warned = false;
export const ttsEnabled = () => localStorage.getItem('airp-tts-enabled') !== 'false';
export function setTtsEnabled(enabled: boolean) { localStorage.setItem('airp-tts-enabled', String(enabled)); }
export function warnTtsUnavailable() {
  if (warned) return;
  warned = true;
  window.dispatchEvent(new Event('airp:tts-unavailable'));
}
export function invalidateTts(missing = false) {
  retryAt = Date.now() + 60_000;
  if (missing) cached = { configured: false, model: cached?.model ?? '', defaultVoice: cached?.defaultVoice ?? '' };
  warnTtsUnavailable();
}
export function readTtsConfig(force = false): Promise<TtsConfig> {
  if (pending) return pending;
  if (!force && cached) return Promise.resolve(cached);
  pending = fetch('/api/tts/config').then(async response => {
    if (!response.ok) throw Error('Voice service is unavailable');
    const data = await response.json() as TtsConfig;
    cached = data;
    if (data.configured) { retryAt = 0; warned = false; }
    return data;
  }).finally(() => { pending = null; });
  return pending;
}
export async function canRequestTts() {
  if (!ttsEnabled() || Date.now() < retryAt) return false;
  try {
    if ((await readTtsConfig()).configured) return true;
    warnTtsUnavailable();
  } catch { invalidateTts(); }
  return false;
}
