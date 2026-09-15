import type { WorldSettings } from '@airp/shared/world-settings';
import type {
  ChooseOptionDetails,
  EnterLayerDetails,
  MoveEntityDetails,
  UseItemOnDetails,
} from '@airp/shared';
// Subpath import, NOT the root barrel: the barrel pulls in `node:crypto`
// (`schemas/canvas.ts`) and breaks the browser build. Same convention as
// `@airp/shared/forms` / `@airp/shared/characters` (docs/gateway/01 §5).
import { PROTOCOL_VERSION } from '@airp/shared/protocol';
export type AssetMediaKind = 'image' | 'video' | 'audio';

export interface WorldShelf {
  /** Shipped edition template ids only (experimental sandboxes excluded). */
  templates: string[];
  /** Experimental sandbox template ids (`world.json` `exp: true`). */
  expTemplates?: string[];
  worlds: string[];
  groups?: {
    id: string;
    name: string;
    templatePath: string | null;
    /** Launcher cover URL (`/api/worlds/cover`); templates only. */
    cover?: string | null;
    /** Launcher video URL; templates with an intro video only. */
    coverVideo?: string | null;
    locale?: string | null;
    description?: string;
    /** Experimental sandbox (`world.json` `exp: true`), not a shipped edition. */
    exp?: boolean;
    saves: { id: string; path: string; updatedAt: string; active: boolean }[];
  }[];
}

export interface WorldLoadResult<TManifest = Record<string, unknown>> {
  ok: boolean;
  manifest: TManifest;
  path: string;
}

export class AirpRequestError extends Error {
  constructor(message: string, public status: number, public payload: Record<string, unknown> | null) {
    super(message);
    this.name = 'AirpRequestError';
  }
}

// `no_active_world` is a durable state, not a one-shot moment: the initial
// `loadChromeData` can resolve before the App's listener registers (a StrictMode
// remount or a slow first paint opens that gap), and a lost signal strands the
// player on a blank canvas while the backend only needs a world chosen. Record
// the state here and replay it to late subscribers (docs/ux/03 §6: release the
// input lock and make the world shelf topmost).
let worldUnavailable = false;
const worldUnavailableListeners = new Set<() => void>();

/**
 * Observe the "no active world" state. When a world-scoped reply has already
 * answered `no_active_world`, the listener runs immediately so a late
 * subscriber cannot miss it. Returns an unsubscribe function.
 */
export function onWorldUnavailable(listener: () => void): () => void {
  worldUnavailableListeners.add(listener);
  if (worldUnavailable) listener();
  return () => { worldUnavailableListeners.delete(listener); };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text();
    let payload: Record<string, unknown> | null = null;
    try { payload = JSON.parse(message); } catch { /* Keep non-JSON diagnostics. */ }
    if (payload?.code === 'no_active_world') {
      worldUnavailable = true;
      // `useWorld` and the live-call forwarder still consume the DOM event.
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('airp:world-unavailable'));
      for (const listener of worldUnavailableListeners) listener();
    }
    throw new AirpRequestError(`${init?.method ?? 'GET'} ${url} -> ${response.status}${message ? ` ${message}` : ''}`, response.status, payload);
  }
  return response.json() as Promise<T>;
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

// World-relative filenames are not globally unique. Rotate the asset namespace
// after a successful world load, including re-opening the same world/template.
let assetSession = `${Date.now()}-0`;
let assetGeneration = 0;

