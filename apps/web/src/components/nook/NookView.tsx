import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Canvas } from '../canvas/Canvas.js';
import { WriterBar } from '../chrome/WriterBar.js';
import { StubPrompt } from '../chrome/StubPrompt.js';
import { ghostItemFor } from '../../lib/init-ghost.js';
import type { LayerState } from '../../state/useWorld.js';
import { NookNoteComposer } from './NookNoteComposer.js';
import { UI_COPY, type Locale } from '../../lib/i18n.js';
import { airpGateway, type AssetMediaKind } from '../../lib/airp-gateway.js';
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
  /** Character id (ASCII kebab-case, supplied by the character rail's nook button). */
  characterId: string;
  /** Close the nook, returning to the layer that was showing. App owns it. */
  onClose: () => void;
  locale: Exclude<Locale, 'zh-CN'>;
  // Forwarded layer callbacks (02 §⑫-2): the nook MUST NOT build its own
  onMoveCard?: (path: string, x: number, y: number) => Promise<void> | void;
  onSelectChoice?: (path: string, choice: string) => void;
  onEntityAction?: (prompt: string, targetLayer?: string) => void;
  onDiceRolled?: (result: number, passed: boolean) => void;
  onOpenCharacterModal?: (characterId: string) => void;
  onItemDropOnTarget?: (itemPath: string, targetPath: string) => void;
  onDropItemToScene?: (itemPath: string, targetLayer?: string) => void;
  onTakeItem?: (path: string) => void;
  /** True while a CharacterModal owns focus above this projection. */
  inactive?: boolean;
  writerLocked?: boolean;
  /**
   * Ask the engine to materialise this empty nook (docs/init/03 §3.7: the N1
   * view owns the ENTRY, the `airp_init` kernel stays in one place). `request`
   * is the player's one-line intent, or undefined for "leave it blank".
   * Returns false when the socket is down, so the caller keeps its UI state.
   */
  onRequestInit?: (kind: 'nook', target: string, request?: string) => boolean;
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
 * Nook avatars are image-lane media. Legacy `/api/asset?path=` values are
 * normalised in place so every request still declares `kind=image`.
 */
