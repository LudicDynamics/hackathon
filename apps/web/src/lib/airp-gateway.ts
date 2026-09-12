export interface WorldShelf {
  templates: string[];
  worlds: string[];
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

export const airpGateway = {
  worlds: () => request<WorldShelf>('/api/worlds'),
  loadWorld: <TManifest = Record<string, unknown>>(worldPath: string) =>
    request<WorldLoadResult<TManifest>>('/api/worlds/load', json('POST', { worldPath })),
  manifest: <TManifest = Record<string, unknown>>() => request<TManifest>('/api/manifest'),
  layer: <TLayer = Record<string, unknown>>(layer: string, signal?: AbortSignal) =>
    request<TLayer>(`/api/layer?layer=${encodeURIComponent(layer)}`, { signal }),
  backpack: <TItems = unknown[]>() => request<{ items: TItems }>('/api/backpack'),
  characters: <TCharacters = unknown[]>() =>
    request<{ characters: TCharacters }>('/api/characters'),
  move: (from: string, to: string) => request('/api/move', json('POST', { from, to })),
  choose: (path: string, choice: string) => request('/api/choice', json('POST', { path, choice })),
  moveCard: (path: string, x: number, y: number) =>
    request('/api/card/position', json('POST', { path, x, y })),
  rollDice: (filePath: string, rollType: string, expect: string) =>
    request<{ ok: boolean; result: number; passed: boolean }>(
      '/api/dice',
      json('POST', { filePath, rollType, expect }),
    ),
  useItem: (itemPath: string, targetPath: string, targetType = 'card') =>
    request('/api/use-item', json('POST', { itemPath, targetPath, targetType })),
  toggleFreeze: () => request<{ worldFrozen: boolean }>('/api/freeze', json('POST')),
  godAction: (action: 'create' | 'update' | 'delete', filePath: string, content?: string) =>
    request('/api/god-action', json('POST', { action, filePath, content })),
  assetUrl: (path: string) => `/api/asset?path=${encodeURIComponent(path)}`,
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
