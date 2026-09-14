import type { ImageProvider } from '../../packages/shared/src/actions/image-provider.js';

/** Keep diagnostic fields, never dump request bodies, credentials or gateway HTML. */
async function upstreamError(response: Response, secrets: string[], prompt: string): Promise<string> {
  const clean = (value: string) => {
    for (const secret of [...secrets, prompt].filter(Boolean)) value = value.split(secret).join('[redacted]');
    return value.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
      .replace(/sk-[\w-]+/g, '[redacted]')
      .replace(/https?:\/\/[^\s"']+/g, '[url omitted]')
      .replace(/[\x00-\x1f]/g, ' ').slice(0, 700);
  };
  try {
    const body = await response.json();
    const error = body?.error ?? body;
    const fields = typeof error === 'string' ? [`message=${clean(error)}`] :
      ['code', 'type', 'param', 'message'].flatMap(key => typeof error?.[key] === 'string' ? [`${key}=${clean(error[key])}`] : []);
    return fields.length ? `: ${fields.join('; ').slice(0, 1400)}` : '';
  } catch { return ' (upstream error body unavailable or non-JSON)'; }
}

/** Project-owned Images protocol adapter. No pi-rp registry or SDK dependency. */
export function createOpenAIImageProvider(model: string, env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): ImageProvider {
  return {
    id: 'openai', model, supportsReference: true,
    async generate(req, opts) {
      if (!env.OPENAI_API_KEY) return { ok: false, reason: 'no_credentials', message: 'OPENAI_API_KEY is not set' };
      const quality = env.AIRP_IMAGE_QUALITY ?? 'low';
      if (!['auto', 'low', 'medium', 'high'].includes(quality)) return { ok: false, reason: 'provider_error', message: 'Invalid image quality' };
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      opts.signal?.addEventListener('abort', abort, { once: true });
      if (opts.signal?.aborted) abort();
      const timer = setTimeout(() => { timedOut = true; abort(); }, opts.timeoutMs ?? 120_000);
      try {
        controller.signal.throwIfAborted();
        const params = { model, prompt: req.prompt, n: 1, output_format: 'png', size: `${req.width}x${req.height}`, quality };
        let body: string | FormData = JSON.stringify(params);
        const headers: Record<string, string> = { Authorization: `Bearer ${env.OPENAI_API_KEY}` };
        if (req.reference) {
          body = new FormData();
          for (const [key, value] of Object.entries(params)) body.set(key, String(value));
          body.set('image', new Blob([Buffer.from(req.reference.dataB64, 'base64')], { type: req.reference.mimeType }), 'reference.png');
        } else headers['Content-Type'] = 'application/json';
        const base = (env.AIRP_IMAGE_BASE_URL ?? env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
        const response = await request(`${base}/images/${req.reference ? 'edits' : 'generations'}`, { method: 'POST', headers, body, signal: controller.signal, redirect: 'error' });
        if (!response.ok) return { ok: false, reason: 'provider_error', message: `Image endpoint returned HTTP ${response.status} [size=${params.size}, quality=${quality}, reference=${!!req.reference}]${await upstreamError(response, [env.OPENAI_API_KEY], req.prompt)}` };
        const data = await response.json() as { data?: { b64_json?: string }[] };
        const image = data.data?.find(item => typeof item.b64_json === 'string' && item.b64_json.length > 0);
        return image?.b64_json ? { ok: true, mimeType: 'image/png', dataB64: image.b64_json } : { ok: false, reason: 'no_image', message: 'Image endpoint returned no base64 image' };
      } catch {
        return { ok: false, reason: opts.signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'provider_error', message: opts.signal?.aborted ? 'Generation cancelled' : timedOut ? 'Image generation timed out' : 'Image request failed' };
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', abort);
      }
    },
  };
}
