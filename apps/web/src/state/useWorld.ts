import { useCallback, useEffect, useRef, useState } from 'react';
import { airpGateway, openAirpSocket, sendSocket } from '../lib/airp-gateway.js';

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

  const fetchLayer = useCallback(async (target: string) => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    try {
      const data = await airpGateway.layer<any>(target);
      if (seq !== reqSeqRef.current) return; // stale response (layer switched meanwhile)
      const next: LayerState = {
        layer: data.layer,
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
        default:
          break;
      }
    };

    const connect = () => {
      if (stopped) return;
      ws = openAirpSocket(onMessage);
      wsRef.current = ws;
      ws.onopen = () => void fetchLayer(layerRef.current);
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
  };
}
