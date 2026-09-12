/**
 * generate_image (doc 11). Turns one prompt into one file under
 * `.airpworld/assets/gen/` and hands back a stable path. It appends NO event:
 * the asset is a binary resource inside the system directory (00 §2.2), not
 * world content — the world only changes when the caller points a README `bg:`
 * at the path through `editEntity` (doc 11 §5.1).
 *
 * Five-step skeleton (01 §3.1) with the four documented differences (doc 11
 * §3.1): no 落账 step, an extra non-rollbackable provider side effect before the
 * write, a binary atomic write, and no `event` in `details`.
 */
import { createHash } from 'node:crypto';
import type { ActionContext, ActionResult } from './types.js';
import { fail } from './errors.js';
import type { ImageFailureReason, ImageProvider } from './image-provider.js';
import { resolveImageProvider } from './image-provider.js';
import { registerAction } from './service.js';

/** The ONE output directory for generated images (doc 11 §4.1). */
export const GENERATED_ASSET_DIR = '.airpworld/assets/gen';

/** Where a `reference` source image is allowed to live (doc 11 §2.1). */
const ASSET_PREFIX = '.airpworld/assets/';

/** Prompt length bound, after trim (doc 11 §2.1). */
const PROMPT_MAX = 2000;
/** Pixel bounds shared by width and height (doc 11 §2.1). */
const SIZE_MIN = 256;
const SIZE_MAX = 4096;
const SIZE_DEFAULT = 1024;

/** Default hard timeout for one provider call; < DEFAULT_TURN_TIMEOUT_MS = 90000 (doc 11 §4.3.3). */
const DEFAULT_TIMEOUT_MS = 60000;

export interface GenerateImageInput {
  /** What to depict. Natural language, any script (Chinese is expected and fine). */
  prompt: string;
  /** Style suffix appended to the prompt (e.g. 'pencil sketch', 'sepia watercolor'). */
  style?: string;
  /** Requested pixel width. Provider may snap to its own aspect buckets. */
  width?: number;
  /** Requested pixel height. */
  height?: number;
  /** World-relative path of an existing asset to use as a source image (img2img / edit). */
  reference?: string;
  /** Optional: the world path this image is intended to be attached to. NOT written by this action. */
  path?: string;
}

export interface GenerateImageDetails {
  /** Stable path for the next action. ALWAYS under `.airpworld/assets/gen/`. */
  asset: string;
  /** The prompt actually sent, after `style` was appended. Self-sufficient for the model. */
  caption: string;
  provider: string;
  model: string;
  mimeType: string;
  bytes: number;
  /** Requested size, post-defaults (doc 11 §7.3: not the provider's real pixels). */
  width: number;
  height: number;
  /** true when this exact request had already produced this file */
  reused: boolean;
  elapsedMs: number;
  /** echo of input.path */
  attachTo?: string;
}

/** The four fields (plus reference) whose values decide the filename (doc 11 §4.2). */
export interface ImageRequestDescriptor {
  caption: string;
  model: string;
  width: number;
  height: number;
  reference?: string;
}

/**
 * Deterministic, ASCII-only, kebab-case slug from an arbitrary-script prompt.
 * Chinese prompts survive no ASCII alnum run and collapse to the literal
 * 'image' — deliberate (doc 11 §4.2): `requestKey` already guarantees
 * uniqueness, the slug is for humans.
 */
export function assetSlug(prompt: string): string {
  const runs = prompt.match(/[A-Za-z0-9]+/g) ?? [];
  let slug = runs.join('-').toLowerCase();
  if (slug.length > 32) slug = slug.slice(0, 32);
  slug = slug.replace(/-+$/, '');
  return slug === '' ? 'image' : slug;
}

/**
 * SHA-256 over the request descriptor, truncated to 16 hex chars (64 bits).
 * 64 bits because a collision here is silent cross-contamination (B's image
 * reused as A's), not an error — the birthday bound ~2^32 requests is
 * negligible (doc 11 §4.2).
 */
export function requestKey(r: ImageRequestDescriptor): string {
  const payload = JSON.stringify([r.caption, r.model, r.width, r.height, r.reference ?? null]);
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** `ext` from the provider's returned mimeType; unknown mime → 'png' + one warn line (doc 11 §4.2). */
export function extForMimeType(mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    console.warn(`generate_image: unknown mime type '${mimeType}'; writing a .png asset`);
    return 'png';
  }
  return ext;
}

