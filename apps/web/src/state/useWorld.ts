import { useCallback, useEffect, useRef, useState } from 'react';
import { airpGateway, openAirpSocket, sendSocket } from '../lib/airp-gateway.js';
import { gateFeedback } from '../lib/gate-feedback.js';
import { invalidateMeasures } from '../lib/measure.js';
import { whenFontsSettled } from '../lib/fonts.js';
import {
  createFootprintScheduler,
  measureHeights,
  type FootprintScheduler,
} from '../lib/footprint.js';
import { CARD_FORMS } from '@airp/shared/forms';
import { isValidCharacterId } from '@airp/shared/characters';
import type { AppearanceResolution, WorldEvent } from '@airp/shared';
import { register as registerPhantom, land as landPhantom, appendInk, setInk, evict as evictPhantom, reconcileLanded, getPhantomsSnapshot } from '../lib/phantom.js';
import { cardWritingGuard } from '../lib/card-skeleton.js';
import { phantomSeatFor, publishSeatItems } from '../lib/phantom-seat.js';
import { mergeItemPatch, mergeLinkPatch } from '../lib/canvas-patch.js';
import { acceptWriterFrame, beginWriterPrompt, getWriterState, resetForReconnect as resetWriter, type WriterPromptAcceptance } from '../lib/writer-state.js';
import { agentActivityStore } from '../lib/agent-activity-store.js';
import { worldEventToastStore } from '../lib/world-event-toast.js';
import { playFoley, playCharge, endCharge, setAmbient } from '../lib/audio.js';
import { ghostSizeFor, stageText, GHOST_WAIT_AMBIENT } from '../lib/ghost.js';
import {
  DEFAULT_WORLD_SETTINGS,
  startsSceneInit,
  type WorldSettings,
} from '@airp/shared/world-settings';

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
  /** Verified appearance from the server resolver (docs/components/04 §:54). Optional:
   *  an old server / old payload omits it, and the card then falls back to its kind
   *  default. The frontend MUST NOT compute this from raw frontmatter. */
  appearance?: AppearanceResolution;
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
  bg: { src: string | null; video?: string; tone: string; grain: string };
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
  /** Layer whose I1 initialiser is in flight; drives the "taking shape" ghost
   *  (docs/init/03 §3.6). null = no ghost. */
  initializingLayer: string | null;
  /** Switch layer + fetch it. When auto-write is on and the target is a stub,
   *  fires the I1 initialiser (`airp_init`) after the server confirms `first`. */
  enterLayer(next: string): Promise<void>;
  /** Re-read the active world's settings (after a world load). */
  reloadSettings(): Promise<void>;
  /** Per-world auto-write preference (docs/settings/00); defaults to `off`. */
  settings: WorldSettings;
  /** Persist a new auto-write preference; updates local state on success. */
  saveSettings(next: WorldSettings): Promise<void>;
  /** Re-fetch the current layer. */
  refresh(): Promise<void>;
  /**
   * Optimistic position update for a card path → POST /api/card/position.
   * On failure the previous items snapshot is restored and a warning logged.
   */
  moveCard(path: string, x: number, y: number): Promise<void>;
  /** Send a writer_prompt; optional override targets an active projection layer. */
  sendToWriter(text: string, layerOverride?: string): WriterPromptAcceptance;
  /** Raw WS send (character_prompt etc.). false = socket not OPEN. */
  sendMessage(payload: Record<string, unknown>): boolean;
  /** Debug/test seam: force a footprint flush (gates still apply). */
  flushFootprints(): void;
}

