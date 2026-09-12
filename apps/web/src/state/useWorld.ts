import { useCallback, useEffect, useRef, useState } from 'react';
import { airpGateway, openAirpSocket, sendSocket } from '../lib/airp-gateway.js';
import { invalidateMeasures } from '../lib/measure.js';
import { whenFontsSettled } from '../lib/fonts.js';
import { createFootprintScheduler, measureHeights, type FootprintScheduler } from '../lib/footprint.js';

export interface LayerItem {
  path: string;
  filename: string;
  kind: string;
  frontmatter: Record<string, any> | null;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rot: number;
}

export interface LayerLink {
  id: string;
  from: string;
  to: string;
  style: string;
  label: string | null;
}

export interface PresenceEntry {
  characterId: string;
  x: number;
  y: number;
  following: boolean;
}

export interface LayerState {
  layer: string;
  scene: LayerItem | null;
  bg: { src: string | null; tone: string; grain: string };
  audio: { ambient: string | null; bgm: string | null };
  items: LayerItem[];
  links: LayerLink[];
  presence: PresenceEntry[];
  worldFrozen: boolean;
}

export interface UseWorldApi {
  /** Latest layer payload; null until the first fetch lands. */
  state: LayerState | null;
  /** True while a layer fetch is in flight. */
  loading: boolean;
  /** The layer currently being shown (reactive; src of truth for layer). */
  layer: string;
  /** Switch layer + fetch it (WS subscriptions stay bound to the layer). */
  enterLayer(next: string): Promise<void>;
  /** Re-fetch the current layer. */
  refresh(): Promise<void>;
  /**
   * Optimistic position update for a card path → POST /api/card/position.
   * On failure the previous items snapshot is restored and a warning logged.
   */
  moveCard(path: string, x: number, y: number): Promise<void>;
  /** Send a writer_prompt WS message (choices / free input). */
  sendToWriter(text: string): void;
  /** Raw WS send (character_prompt etc.). */
  sendMessage(payload: Record<string, unknown>): void;
  /** Debug/test seam: force a footprint flush (gates still apply). */
  flushFootprints(): void;
}

const INITIAL_LAYER = 'map';

