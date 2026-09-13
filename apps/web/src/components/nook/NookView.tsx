import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Canvas } from '../canvas/Canvas.js';
import { WriterBar } from '../chrome/WriterBar.js';
import type { LayerState } from '../../state/useWorld.js';
import { UI_COPY, type Locale } from '../../lib/i18n.js';
import { useStill } from '../../lib/motion.js';
import { whenFontsSettled } from '../../lib/fonts.js';
import { invalidateMeasures } from '../../lib/measure.js';
import {
  createFootprintScheduler,
  measureHeights,
  type FootprintScheduler,
} from '../../lib/footprint.js';

/**
 * NookView — a character's private space (docs/nook/00 §3, 02 §2.2).
 *
 * It reuses the layer `<Canvas>` wholesale: same card components, same drag
 * path, same measured-footprint write-back. Only two things differ from the
 * layer view — the fetch endpoint (`GET /api/nook`) and the empty state.
 *
 * It deliberately does NOT call `useWorld()`: that would start a SECOND
 * WebSocket and a second layer footprint scheduler (00 §6 anti-pattern 3).
 * Re-fetch on world changes rides the existing `airp:world-event` forward.
 */
export interface NookViewProps {
  /** Character id (ASCII kebab-case, from the RightSidebar's 4th button). */
  characterId: string;
  /** Close the nook, returning to the layer that was showing. App owns it. */
  onClose: () => void;
  locale: Exclude<Locale, 'zh-CN'>;
  // Forwarded layer callbacks (02 §⑫-2): the nook MUST NOT build its own
  onMoveCard?: (path: string, x: number, y: number) => Promise<void> | void;
  onSelectChoice?: (path: string, choice: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onTakeItem?: (path: string) => void;
}

interface NookError {
  /** 0 = network/parse failure (never a 4xx). */
  status: number;
  /** `null` when the server body has no `code` (the "No active world" shape). */
  code: string | null;
  message: string;
}

type FetchResult = { ok: true; data: LayerState } | { ok: false; error: NookError };

/**
 * `/api/asset?path=` is the ONE frozen avatar URL shape (00 §5.4). A raw
 * `/assets/...` value (the old RightSidebar fallback) is normalised rather
 * than passed through, so the nook never reproduces 02 §⑪-2.
 */
export function assetUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (value.startsWith('/api/asset')) return value;
  return `/api/asset?path=${encodeURIComponent(value.replace(/^\/+/, ''))}`;
}

/**
 * One honest status line from the character README frontmatter (02 §⑫-8).
 * Returns null when there is nothing to say — the caller then omits the row
 * rather than inventing copy.
 */