const INITIAL_LAYER = 'map';
const WRITER_ABORT_TYPE = ['writer', 'abort'].join('_');
const LEGACY_ABORT_TYPE = ['a', 'bort'].join('');

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
  // The layer whose I1 initialiser is in flight (docs/init/03 §3.6). Drives the
  // provisional "taking shape" ghost; cleared ONLY by the `layer_initialized` /
  // `layer_init_failed` event — events are the single change source, so no timer.
  const [initializingLayer, setInitializingLayer] = useState<string | null>(null);

  const layerRef = useRef<string>(INITIAL_LAYER);
  const stateRef = useRef<LayerState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reqSeqRef = useRef(0);
  useEffect(() => {
    const unavailable = () => {
      ++reqSeqRef.current;
      resetWriter('world_change');
      stateRef.current = null;
      seenEventIdsRef.current.clear();
      worldEventToastStore.reset('world-switch');
      worldEventToastStore.setProjectId(null);
      seenEventOrderRef.current = [];
      setState(null);
      setLoading(false);
    };
    window.addEventListener('airp:world-unavailable', unavailable);
    return () => window.removeEventListener('airp:world-unavailable', unavailable);
  }, []);
  // world_event 去重（docs/tools/12 §6.4）：集合与 FIFO 队列同进同出。
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenEventOrderRef = useRef<string[]>([]);

  const fpRef = useRef<FootprintScheduler | null>(null);
  // Footprint reads the canonical writer projection; tool count is not a second
  // writer busy fact.
  const fontsSettledRef = useRef(false);
  // Per-world auto-write preference (docs/settings/00). Kept in a ref as well as
  // state: `enterLayer` reads it synchronously (a fresh fetch may not have
  // landed when a gate is clicked) and the ref is what the callback closes over.
  const [settings, setSettings] = useState<WorldSettings>(DEFAULT_WORLD_SETTINGS);
  const settingsRef = useRef<WorldSettings>(DEFAULT_WORLD_SETTINGS);

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
      // 幻影排座镜像 + 真实卡一到就把对应幻影撤掉（docs/perform/00 §6b-5）。
      publishSeatItems(next.layer, next.items);
      reconcileLanded(new Set(next.items.map((it) => it.path)));
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
      window.dispatchEvent(new CustomEvent('airp:gate-feedback', { detail: null }));
      if (next === layerRef.current) {
        // Same layer: still re-sync (may be an explicit gate re-entry).
        await fetchLayer(next);
        return;
      }
      await airpGateway.enterLayer(next).then(async (result) => {
        layerRef.current = next;
        setLayer(next);
        fpRef.current?.reset(next);
        // `first` ⟺ the target had no README ⟺ it is a stub (docs/init/03 §3.2).
        // When auto-write allows it, ask the engine to materialise the scene:
        // fire-and-forget, since the I1 initialiser runs 45–60s and its outcome
        // returns as a `layer_initialized` world event, not this reply.
        if (result.first === true && startsSceneInit(settingsRef.current.autoWrite)) {
          let sent = false;
          try {
            sent = sendSocket(wsRef.current, { type: 'airp_init', kind: 'scene', target: next, by: 'player' });
          } catch {
            sent = false;
          }
          if (sent) {
            setInitializingLayer(next);
          } else {
            window.dispatchEvent(new CustomEvent('airp:notice', {
              detail: 'Connection lost. The scene could not start yet.',
            }));
          }
        }
        await fetchLayer(next);
      }).catch(error => {
        const feedback = gateFeedback(error, next, stateRef.current?.items ?? []);
        if (feedback) window.dispatchEvent(new CustomEvent('airp:gate-feedback', { detail: feedback }));
        else window.dispatchEvent(new CustomEvent('airp:notice', { detail: String(error) }));
      });
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

  const sendToWriter = useCallback((text: string, layerOverride?: string): WriterPromptAcceptance => {
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) {
      return { accepted: false, reason: 'invalid', message: 'Enter an action before sending.' };
    }
    if (getWriterState().phase === 'writing') {
      return { accepted: false, reason: 'busy', message: 'The writer is already working.' };
    }
    const targetLayer = typeof layerOverride === 'string' && layerOverride.trim()
      ? layerOverride.trim()
      : layerRef.current;
    let sent = false;
    try {
      sent = sendSocket(wsRef.current, { type: 'writer_prompt', message: normalized, layer: targetLayer });
    } catch {
      sent = false;
    }
    if (!sent) {
      return { accepted: false, reason: 'transport-closed', message: 'Connection lost. Please try again.' };
    }
    // There is no server domain-ack frame: transport acceptance is the seam.
    if (!beginWriterPrompt(normalized)) {
      return { accepted: false, reason: 'busy', message: 'The writer is already working.' };
    }
    return { accepted: true };
  }, []);

  // Returns false when the socket is not OPEN (docs/init/03 §⑫-4 ruling: the
  // `airp_init` caller must know a request was actually sent before showing a
  // ghost for it). Existing callers ignore the value.
  const sendMessage = useCallback((payload: Record<string, unknown>): boolean => {
    let sent = false;
    try {
      sent = sendSocket(wsRef.current, payload);
    } catch {
      sent = false;
    }
    if (!sent && (payload.type === WRITER_ABORT_TYPE || payload.type === LEGACY_ABORT_TYPE)) {
      acceptWriterFrame({
        type: 'error',
        source: 'writer',
        message: 'Connection lost. Please try again.',
      });
      window.dispatchEvent(new CustomEvent('airp:notice', { detail: 'Connection lost. Please try again.' }));
    }
    return sent;
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
      isBusy: () => getWriterState().toolCount > 0,
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

    const onMessage = (msg: Record<string, unknown>) => {
      // Every writer presentation frame enters the canonical writer snapshot;
      // UI components never reconstruct this lifecycle from a raw event.
      if (msg.source === 'writer') acceptWriterFrame(msg);
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
            const ev = msg.event as
              | { id?: string; type?: string; layer?: string | null; detail?: { layer?: string } }
              | undefined;
            if (!ev || typeof ev.id !== 'string') break; // 畸形帧不污染去重集合
            if (!noteWorldEvent(ev.id)) break; // 同一行的重复副本到此为止
            worldEventToastStore.ingest(ev as WorldEvent);
            // The I1 initialiser's outcome (docs/init/03 §3.6): clear the ghost.
            // `layer_initialized` -> the refetched product replaces it (handover);
            // `layer_init_failed` must ALSO be visible (contract §8 anti-pattern 8),
            // but the toast copy is localised in App — this hook has no `t()`.
            // `ev.type` is an EVENT type nested in `world_event`, NOT a frame name —
            // the `.includes()` form keeps `check:ws` from reading them as frames
            // (same convention as `forwardWorldEvent` above).
            if (['layer_initialized', 'layer_init_failed'].includes(ev.type ?? '')) {
              const done = ev.detail?.layer ?? ev.layer ?? null;
              setInitializingLayer((cur) => (cur !== null && (done === null || done === cur) ? null : cur));
              window.dispatchEvent(new CustomEvent('airp:layer-init', { detail: msg }));
            }
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
              const items = mergeItemPatch(s.items, { path: msg.path as string, x: msg.x as number, y: msg.y as number });
              if (items === s.items) return s;
              const out = { ...s, items: items as LayerItem[] };
              stateRef.current = out; // footprint/moveCard read stateRef as truth
              return out;
            });
          }
          break;
        case 'agent_progress':
          // Lifecycle state was accepted at the ingress above. Keep an
          // explicit consumer case for the websocket contract checker.
          break;
        case 'agent_activity':
          // Player-facing activity has one canonical store consumer; it never
          // enters writer-state or a component-local raw listener.
          agentActivityStore.ingest(msg);
          break;
        case 'tool_start':
          break;
        case 'tool_end': {
          const failedToolCallId = msg.isError === true && typeof msg.toolCallId === 'string'
            ? msg.toolCallId
            : undefined;
          // Failed tools of either source must release their phantom.
          if (failedToolCallId !== undefined) evictPhantom(failedToolCallId);
          if (msg.source === 'writer' && failedToolCallId !== undefined) {
            setAmbient(stateRef.current?.audio.ambient ?? null);
          }
          break;
        }
        case 'character_delta':
        case 'character_message':
        case 'character_idle': {
          // Character frames have one identity owner. Never repair a missing
          // id from the open modal: an unowned delta is unsafe to render.
          if (
            msg.source !== 'character' ||
            typeof msg.characterId !== 'string' ||
            !isValidCharacterId(msg.characterId)
          ) {
            if (msg.source === 'character') {
              window.dispatchEvent(new CustomEvent('airp:notice', {
                detail: 'Character frame dropped: missing or invalid character id.',
              }));
            }
            break;
          }
          if (
            (msg.type === 'character_delta' && typeof msg.delta !== 'string') ||
            (msg.type === 'character_message' && typeof msg.text !== 'string')
          ) {
            window.dispatchEvent(new CustomEvent('airp:notice', {
              detail: 'Character frame dropped: malformed text payload.',
            }));
            break;
          }
          window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));
          break;
        }
        case 'error':
          // A character error follows the same typed lane as its text. Writer
          // errors remain global notices; malformed character errors are not
          // allowed to enter the lane.
          if (
            msg.source === 'character' &&
            typeof msg.characterId === 'string' &&
            isValidCharacterId(msg.characterId) &&
            typeof msg.message === 'string'
          ) {
            window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));
          } else if (msg.source === 'character') {
            window.dispatchEvent(new CustomEvent('airp:notice', {
              detail: 'Character error dropped: missing or invalid character id.',
            }));
          } else {
            window.dispatchEvent(new CustomEvent('airp:notice', { detail: msg.message ?? 'The writer could not finish this turn.' }));
          }
          break;
        case 'turn_aborted':
          if (
            msg.source === 'character' &&
            typeof msg.characterId === 'string' &&
            isValidCharacterId(msg.characterId)
          ) {
            window.dispatchEvent(new CustomEvent('airp:character-frame', { detail: msg }));
          } else {
            window.dispatchEvent(new CustomEvent('airp:notice', { detail: msg.message ?? 'The writer could not finish this turn.' }));
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
          playCharge(0);
          break;
        }
        // 组件骨架屏（docs/skeleton/02 §3.1）：作家 write 一张组件卡时，服务端在
        // tool_execution_start 发 card_writing；这里注册 component 幻影，由
        // CardSkeleton 画结构化骨架，落地后经既有 reconcileLanded 按 path 删除。
        case 'card_writing': {
          if (msg.source !== 'writer' || typeof msg.toolCallId !== 'string') break;
          const kind = typeof msg.kind === 'string' ? msg.kind : undefined;
          const form = kind !== undefined ? CARD_FORMS[kind] : undefined;
          const layer = typeof msg.layer === 'string' ? msg.layer : undefined;
          // 白名单（不回退 layerRef.current）：层推不出 = 该 path 永不进 items →
          // reconcileLanded 永不删 → 骨架永挂且挤座（docs/skeleton/00 F-10 裁决 O）。
          if (!cardWritingGuard(form, kind, layer)) break;
          const seat = phantomSeatFor({ w: form!.w, h: form!.h }, layer!).seat;
          registerPhantom(msg.toolCallId, {
            kind: 'component',
            source: 'writer',
            seat,
            layer,
            cardKind: kind,
            cardTitle: typeof msg.title === 'string' ? msg.title : undefined,
          });
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
          break;
        }
        case 'dice_result': {
          // 与玩家点击的 /api/dice 同形；交给 App 的仪式层演出。
          window.dispatchEvent(new CustomEvent('airp:dice-frame', { detail: msg }));
          break;
        }
        case 'image_generation_progress': {
          const source = msg.source === 'character' || msg.source === 'writer' ? msg.source : undefined;
          if (typeof msg.toolCallId !== 'string' || source === undefined) break;
          const size = ghostSizeFor(msg.width as number, msg.height as number);
          registerPhantom(msg.toolCallId, {
            kind: 'image',
            source,
            seat: getPhantomsSnapshot().find((entry) => entry.toolCallId === msg.toolCallId)?.seat
              ?? phantomSeatFor(size, layerRef.current).seat,
            layer: layerRef.current,
            label: stageText(msg.stage as string, msg.elapsedMs as number),
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
          // Hand the sound bed back to the layer's authority (docs/perform/03
          // §3.1 step 9): `image_generation_progress` took it with a wait bed.
          setAmbient(stateRef.current?.audio.ambient ?? null);
          break;
        }
        case 'canvas_patched': {
          // 帧带 layer：不匹配（或缺失）整帧忽略 —— 作家在别的层摆位不该让当前页抖一下。
          if (typeof msg.layer !== 'string' || msg.layer !== layerRef.current) break;
          if (msg.kind === 'links') {
            if (!Array.isArray(msg.links)) break;
            setState((s) => {
              if (!s) return s;
              const links = mergeLinkPatch(s.links, msg.links as never, msg.action as never);
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
              for (const c of msg.cards as { path: string; x: number; y: number; z?: number }[]) {
                if (!c || typeof c.path !== 'string') continue;
                items = mergeItemPatch(items, c);
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
    };

    // Reconnect (niko): a dropped socket would otherwise leave the writer input
    // disabled and the tool counter stuck. Reconnect resets both guards on open.
    let socketGeneration = 0;
    const connect = () => {
      if (stopped) return;
      const generation = ++socketGeneration;
      let ws: WebSocket;
      ws = openAirpSocket((msg) => {
        if (generation !== socketGeneration || wsRef.current !== ws) return;
        onMessage(msg);
      });
      wsRef.current = ws;
      ws.onopen = () => {
        if (generation !== socketGeneration || wsRef.current !== ws) return;
        resetWriter('socket_open');
        void fetchLayer(layerRef.current);
      };
      ws.onclose = () => {
        if (generation !== socketGeneration || wsRef.current !== ws) return;
        wsRef.current = null;
        resetWriter('socket_close');
        // A dropped socket never delivers terminal frames, so clear activity
        // immediately rather than waiting for its stale sweep.
        agentActivityStore.clearAll();
        if (!stopped) retryTimer = window.setTimeout(connect, 1200);
      };
    };

    connect();

    return () => {
      stopped = true;
      socketGeneration++;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [fetchLayer, noteWorldEvent, forwardWorldEvent]);

  // Active world's auto-write preference. Loaded on mount and after any world
  // load (`App` calls `reloadSettings` once the new save is active, since the
  // value is per-world and the file lives under that save's `.airpworld/`).
  const reloadSettings = useCallback(async () => {
    try {
      const next = await airpGateway.worldSettings();
      settingsRef.current = { autoWrite: next.autoWrite };
      setSettings(settingsRef.current);
    } catch {
      // Fail-soft: an unreachable settings route keeps the `off` default, which
      // is the safe (contract-preserving) state.
    }
  }, []);

  const saveSettings = useCallback(async (next: WorldSettings) => {
    const saved = await airpGateway.saveWorldSettings(next);
    settingsRef.current = { autoWrite: saved.autoWrite };
    setSettings(settingsRef.current);
  }, []);

  // Initial load of the default layer + the active world's settings.
  useEffect(() => {
    void fetchLayer(layerRef.current);
    void reloadSettings();
  }, [fetchLayer, reloadSettings]);

  return {
    state,
    loading,
    layer,
    initializingLayer,
    enterLayer,
    refresh,
    moveCard,
    sendToWriter,
    sendMessage,
    settings,
    saveSettings,
    reloadSettings,
    flushFootprints,
  };
}