/** Reverse of `MIME_TO_EXT` for a `reference` source image; unknown ext → octet-stream. */
function mimeTypeForAssetPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

/**
 * The ONE place an output path is decided. Pure.
 * The filename is `<slug>-<requestKey>.<ext>`. The slug comes from the CAPTION
 * (prompt with `style` appended) — the worked example in 11 §4.4 has the style
 * words inside the filename; `ext` follows the provider's mimeType.
 */
export function outputPathFor(
  r: ImageRequestDescriptor & { mimeType: string }
): { asset: string; ext: string } {
  const ext = extForMimeType(r.mimeType);
  return { asset: `${GENERATED_ASSET_DIR}/${assetSlug(r.caption)}-${requestKey(r)}.${ext}`, ext };
}

/** Resolved env timeout, clamped to a sane positive integer. */
function providerTimeoutMs(): number {
  const raw = process.env.AIRP_IMAGE_TIMEOUT_MS;
  const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.floor(parsed);
}

function isUnderAssetTree(relPath: string): boolean {
  return relPath.startsWith(ASSET_PREFIX);
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string') fail('invalid_argument', message);
  return value as string;
}

/** Step 1 — pure shape validation; no I/O, no money (doc 11 §3.2 step 1). */
function validateInput(input: GenerateImageInput): {
  prompt: string;
  caption: string;
  width: number;
  height: number;
  reference?: string;
  path?: string;
} {
  const rawPrompt = requireString(
    input.prompt,
    'generate_image needs a non-empty prompt (max 2000 characters).'
  );
  const prompt = rawPrompt.trim();
  if (prompt === '' || prompt.length > PROMPT_MAX) {
    fail('invalid_argument', 'generate_image needs a non-empty prompt (max 2000 characters).');
  }

  const sizeOf = (field: 'width' | 'height', value: unknown): number => {
    if (value === undefined) return SIZE_DEFAULT;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < SIZE_MIN || value > SIZE_MAX) {
      fail('invalid_argument', `${field} must be an integer between 256 and 4096.`);
    }
    return value;
  };
  const width = sizeOf('width', input.width);
  const height = sizeOf('height', input.height);

  let style: string | undefined;
  if (input.style !== undefined) {
    style = requireString(input.style, 'style must be a string.').trim();
    if (style === '') style = undefined;
  }
  const caption = style ? `${prompt}, ${style}` : prompt;

  let path: string | undefined;
  if (input.path !== undefined) {
    path = requireString(input.path, 'path must be a string.');
    if (!path.endsWith('.md')) {
      fail(
        'invalid_argument',
        'path must be a world .md file the image is attached to, or omitted; the asset path is chosen by the engine.'
      );
    }
    if (path.startsWith('.airpworld/')) {
      fail('invalid_path', `path must point at a world entity, not into the system directory: '${path}'.`);
    }
  }

  let reference: string | undefined;
  if (input.reference !== undefined) {
    reference = requireString(input.reference, 'reference must be a string.');
    if (!isUnderAssetTree(reference)) {
      fail(
        'invalid_path',
        `reference must point into .airpworld/assets/; '${reference}' is world content, not an asset.`
      );
    }
  }

  return { prompt, caption, width, height, reference, path };
}

