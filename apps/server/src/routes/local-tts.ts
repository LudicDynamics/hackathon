import { createHash } from 'node:crypto';

/** Messages contain only our own diagnostics, never upstream bodies or secrets. */
export class LocalTtsError extends Error {}

/** Deployment-only routing; character content retains its online fallback voice. */
export function readLocalTtsConfig() {
  const timeout = Number(process.env.AIRP_TTS_LOCAL_TIMEOUT_MS);
  return {
    baseUrl: (process.env.AIRP_TTS_LOCAL_BASE_URL ?? '').trim().replace(/\/+$/, ''),
    voice: process.env.AIRP_TTS_LOCAL_VOICE?.trim() || 'setsuna',
    apiKey: process.env.AIRP_TTS_LOCAL_API_KEY?.trim() || '',
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
  };
}

export function isLocalTtsCharacter(worldId: string, characterId: unknown): boolean {
  return characterId === 'nanami' && /^(?:first-snow|firstsnow|sakura-academy)(?:-|$)/.test(worldId);
}

const EMOTIONS: Record<string, string> = {
  normal: 'neutral', smile: 'happy', sad: 'sad', angry: 'angry',
  shock: 'neutral', thinking: 'neutral',
};

export function localTtsEmotion(emotion: unknown): string {
  return typeof emotion === 'string' ? (EMOTIONS[emotion] ?? 'neutral') : 'neutral';
}

export function localTtsHash(config: ReturnType<typeof readLocalTtsConfig>, text: string, language: string, emotion: string): string {
  return createHash('sha256').update(JSON.stringify([
    'fish-tts-v1', config.baseUrl, config.voice, language, emotion, text,
  ])).digest('hex').slice(0, 20);
}

export async function synthesiseLocal(config: ReturnType<typeof readLocalTtsConfig>, text: string, language: string, emotion: string): Promise<Buffer> {
  const response = await fetch(`${config.baseUrl}/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({ text, voice: config.voice, language, emotion }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new LocalTtsError(`HTTP ${response.status}`);
  const wav = Buffer.from(await response.arrayBuffer());
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new LocalTtsError('invalid WAV');
  }
  return wav;
}