export const airpGateway = {
  worlds: () => request<WorldShelf>('/api/worlds'),
  manifest: <TManifest = Record<string, unknown>>() => request<TManifest>('/api/manifest'),
  deleteSave: (worldPath: string) => request<{ ok: boolean; recoveryPath: string }>('/api/worlds/save', json('DELETE', { worldPath })),
  loadWorld: async <TManifest = Record<string, unknown>>(worldPath: string) => {
    const result = await request<WorldLoadResult<TManifest>>('/api/worlds/load', json('POST', { worldPath }));
    if (result.ok) {
      worldUnavailable = false;
      assetSession = `${Date.now()}-${++assetGeneration}`;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('airp:gate-feedback', { detail: null }));
    }
    return result;
  },
  move: (from: string, to: string, signal?: AbortSignal) =>
    request<MoveEntityDetails>('/api/move', { ...json('POST', { from, to }), signal }),
  choose: (path: string, choice: string | number, signal?: AbortSignal) =>
    request<ChooseOptionDetails | { action: Record<string, unknown> }>('/api/choice', { ...json('POST', { path, choice }), signal }),
  layer: <TLayer = Record<string, unknown>>(layer: string, signal?: AbortSignal) =>
    request<TLayer>(`/api/layer?layer=${encodeURIComponent(layer)}`, { signal }),
  backpack: <TItems = unknown[]>() => request<{ items: TItems }>('/api/backpack'),
  characters: <TCharacters = unknown[]>() =>
    request<{ characters: TCharacters }>('/api/characters'),
  // `first` = the target layer had no README (a stub) — the auto-init signal
  // (docs/init/03 §3.2). The server decides it; the client only reads it.
  // `followers` is the carry-along settlement (docs/presence/00 §2.3 / P-10):
  // a character left behind must be visible, never silent.
  enterLayer: (layer: string, signal?: AbortSignal) =>
    request<{ ok: boolean } & EnterLayerDetails>('/api/enter-layer', { ...json('POST', { layer }), signal }),
  // Terminal state, not a toggle (docs/tools/05 §3.6.1): the UI inverts, the
  // action writes. Registered in tools/check-request-bodies.mjs.
  setFollowing: (character: string, following: boolean) =>
    request('/api/following', json('POST', { character, following })),
  worldSettings: () => request<WorldSettings>('/api/world-settings'),
  saveWorldSettings: (settings: WorldSettings) =>
    request<WorldSettings>('/api/world-settings', json('POST', settings)),
  moveCard: (path: string, x: number, y: number, signal?: AbortSignal) =>
    request<Record<string, unknown>>('/api/card/position', { ...json('POST', { path, x, y }), signal }),
  // Frozen request bodies (docs/wiring/00 §6): the server reads `path` only;
  // rollType/expect are parsed server-side from frontmatter.
  rollDice: (path: string) =>
    request<{ ok: boolean; result: number; passed: boolean }>(
      '/api/dice',
      json('POST', { path }),
    ),
  // Server reads `{ item, target }` (docs/tools/12:182).
  useItem: (item: string, target: string, signal?: AbortSignal) =>
    request<UseItemOnDetails>('/api/use-item', { ...json('POST', { item, target }), signal }),
  toggleFreeze: () => request<{ worldFrozen: boolean }>('/api/freeze', json('POST')),
  // Server reads `path` (docs/tools/12:1403).
  godAction: (action: 'create' | 'update' | 'delete', path: string, content?: string) =>
    request('/api/god-action', json('POST', { action, path, content })),
  assetUrl: (
    path: string,
    session: string | undefined,
    mediaKind: AssetMediaKind,
  ) =>
    `/api/asset?path=${encodeURIComponent(path)}&kind=${mediaKind}&session=${encodeURIComponent(session ?? assetSession)}`,
};

export function openAirpSocket(onMessage: (message: Record<string, unknown>) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // The version gate MUST land in the same commit as the server's (docs/gateway
  // 03 §9.1): an old backend ignores the extra query harmlessly, but a new
  // backend without this closes every client with 4400.
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws?v=${PROTOCOL_VERSION}`);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as Record<string, unknown>);
    } catch (error) {
      console.error('Could not parse AIRP WebSocket message:', error);
    }
  };
  return socket;
}

export function sendSocket(socket: WebSocket | null, payload: Record<string, unknown>): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}
