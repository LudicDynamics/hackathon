import type { WorldSettings } from '@airp/shared/world-settings';

export interface WorldShelf {
  templates: string[];
  worlds: string[];
  groups?: { id: string; name: string; templatePath: string | null; saves: { id: string; path: string; updatedAt: string; active: boolean }[] }[];
}

export interface WorldLoadResult<TManifest = Record<string, unknown>> {
  ok: boolean;
  manifest: TManifest;
  path: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${init?.method ?? 'GET'} ${url} -> ${response.status}${message ? ` ${message}` : ''}`);
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
  deleteSave: (worldPath: string) => request<{ ok: boolean; recoveryPath: string }>('/api/worlds/save', json('DELETE', { worldPath })),
  loadWorld: async <TManifest = Record<string, unknown>>(worldPath: string) => {
    const result = await request<WorldLoadResult<TManifest>>('/api/worlds/load', json('POST', { worldPath }));
    if (result.ok) assetSession = `${Date.now()}-${++assetGeneration}`;
    return result;
  },
  manifest: <TManifest = Record<string, unknown>>() => request<TManifest>('/api/manifest'),
  layer: <TLayer = Record<string, unknown>>(layer: string, signal?: AbortSignal) =>
    request<TLayer>(`/api/layer?layer=${encodeURIComponent(layer)}`, { signal }),
  backpack: <TItems = unknown[]>() => request<{ items: TItems }>('/api/backpack'),
  characters: <TCharacters = unknown[]>() =>
    request<{ characters: TCharacters }>('/api/characters'),
  move: (from: string, to: string) => request('/api/move', json('POST', { from, to })),
  choose: (path: string, choice: string) => request('/api/choice', json('POST', { path, choice })),
  // `first` = the target layer had no README (a stub) — the auto-init signal
  // (docs/init/03 §3.2). The server decides it; the client only reads it.
  enterLayer: (layer: string) =>
    request<{ ok: boolean; layer: string; name: string; first: boolean }>(
      '/api/enter-layer',
      json('POST', { layer }),
    ),
  worldSettings: () => request<WorldSettings>('/api/world-settings'),
  saveWorldSettings: (settings: WorldSettings) =>
    request<WorldSettings>('/api/world-settings', json('POST', settings)),
  moveCard: (path: string, x: number, y: number) =>
    request('/api/card/position', json('POST', { path, x, y })),
  // Frozen request bodies (docs/wiring/00 §6): the server reads `path` only;
  // rollType/expect are parsed server-side from frontmatter.
  rollDice: (path: string) =>
    request<{ ok: boolean; result: number; passed: boolean }>(
      '/api/dice',
      json('POST', { path }),
    ),
  // Server reads `{ item, target }` (docs/tools/12:182).
  useItem: (item: string, target: string) =>
    request('/api/use-item', json('POST', { item, target })),
  toggleFreeze: () => request<{ worldFrozen: boolean }>('/api/freeze', json('POST')),
  // Server reads `path` (docs/tools/12:1403).
  godAction: (action: 'create' | 'update' | 'delete', path: string, content?: string) =>
    request('/api/god-action', json('POST', { action, path, content })),
  assetUrl: (path: string) => `/api/asset?path=${encodeURIComponent(path)}&session=${assetSession}`,
};

export function openAirpSocket(onMessage: (message: Record<string, unknown>) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
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