export function statusLineOf(frontmatter: Record<string, any> | null | undefined): string | null {
  const data = frontmatter?.status?.data;
  if (typeof data === 'string' && data.trim() !== '') return data.trim();
  if (data && typeof data === 'object') {
    const parts = Object.entries(data as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${String(v)}`);
    if (parts.length > 0) return parts.join(' · ');
  }
  // Second choice per 02 §⑫-8: the README title. Nothing beyond that —
  // a made-up "currently rearranging a thought" would be fabricated copy.
  const title = frontmatter?.title;
  if (typeof title === 'string' && title.trim() !== '') return title.trim();
  return null;
}

async function fetchNook(characterId: string): Promise<FetchResult> {
  try {
    const res = await fetch(`/api/nook?character=${encodeURIComponent(characterId)}`);
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      return {
        ok: false,
        error: {
          status: res.status,
          code: typeof body.code === 'string' ? body.code : null,
          message: typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
        },
      };
    }
    const data: LayerState = {
      layer: body.layer,
      scene: body.scene ?? null,
      bg: body.bg ?? { src: null, tone: 'warm', grain: 'parchment' },
      audio: body.audio ?? { ambient: null, bgm: null },
      items: Array.isArray(body.items) ? body.items : [],
      links: Array.isArray(body.links) ? body.links : [],
      presence: Array.isArray(body.presence) ? body.presence : [],
      worldFrozen: body.worldFrozen === true,
    };
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: { status: 0, code: null, message: err instanceof Error ? err.message : String(err) },
    };
  }
}

export const NookView: React.FC<NookViewProps> = ({
  characterId,
  onClose,
  locale,
  onMoveCard,
  onSelectChoice,
  onDiceRolled,
  onTakeItem,
}) => {
  const [state, setState] = useState<LayerState | null>(null);
  const [error, setError] = useState<NookError | null>(null);
  const [loading, setLoading] = useState(true);

  const copy = UI_COPY[locale];

  const nookIdRef = useRef('');
  const stateRef = useRef<LayerState | null>(null);
  const reqSeqRef = useRef(0);
  const fpRef = useRef<FootprintScheduler | null>(null);
  const fontsSettledRef = useRef(false);
  const reduceMotion = useStill();

  const load = useCallback(async (id: string) => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    const result = await fetchNook(id);
    if (seq !== reqSeqRef.current) return; // last request wins (02 §⑦)
    if (result.ok) {
      // The nook id comes FROM the response (00 §5.1); never re-derived here.
      if (nookIdRef.current !== result.data.layer) {
        nookIdRef.current = result.data.layer;
        fpRef.current?.reset(result.data.layer);
      }
      stateRef.current = result.data;
      setState(result.data);
      setError(null);
    } else {
      // Keep the old payload on failure: flashing back to blank is worse (§3.2).
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(characterId);
  }, [characterId, load]);

  // A world file changed (writer added a furnishing / drag persisted) → re-read
  // the whole nook. `useWorld` already forwards `file_changed` before its own
  // switch, so this costs zero new contract (02 §⑥).
  useEffect(() => {
    const onWorldEvent = (e: Event) => {
      const msg = (e as CustomEvent).detail as { type?: string } | undefined;
      if (msg?.type === 'file_changed') void load(characterId);
    };
    window.addEventListener('airp:world-event', onWorldEvent);
    return () => window.removeEventListener('airp:world-event', onWorldEvent);
  }, [characterId, load]);

  // Footprint channel (02 §3.6): the layer scheduler only knows layer items,
  // so nook cards would never have their measured height written back. This
  // second instance submits ONLY the paths in its own widths map, so the two
  // schedulers cannot collide even though both scan the global DOM.
  useEffect(() => {
    const scheduler = createFootprintScheduler({
      layer: () => nookIdRef.current,
      widths: () => new Map((stateRef.current?.items ?? []).map((it) => [it.path, it.w])),
      measure: () => measureHeights(),
      post: async (l, boxes) => {
        const res = await fetch('/api/card/footprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layer: l, boxes }),
        });
        if (!res.ok) {
          throw new Error(`POST /api/card/footprint -> ${res.status} ${await res.text()}`);
        }
        const data = (await res.json()) as { updated?: unknown; unchanged?: unknown };
        invalidateMeasures();
        return { updated: Number(data.updated) || 0, unchanged: Number(data.unchanged) || 0 };
      },
      // The nook consumes no writer tool_start/tool_end frames this batch.
      isBusy: () => false,
      isDragging: () => document.querySelector('.object.dragging-item') !== null,
    });
    fpRef.current = scheduler;
    return () => {
      scheduler.dispose();
      fpRef.current = null;
    };
  }, []);

  // Per-card ResizeObserver + the fonts gate (02 §3.6 conditions ①②): the
  // first measurement MUST wait for web fonts (wrapping decides height) and
  // re-arm whenever a card's content box changes.
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (fontsSettledRef.current) fpRef.current?.notify();
    });
    frame = requestAnimationFrame(() => {
      if (disposed) return;
      for (const el of document.querySelectorAll('.object[data-path]')) observer.observe(el);
      if (fontsSettledRef.current) {
        fpRef.current?.notify();
        return;
      }
      void whenFontsSettled().then((outcome) => {
        if (outcome === 'timeout') {
          console.warn('[nook footprint] fonts did not settle in time; heights may be off');
        }
        fontsSettledRef.current = true;
        if (!disposed) fpRef.current?.notify();
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state?.items]);

  const sceneFrontmatter: Record<string, any> | null = state?.scene?.frontmatter ?? null;
  const avatar = assetUrl(sceneFrontmatter?.avatar);
  const displayName =
    typeof sceneFrontmatter?.name === 'string' && sceneFrontmatter.name.trim() !== ''
      ? sceneFrontmatter.name
      : characterId;
  const statusLine = statusLineOf(sceneFrontmatter);
  const isEmpty = state !== null && state.items.length === 0 && state.scene === null;
  const canRetry = error !== null && (error.status === 0 || error.status >= 500);

  return (
    <div className="relative w-full h-full overflow-hidden" data-nook={characterId}>
      {/* Character existence core — always visible, read-only (00 §4.2). */}
      <div
        role="group"
        aria-label={copy.nookCoreStatus}
        className="absolute top-4 left-4 z-20 flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl bg-paper-card/90 border border-ink/10 shadow-soft backdrop-blur-md"
      >
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover border border-rust/30 shadow-sm shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-paper-wall border border-ink/10 shrink-0 flex items-center justify-center font-serif text-sm text-ink/60">
            {displayName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-serif text-sm font-bold text-ink truncate">{displayName}</div>
          {statusLine && (
            <div className="font-mono text-[10px] text-ink/50 truncate">{statusLine}</div>
          )}
        </div>
      </div>

      {/* Back to the layer the player came from. */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-paper-card/90 border border-ink/10 shadow-soft backdrop-blur-md text-xs text-ink/70 hover:bg-ink hover:text-white transition-all"
        title={copy.nookBack}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{copy.nookBack}</span>
      </button>

      {error && (
        <div
          role="alert"
          className="absolute bottom-4 left-4 z-20 max-w-md p-3 rounded-xl bg-rust/10 border border-rust/40 text-xs text-ink shadow-soft"
        >
          <div className="font-semibold text-rust">{copy.nookError}</div>
          <div className="font-mono text-[10px] text-ink/60 mt-1">
            {error.code ? `${error.code} · ` : ''}
            {error.status > 0 ? `${error.status} · ` : ''}
            {error.message}
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-ink/50">response</summary>
            <pre className="whitespace-pre-wrap break-all text-[10px] text-ink/60 mt-1">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
          {canRetry && (
            <button
              type="button"
              onClick={() => void load(characterId)}
              className="mt-2 px-3 py-1 rounded-lg bg-rust text-white hover:bg-rust-light transition-all"
            >
              {copy.nookRetry}
            </button>
          )}
        </div>
      )}

      {loading && state === null && !error && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-ink/40">
          …
        </div>
      )}

      {isEmpty ? (
        /* Empty room (doc-11 §4.1): a room nothing has moved into yet. The
           room text sits centred; the input line reuses the writer bar's
           paper-slip imagery but MUST stay a dead control — initialisation
           is a later batch (00 §4). */
        <div className="w-full h-full">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-8 text-center">
            <div className="font-serif text-lg text-ink/70">{copy.nookEmptyTitle}</div>
            <div className="font-mono text-xs text-ink/50">{copy.nookEmptyBody}</div>
          </div>
          <WriterBar disabled onSend={() => {}} placeholder={copy.nookEmptyPrompt} sendLabel="⏎" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] text-ink/40 text-center px-4">
            {copy.nookEmptyHint}
          </div>
        </div>
      ) : state ? (
        <Canvas
          currentLayer={state.layer}
          items={state.items}
          links={[]}
          bg={state.bg}
          ghostCopy={{
            reused: copy.ghostReused,
            failed: copy.ghostFailed,
            unreachable: copy.ghostUnreachable,
          }}
          onMoveCard={onMoveCard}
          onSelectChoice={onSelectChoice}
          onDiceRolled={onDiceRolled}
          onTakeItem={onTakeItem}
          stillPortraits={reduceMotion}
        />
      ) : null}
    </div>
  );
};
