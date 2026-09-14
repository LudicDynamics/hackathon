/**
 * Spoken-language bridge for Japanese-only local voices (docs/tts/10 §中文世界).
 *
 * A Chinese (`zh-CN`) world still DISPLAYS Chinese, but the local character
 * voice (`setsuna`) is a Japanese voice and must never read Chinese aloud. So a
 * Chinese line is translated into spoken Japanese first, and only the Japanese
 * reaches the local synthesiser. Any failure throws `TtsTranslateError`; the TTS
 * route then skips the local voice entirely and the online (qwen) voice reads
 * the Chinese text — never setsuna.
 *
 * Config is re-read per request, like every other TTS setting (tests set env
 * after import). Defaults to the DeepSeek key the agents already use.
 */

export class TtsTranslateError extends Error {}

const HAN = /\p{Script=Han}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const MAX_OUTPUT_CHARS = 500;

export function readTtsTranslateConfig() {
  const timeout = Number(process.env.AIRP_TTS_TRANSLATE_TIMEOUT_MS);
  return {
    baseUrl: (process.env.AIRP_TTS_TRANSLATE_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, ''),
    // The model id the agents already use (config/deepseek-models.example.json).
    model: process.env.AIRP_TTS_TRANSLATE_MODEL?.trim() || 'deepseek-v4-flash',
    apiKey: (process.env.AIRP_TTS_TRANSLATE_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || ''),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 15000,
  };
}

/**
 * Local voices that can only speak Japanese. For now the bridge applies to the
 * `setsuna` local stage only (user ruling 2026-09-14); the online voice is
 * untouched and reads Chinese. `AIRP_TTS_JA_LOCAL_VOICES` (comma list) extends it.
 */
export function isJapaneseLocalVoice(voice: string): boolean {
  const list = (process.env.AIRP_TTS_JA_LOCAL_VOICES ?? 'setsuna').split(',').map(v => v.trim()).filter(Boolean);
  return list.includes(voice);
}

/**
 * True when this line must be bridged: the selected local voice is Japanese-only
 * (setsuna), the world is Chinese (manifest locale, or the request's content
 * language), and the line has Chinese text. A line with no Han characters
 * (`……`, `OK`) is read as-is.
 */
export function needsJapaneseBridge(localVoice: string, worldLocale: unknown, requestLanguage: unknown, text: string): boolean {
  const chinese = (value: unknown) => value === 'zh-CN' || value === 'zh';
  return isJapaneseLocalVoice(localVoice) && (chinese(worldLocale) || chinese(requestLanguage)) && HAN.test(text);
}

const SYSTEM_PROMPT = [
  'You are the voice of a character in a story game. The line below is what the character says, in Chinese.',
  'Rewrite it as natural spoken Japanese that keeps the same meaning, tone and feeling, as the character would say it.',
  'Output ONLY the Japanese line: no quotes, no romaji, no notes, no explanations, no Chinese.',
].join(' ');

/** Chinese line → spoken Japanese. Throws `TtsTranslateError` on any failure. */
export async function translateToJapanese(text: string): Promise<string> {
  const config = readTtsTranslateConfig();
  if (!config.apiKey) throw new TtsTranslateError('no translation key');
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        // DeepSeek V4 reasons by default and would spend the whole budget
        // thinking, returning empty content; same switch pi-rp uses.
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new TtsTranslateError(error instanceof Error ? error.name : 'network error');
  }
  if (!response.ok) throw new TtsTranslateError(`HTTP ${response.status}`);
  const data = await response.json().catch(() => null) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  const spoken = typeof content === 'string' ? content.trim().replace(/^["「『]|["」』]$/g, '').trim() : '';
  // A reply without kana is not Japanese (e.g. the model echoed the Chinese):
  // setsuna must not read it.
  if (!spoken || !KANA.test(spoken)) throw new TtsTranslateError('translation is not Japanese');
  return spoken.slice(0, MAX_OUTPUT_CHARS);
}