export function assetUrl(value: unknown, mediaKind: AssetMediaKind = 'image'): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (value.startsWith('/api/asset')) {
    const url = new URL(value, 'http://airp.local');
    const assetPath = url.searchParams.get('path');
    return assetPath ? airpGateway.assetUrl(assetPath, undefined, mediaKind) : null;
  }
  return airpGateway.assetUrl(value.replace(/^\/+/, ''), undefined, mediaKind);
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
  onEntityAction,
  onDiceRolled,
  onOpenCharacterModal,
  onItemDropOnTarget,
  onDropItemToScene,
  onTakeItem,
  inactive = false,
  writerLocked = false,
  onRequestInit,
}) => {
  const [state, setState] = useState<LayerState | null>(null);
  const [error, setError] = useState<NookError | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = UI_COPY[locale];

  const nookIdRef = useRef('');
  const stateRef = useRef<LayerState | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  // The initialiser's outcome (docs/init/03 §3.6): clear the ghost. A failure
  // must ALSO be visible — never a silent blank room (contract §8 anti-pattern 8).
  // Scope by layer: `airp:layer-init` also fires for scene inits.
  useEffect(() => {
    const onLayerInit = (event: Event) => {
      const msg = (event as CustomEvent).detail as { event?: { type?: string; layer?: string } } | undefined;
      const ev = msg?.event;
      if (!ev || ev.layer !== nookIdRef.current) return;
      setInitializing(false);
      if (['layer_init_failed'].includes(ev.type ?? '')) setNotice(copy.nookInitFailed);
      else void load(characterId); // success: the refetched furnishing replaces the ghost
    };
    window.addEventListener('airp:layer-init', onLayerInit);
    return () => window.removeEventListener('airp:layer-init', onLayerInit);
  }, [characterId, load, copy.nookInitFailed]);

  const handleMoveCard = useCallback(
    async (path: string, x: number, y: number) => {
      const previous = stateRef.current;
      if (!previous) return;
      const next = {
        ...previous,
        items: previous.items.map(item => item.path === path ? { ...item, x, y } : item),
      };
      stateRef.current = next;
      setState(next);
      if (!onMoveCard) return;
      try {
        await onMoveCard(path, x, y);
        await load(characterId);
      } catch {
        stateRef.current = previous;
        setState(previous);
      }
    },
    [characterId, load, onMoveCard],
  );
  const handleDropItemToScene = useCallback(
    (path: string) => onDropItemToScene?.(path, stateRef.current?.layer),
    [onDropItemToScene],
  );
  const handleEntityAction = useCallback(
    (prompt: string) => onEntityAction?.(prompt, stateRef.current?.layer),
    [onEntityAction],
  );

  /**
   * The one exit of the empty-state prompt (docs/init/03 §3.3/§3.7): Submit and
   * Skip are the same call; `''` means "leave it blank". `onRequestInit` returns
   * false when the socket is down — then keep the prompt up rather than showing a
   * ghost for a request that was never sent.
   */
  const resolveInit = useCallback(
    (text: string) => {
      if (!onRequestInit) return;
      const req = text.trim();
      if (onRequestInit('nook', characterId, req === '' ? undefined : req)) {
        setNotice(null);
        setInitializing(true);
      }
    },
    [onRequestInit, characterId]
  );

  // World changes (writer edits, entity lifecycle, and authoritative card
  // positions) are the Nook's refresh seam; no second WS is created here.
  useEffect(() => {
    const onWorldEvent = (e: Event) => {
      const msg = (e as CustomEvent).detail as {
        type?: string;
        path?: string;
        x?: number;
        y?: number;
        event?: { type?: string };
      } | undefined;
      const eventType = msg?.event?.type ?? msg?.type;
      if (
        eventType === 'file_changed' ||
        ['entity_created', 'entity_edited', 'entity_deleted', 'entity_moved'].includes(eventType ?? '')
      ) {
        void load(characterId);
        return;
      }
      if (
        eventType === 'card_position' &&
        typeof msg?.path === 'string' &&
        typeof msg.x === 'number' &&
        typeof msg.y === 'number'
      ) {
        const current = stateRef.current;
        if (!current || !current.items.some(item => item.path === msg.path)) return;
        const next = {
          ...current,
          items: current.items.map(item => item.path === msg.path ? { ...item, x: msg.x!, y: msg.y! } : item),
        };
        stateRef.current = next;
        setState(next);
      }
    };
    window.addEventListener('airp:world-event', onWorldEvent);
    return () => window.removeEventListener('airp:world-event', onWorldEvent);
  }, [characterId, load]);

  // Footprint channel (02 §3.6): the layer scheduler only knows layer items,
  // so nook cards would never have their measured height written back. This
  // scheduler submits only Nook paths and measures inside this active root;
  // the layer projection is unmounted while Nook is active.
  useEffect(() => {
    const scheduler = createFootprintScheduler({
      layer: () => nookIdRef.current,
      widths: () => new Map((stateRef.current?.items ?? []).map((it) => [it.path, it.w])),
      measure: () => measureHeights(rootRef.current ?? document),
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
      isDragging: () => rootRef.current?.querySelector('.object.dragging-item') !== null,
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
      for (const el of rootRef.current?.querySelectorAll<HTMLElement>('.object[data-path]') ?? []) {
        observer.observe(el);
      }
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
  const avatar = assetUrl(sceneFrontmatter?.avatar, 'image');
  const displayName =
    typeof sceneFrontmatter?.name === 'string' && sceneFrontmatter.name.trim() !== ''
      ? sceneFrontmatter.name
      : characterId;
  const statusLine = statusLineOf(sceneFrontmatter);
  const isEmpty = state !== null && state.items.length === 0 && state.scene === null;
  const canRetry = error !== null && (error.status === 0 || error.status >= 500);

  return (
    <div
      ref={rootRef}
      className="relative w-full h-full overflow-hidden"
      data-nook={characterId}
      data-airp-projection={`nook:${characterId}`}
      data-airp-projection-active="true"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
      aria-label={`Nook projection for ${displayName}`}
    >
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
        /* Empty room (doc-11 §4.1): a room nothing has moved into yet. While an
           initialiser runs, the ghost card occupies the room instead of the
           prompt (docs/init/03 §3.5); otherwise the prompt collects the one-line
           intent — an EMPTY submit is a valid meaning ("leave it blank"). */
        <div className="w-full h-full">
          {initializing ? (
            <Canvas
              currentLayer={state.layer}
              items={[]}
              links={[]}
              bg={state.bg}
              ghost={ghostItemFor(state.layer, copy.nookGenerating)}
              ghostLabel={copy.nookGenerating}
              ghostCopy={{
                reused: copy.ghostReused,
                failed: copy.ghostFailed,
                unreachable: copy.ghostUnreachable,
              }}
              stillPortraits={reduceMotion}
            />
          ) : (
            <>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-8 text-center">
                <div className="font-serif text-lg text-ink/70">{copy.nookEmptyTitle}</div>
                <div className="font-mono text-xs text-ink/50">{copy.nookEmptyBody}</div>
              </div>
              {onRequestInit ? (
                <StubPrompt
                  kind="nook"
                  copy={{
                    label: copy.nookEmptyPrompt,
                    placeholder: copy.nookEmptyHint,
                    skip: copy.nookInitSkip,
                  }}
                  onResolve={resolveInit}
                />
              ) : (
                <WriterBar disabled onSend={() => {}} placeholder={copy.nookEmptyPrompt} sendLabel="⏎" />
              )}
            </>
          )}
          {notice && (
            <div
              role="alert"
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-3 py-2 rounded-lg bg-rust/10 border border-rust/40 font-mono text-[11px] text-ink shadow-soft"
            >
              {notice}
            </div>
          )}
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
          onMoveCard={handleMoveCard}
          onSelectChoice={onSelectChoice}
          onEntityAction={handleEntityAction}
          onDiceRolled={onDiceRolled}
          onOpenCharacterModal={onOpenCharacterModal}
          onDropItemToScene={handleDropItemToScene}
          onItemDropOnTarget={onItemDropOnTarget}
          onTakeItem={onTakeItem}
        />
      ) : null}
      <NookNoteComposer
        characterId={characterId}
        disabled={inactive || writerLocked || state?.worldFrozen === true}
        lockMessage={writerLocked ? 'The writer is working.' : undefined}
      />
    </div>
  );
};