export function useWorld(): UseWorldApi {
  const [state, setState] = useState<LayerState | null>(null);
  const [layer, setLayer] = useState<string>(INITIAL_LAYER);
  const [loading, setLoading] = useState<boolean>(true);

  const layerRef = useRef<string>(INITIAL_LAYER);
  const stateRef = useRef<LayerState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reqSeqRef = useRef(0);

  // Footprint channel (docs/footprint/03). The busy count is fed by the WS
  // `tool_start`/`tool_end` pair for the writer; the scheduler reads it live.
  const fpRef = useRef<FootprintScheduler | null>(null);
  const writerToolsInFlight = useRef(0);
  const fontsSettledRef = useRef(false);

  const fetchLayer = useCallback(async (target: string) => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    try {
      const data = await airpGateway.layer<any>(target);
      if (seq !== reqSeqRef.current) return; // stale response (layer switched meanwhile)
      const next: LayerState = {
        layer: data.layer,
        scene: data.scene ?? null,
        bg: data.bg ?? { src: null, tone: 'warm', grain: 'parchment' },
        audio: data.audio ?? { ambient: null, bgm: null },
        items: Array.isArray(data.items) ? data.items : [],
        links: Array.isArray(data.links) ? data.links : [],
        presence: Array.isArray(data.presence) ? data.presence : [],
        worldFrozen: data.worldFrozen === true,
      };
      stateRef.current = next;
      setState(next);
    } catch (err) {
      console.warn('Could not fetch layer:', err);
    } finally {
      if (seq === reqSeqRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchLayer(layerRef.current);
  }, [fetchLayer]);

  const enterLayer = useCallback(
    async (next: string) => {
      if (next === layerRef.current) {
        // Same layer: still re-sync (may be an explicit gate re-entry).
        await fetchLayer(next);
        return;
      }
      await airpGateway.enterLayer(next).then(async () => {
        layerRef.current = next;
        setLayer(next);
        fpRef.current?.reset(next);
        await fetchLayer(next);
      }).catch(error => window.dispatchEvent(new CustomEvent('airp:notice', { detail: String(error) })));
    },
    [fetchLayer]
  );

  const moveCard = useCallback(async (path: string, x: number, y: number) => {
    const prev = stateRef.current;
    // Optimistic merge; identical to what the card_position broadcast will say.
    setState((s) =>
      s
        ? {
            ...s,
            items: s.items.map((it) => (it.path === path ? { ...it, x, y } : it)),
          }
        : s
    );
    try {
      await airpGateway.moveCard(path, x, y);
    } catch (err) {
      console.warn('moveCard failed, rolling back:', err);
      if (prev) setState(prev);
    }
  }, []);

  const sendToWriter = useCallback((text: string) => {
    if (!sendSocket(wsRef.current, { type: 'writer_prompt', message: text, layer: layerRef.current })) {
      window.dispatchEvent(new CustomEvent('airp:notice', { detail: 'Connection lost. Please try again.' }));
    }
  }, []);

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    sendSocket(wsRef.current, payload);
  }, []);

  const flushFootprints = useCallback(() => {
    fpRef.current?.flushNow();
  }, []);

  // The reporter is created ONCE and lives off refs: it needs the live layer and
  // the live items, not the ones captured at mount (03 §8.2).
  useEffect(() => {
    const scheduler = createFootprintScheduler({
      layer: () => layerRef.current,
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
        // The stored box is now the measured one: drop the local cache so the
        // drag collision sees the same value this cycle (contract §5.4).
        invalidateMeasures();
        return { updated: Number(data.updated) || 0, unchanged: Number(data.unchanged) || 0 };
      },
      // Raw count only: the scheduler owns the stale-counter (30s) guard and
      // its single warning, so there is exactly one place that decides.
      isBusy: () => writerToolsInFlight.current > 0,
      isDragging: () => document.querySelector('.object.dragging-item') !== null,
    });
    fpRef.current = scheduler;
    return () => {
      scheduler.dispose();
      fpRef.current = null;
    };
  }, []);

  // Per-card ResizeObserver: a card's height changes when its CONTENT does —
  // dragging only writes left/top, so it never fires here (03 F2). Remounted
  // per payload so newly added shells are observed and detached ones dropped.
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    // Gate ① covers this path too: an initial observe callback still fires
    // while the fallback font is in place, so nothing is armed until the fonts
    // settle (`fontsSettledRef` below flips it and arms the first pass).
    const observer = new ResizeObserver(() => {
      if (fontsSettledRef.current) fpRef.current?.notify();
    });
    frame = requestAnimationFrame(() => {
      if (disposed) return;
      for (const el of document.querySelectorAll('.object[data-path]')) observer.observe(el);
      // First measurement waits for web fonts: font metrics decide wrapping
      // (355px → 291px on the same paragraph, contract §3.5).
      if (fontsSettledRef.current) {
        fpRef.current?.notify();
        return;
      }
      void whenFontsSettled().then((outcome) => {
        if (outcome === 'timeout') {
          console.warn('[footprint] fonts did not settle in time; heights may be off');
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

  // WebSocket: world event → refresh; freeze flag → state; card_position → merge.
  useEffect(() => {
    let stopped = false;
    let retryTimer: number | null = null;
    let ws: WebSocket | null = null;

    const onMessage = (msg: Record<string, unknown>) => {
      if (
        msg.type === 'file_changed' ||
        msg.type === 'world_event' ||
        msg.type === 'item_moved' ||
        msg.type === 'god_action'
      ) {
        window.dispatchEvent(new CustomEvent('airp:world-event', { detail: msg }));
      }
      switch (msg.type) {
        case 'error':
        case 'turn_aborted':
          window.dispatchEvent(new CustomEvent('airp:notice', { detail: msg.message ?? 'The writer could not finish this turn.' }));
          break;
        case 'image_generation_progress':
          window.dispatchEvent(new CustomEvent('airp:notice', { detail: 'Painting the scene… You can keep exploring.' }));
          break;
        case 'file_changed':
        case 'world_event':
        case 'item_moved':
        case 'god_action':
          void fetchLayer(layerRef.current);
          break;
        case 'world_frozen':
          setState((s) => (s ? { ...s, worldFrozen: true } : s));
          break;
        case 'world_thawed':
          setState((s) => (s ? { ...s, worldFrozen: false } : s));
          break;
        case 'card_position':
          if (
            typeof msg.path === 'string' &&
            typeof msg.x === 'number' &&
            typeof msg.y === 'number'
          ) {
            setState((s) =>
              s
                ? {
                    ...s,
                    items: s.items.map((it) =>
                      it.path === msg.path ? { ...it, x: msg.x as number, y: msg.y as number } : it
                    ),
                  }
                : s
            );
          }
          break;
        case 'tool_start':
          if (msg.source === 'writer') writerToolsInFlight.current++;
          break;
        case 'tool_end':
          if (msg.source === 'writer') { writerToolsInFlight.current = Math.max(0, writerToolsInFlight.current - 1); fpRef.current?.notify(); }
          break;
        default:
          break;
      }
    };

    const connect = () => {
      if (stopped) return;
      ws = openAirpSocket(onMessage);
      wsRef.current = ws;
      ws.onopen = () => { writerToolsInFlight.current = 0; void fetchLayer(layerRef.current); };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!stopped) retryTimer = window.setTimeout(connect, 1200);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, [fetchLayer]);

  // Initial load of the default layer.
  useEffect(() => {
    void fetchLayer(layerRef.current);
  }, [fetchLayer]);

  return {
    state,
    loading,
    layer,
    enterLayer,
    refresh,
    moveCard,
    sendToWriter,
    sendMessage,
    flushFootprints,
  };
}
