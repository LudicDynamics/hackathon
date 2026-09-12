import { useCallback, useEffect, useRef, useState } from 'react';
import { invalidateMeasures } from '../lib/measure.js';
import { whenFontsSettled } from '../lib/fonts.js';
import {
  createFootprintScheduler,
  measureHeights,
  type FootprintScheduler,
} from '../lib/footprint.js';
import { CARD_FORMS } from '@airp/shared/forms';
import { register as registerPhantom, land as landPhantom, appendInk, setInk, evict as evictPhantom, reconcileLanded } from '../lib/phantom.js';
import { phantomSeatFor, publishSeatItems } from '../lib/phantom-seat.js';
import { mergeItemPatch, mergeLinkPatch } from '../lib/canvas-patch.js';
import { beginTurn, endTurn, reset as resetWriter } from '../lib/writer-state.js';
import { playFoley, playCharge, endCharge, setAmbient } from '../lib/audio.js';
import { ghostSizeFor, stageText, GHOST_WAIT_AMBIENT } from '../lib/ghost.js';

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
  enterLayer(next: string): void;
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

/** 去重窗口（docs/tools/12 §6.4）：上限 200、FIFO 淘汰。 */
const SEEN_EVENT_LIMIT = 200;

/** world_event 帧载荷（docs/tools/12 §6.3 / packages/shared/src/schemas/events.ts 逐字）。 */
interface WorldEventFrame {
  type: 'world_event';
  event: {
    seq: number;
    id: string;
    projectId: string;
    type: string;
    actor: { type: string; id?: string };
    layer: string | null;
    subject: string | null;
    turn: string | null;
    detail: unknown;
    createdAt: string;
  };
  timestamp: string;
}