/** Map an `ImageFailureReason` onto the frozen ActionErrorCode set (doc 11 §7.1 / §11 conflict 5). */
function failFromProvider(
  reason: ImageFailureReason,
  message: string,
  provider: ImageProvider | null,
  timeoutMs: number
): never {
  const details = { reason };
  switch (reason) {
    case 'timeout':
      fail(
        'internal',
        `The image model did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
          'The world is unchanged; you may describe the picture in prose instead. Do not retry immediately.',
        details
      );
      break;
    case 'aborted':
      fail('internal', 'Image generation was cancelled; nothing was written.', details);
      break;
    case 'policy':
      fail(
        'internal',
        `The image model refused this prompt (${message}). Rewrite the prompt to describe the scene ` +
          'without the refused content; do not resend the same prompt.',
        details
      );
      break;
    case 'no_image':
      fail(
        'internal',
        'The image model returned no image for this prompt. The world is unchanged; try a different, ' +
          'more concrete prompt.',
        details
      );
      break;
    case 'no_credentials':
      fail(
        'unsupported',
        `Image model '${provider?.model ?? 'the configured image model'}' is configured but has no API key. Set OPENROUTER_API_KEY and ` +
          'restart, then try again. Do not retry in this turn.',
        details
      );
      break;
    case 'no_provider':
      fail(
        'unsupported',
        'No image model is configured for this world, so generate_image cannot run. Tell the player this ' +
          'in their language — the scene must be described in text or drawn as chalk instead. ' +
          'Do not retry this tool.',
        { reason: 'no_provider', configHint: 'Set AIRP_IMAGE_MODEL and OPENROUTER_API_KEY' }
      );
      break;
    case 'provider_error':
    default:
      fail(
        'internal',
        `The image model failed: ${message}. The world is unchanged. Do not retry more than once.`,
        { reason: 'provider_error' }
      );
  }
}

/**
 * Bind this action's handler into the frozen service registry (01 §2.6).
 * Registered at import time; `service.ts` carries no business logic.
 */
export function generateImage(
  ctx: ActionContext,
  input: GenerateImageInput
): Promise<ActionResult<GenerateImageDetails>> {
  return run(ctx, input);
}

async function run(ctx: ActionContext, input: GenerateImageInput): Promise<ActionResult<GenerateImageDetails>> {
  // Step 1 — resolve input.
  const { prompt, caption, width, height, reference, path } = validateInput(input);

  // Step 3 (deliberately before any reference I/O, doc 11 §3.2 step 3 rationale):
  // resolve the provider and fail loud BEFORE spending money or reading assets.
  const { provider } = resolveImageProvider();
  if (!provider) {
    failFromProvider('no_provider', '', provider, providerTimeoutMs());
  }

  // Step 2 remainder — the attach target and the reference source.
  if (path !== undefined) {
    const kind = await ctx.store.statKind(path);
    if (kind === 'missing') {
      fail('not_found', `attach target '${path}' does not exist; generate the image first, then write the entity.`);
    }
    if (kind !== 'file') {
      fail(
        'invalid_argument',
        'path must be a world .md file the image is attached to, or omitted; the asset path is chosen by the engine.'
      );
    }
  }

  let refPayload: { dataB64: string; mimeType: string } | undefined;
  if (reference !== undefined) {
    const kind = await ctx.store.statKind(reference);
    if (kind !== 'file') {
      fail('not_found', `reference asset '${reference}' does not exist.`);
    }
    if (!provider.supportsReference) {
      fail(
        'unsupported',
        `Model '${provider.model}' cannot take a source image; call generate_image without a reference. ` +
          'Do not retry with the same reference.'
      );
    }
    refPayload = { dataB64: await ctx.store.readFileBase64(reference), mimeType: mimeTypeForAssetPath(reference) };
  }

  // Step 4 — the non-rollbackable provider side effect.
  const startedAt = Date.now();
  const timeoutMs = providerTimeoutMs();
  const result = await provider.generate({ prompt: caption, width, height, reference: refPayload }, { timeoutMs });
  if (!result.ok) {
    failFromProvider(result.reason, result.message, provider, timeoutMs);
  }
  if (!result.dataB64) {
    failFromProvider('no_image', '', provider, timeoutMs);
  }
  const elapsedMs = Date.now() - startedAt;

  // Step 6 — deterministic path, then atomic binary write (reuse when present).
  const { asset } = outputPathFor({
    caption,
    model: provider.model,
    width,
    height,
    reference,
    mimeType: result.mimeType,
  });
  const bytes = Buffer.from(result.dataB64, 'base64');
  const existing = await ctx.store.statKind(asset);
  const reused = existing === 'file';
  if (!reused) {
    try {
      await ctx.store.writeFileAtomic(asset, bytes);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      fail('write_failed', `Could not write the generated asset: ${reason}. The world is unchanged.`);
    }
  }

  // Step 7 — return. No event: the world is unchanged until the caller writes `bg:`.
  const text = reused
    ? `Reused the existing asset '${asset}' (same prompt, style and size).`
    : `Generated '${asset}' (${width}×${height}, ${Math.round(bytes.length / 1024)} KB).\n` +
      "Point a layer README's `bg:` field at this path to put it on the canvas.";

  const details: GenerateImageDetails = {
    asset,
    caption,
    provider: provider.id,
    model: provider.model,
    mimeType: result.mimeType,
    bytes: bytes.length,
    width,
    height,
    reused,
    elapsedMs,
  };
  if (path !== undefined) details.attachTo = path;

  return { text, details };
}

// Register at import time (01 §2.6). The service module owns the binding table.
registerAction('generateImage', (ctx, input) => generateImage(ctx, input as unknown as GenerateImageInput));