export function useWorld(): UseWorldApi {
  const [state, setState] = useState<LayerState | null>(null);
  const [layer, setLayer] = useState<string>(INITIAL_LAYER);
  const [loading, setLoading] = useState<boolean>(true);

  const layerRef = useRef<string>(INITIAL_LAYER);
  const stateRef = useRef<LayerState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reqSeqRef = useRef(0);
  // world_event 去重（docs/tools/12 §6.4）：集合与 FIFO 队列同进同出。
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenEventOrderRef = useRef<string[]>([]);

  // Footprint channel (docs/footprint/03). The busy count is fed by the WS
  // `tool_start`/`tool_end` pair for the writer; the scheduler reads it live.
  const fpRef = useRef<FootprintScheduler | null>(null);
  const writerToolsInFlight = useRef(0);
  const fontsSettledRef = useRef(false);

  const fetchLayer = useCallback(async (target: string) => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/layer?layer=${encodeURIComponent(target)}`);
      if (!res.ok) {
        console.warn('Could not fetch layer:', res.status);
        return;
      }
      const data = await res.json();
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
      // 幻影排座镜像 + 真实卡一到就把对应幻影撤掉（docs/perform/00 §6b-5）。
      publishSeatItems(next.layer, next.items);
      reconcileLanded(next.items.map((it) => it.path));
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
    (next: string) => {
      if (next === layerRef.current) {
        // Same layer: still re-sync (may be an explicit gate re-entry).
        void fetchLayer(next);
        return;
      }
      layerRef.current = next;
      setLayer(next);
      fpRef.current?.reset(next); // drop the previous layer's pending packet
      void fetchLayer(next);
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
      const res = await fetch('/api/card/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, x, y }),
      });
      if (!res.ok) {
        throw new Error(`POST /api/card/position -> ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.warn('moveCard failed, rolling back:', err);
      if (prev) setState(prev);
    }
  }, []);

  const sendToWriter = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'writer_prompt', message: text }));
    }
  }, []);

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const flushFootprints = useCallback(() => {
    fpRef.current?.flushNow();
  }, []);

  /** world_event 去重：首次见到返回 true 并登记，重复返回 false。
   *  纪律「谁消费、谁登记」——本批只有 world_event 一处调用者（02 §3.3.1-(b)）。 */
  const noteWorldEvent = useCallback((id: string): boolean => {
    const seen = seenEventIdsRef.current;
    if (seen.has(id)) return false;
    seen.add(id);
    const order = seenEventOrderRef.current;
    order.push(id);
    if (order.length > SEEN_EVENT_LIMIT) {
      const oldest = order.shift();
      if (oldest !== undefined) seen.delete(oldest);
    }
    return true;
  }, []);

  /** 命中转发集合才派发 airp:world-event（00 §5 / docs/tools/12 §6.6）。 */
  const forwardWorldEvent = useCallback((msg: WorldEventFrame): void => {
    if (
      ['entity_created', 'entity_edited', 'entity_deleted', 'entity_moved'].includes(
        msg.event?.type
      )
    ) {
      window.dispatchEvent(new CustomEvent('airp:world-event', { detail: msg }));
    }
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    // Reconnect guard: a dropped `tool_end` would leave the count stuck > 0, and
    // a lost `writer_idle` would leave the writer input permanently disabled.
    ws.onopen = () => {
      writerToolsInFlight.current = 0;
      resetWriter();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file_changed' || msg.type === 'card_position') {
          // App listens for this to keep its backpack/character views in sync.
          window.dispatchEvent(new CustomEvent('airp:world-event', { detail: msg }));
        }
        switch (msg.type) {
          case 'file_changed':
            void fetchLayer(layerRef.current);
            break;
          case 'world_event':
            // 世界事件（docs/tools/12 §6.3）：先判重，再转发，最后整层重取。
            {
              const ev = msg.event;
              if (!ev || typeof ev.id !== 'string') break; // 畸形帧不污染去重集合
              if (!noteWorldEvent(ev.id)) break; // 同一行的重复副本到此为止
              forwardWorldEvent(msg);
              void fetchLayer(layerRef.current);
            }
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
              setState((s) => {
                if (!s) return s;
                const items = mergeItemPatch(s.items, { path: msg.path, x: msg.x, y: msg.y });
                if (items === s.items) return s;
                const out = { ...s, items: items as LayerItem[] };
                stateRef.current = out; // footprint/moveCard read stateRef as truth
                return out;
              });
            }
            break;
          case 'tool_start':
            if (msg.source === 'writer') writerToolsInFlight.current++;
            break;
          case 'tool_end':
            if (msg.source === 'writer') {
              writerToolsInFlight.current = Math.max(0, writerToolsInFlight.current - 1);
              // 失败也要收笔：撤掉未落地的幻影并归位状态机（docs/perform/01 §7）。
              if (msg.isError === true && typeof msg.toolCallId === 'string') {
                evictPhantom(msg.toolCallId);
                endTurn();
              }
              // The file's stable window opens now → arm one measurement.
              fpRef.current?.notify();
            }
            break;
          case 'character_delta':
          case 'character_message':
          case 'character_idle':
            // 演出帧（docs/tools/12 §6.2）：无条件转给遮罩，不进 world_event 的
            // 去重/重取路径；归属过滤在 App。
            window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));
            break;
          case 'error':
            // 只接角色车道的报错：writer 错误无 characterId，绝不灌进角色遮罩。
            if (msg.source === 'character' && typeof msg.characterId === 'string') {
              window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));
            }
            break;
          // ---- 演出通道（docs/perform/00 §4）----
          case 'chalk_writing': {
            if (msg.source !== 'writer' || typeof msg.toolCallId !== 'string') break;
            const seat = phantomSeatFor(CARD_FORMS.chalk, layerRef.current).seat;
            registerPhantom(msg.toolCallId, {
              kind: 'chalk',
              source: 'writer',
              seat,
              layer: layerRef.current,
            });
            beginTurn('chalk');
            playCharge(0);
            break;
          }
          case 'writer_delta': {
            if (msg.source !== 'writer' || typeof msg.toolCallId !== 'string' || typeof msg.delta !== 'string') break;
            if (msg.mode === 'replace') setInk(msg.toolCallId, msg.delta);
            else appendInk(msg.toolCallId, msg.delta);
            break;
          }
          case 'chalk_landed': {
            if (msg.source !== 'writer' || typeof msg.toolCallId !== 'string') break;
            landPhantom(msg.toolCallId, typeof msg.path === 'string' ? { path: msg.path } : {});
            endCharge();
            playFoley('paper-slide');
            break;
          }
          case 'writer_idle': {
            if (msg.source !== 'writer') break;
            endTurn();
            break;
          }
          case 'dice_result': {
            // 与玩家点击的 /api/dice 同形；交给 App 的仪式层演出。
            window.dispatchEvent(new CustomEvent('airp:dice-frame', { detail: msg }));
            break;
          }
          case 'image_generation_progress': {
            if (typeof msg.toolCallId !== 'string') break;
            const size = ghostSizeFor(msg.width, msg.height);
            registerPhantom(msg.toolCallId, {
              kind: 'image',
              source: 'writer',
              seat: phantomSeatFor(size, layerRef.current).seat,
              layer: layerRef.current,
              label: stageText(msg.stage, msg.elapsedMs),
              elapsedMs: typeof msg.elapsedMs === 'number' ? msg.elapsedMs : undefined,
            });
            setAmbient(GHOST_WAIT_AMBIENT);
            break;
          }
          case 'image_landed': {
            if (typeof msg.toolCallId !== 'string') break;
            landPhantom(msg.toolCallId, {
              asset: typeof msg.asset === 'string' ? msg.asset : undefined,
              reused: msg.reused === true,
            });
            playFoley('crit-chime');
            break;
          }
          case 'canvas_patched': {
            // 帧带 layer：不匹配（或缺失）整帧忽略 —— 作家在别的层摆位不该让当前页抖一下。
            if (typeof msg.layer !== 'string' || msg.layer !== layerRef.current) break;
            if (msg.kind === 'links') {
              if (!Array.isArray(msg.links)) break;
              setState((s) => {
                if (!s) return s;
                const links = mergeLinkPatch(s.links, msg.links, msg.action);
                if (links === s.links) return s;
                const out = { ...s, links: links as LayerLink[] };
                stateRef.current = out;
                return out;
              });
            } else if (msg.kind === 'cards') {
              if (!Array.isArray(msg.cards)) break;
              setState((s) => {
                if (!s) return s;
                let items: readonly LayerItem[] = s.items;
                for (const c of msg.cards) {
                  if (!c || typeof c.path !== 'string') continue;
                  items = mergeItemPatch(items, c as { path: string; x: number; y: number; z?: number });
                }
                if (items === s.items) return s;
                const out = { ...s, items: items as LayerItem[] };
                stateRef.current = out;
                return out;
              });
            } else {
              // 未知 kind 是契约漂移信号 —— 必须看得见（docs/perform/04 §7）。
              console.warn('[canvas_patched] unknown kind', msg.kind);
            }
            break;
          }
          case 'show_frame':
            // 演出库（docs/perform/05）：交给 PerformanceLayer 的分发器。
            window.dispatchEvent(new CustomEvent('airp:show-frame', { detail: msg }));
            break;
          default:
            // agent_event / roll_resolved 等仍在此忽略（docs/tools/12 §6.2）。
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    return () => ws.close();
  }, [fetchLayer, noteWorldEvent, forwardWorldEvent]);

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
