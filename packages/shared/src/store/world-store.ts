import type { WorldManifest } from '../schemas/world.js';
import type { MoveResult, WorldEvent } from '../schemas/events.js';

export interface WorldStore {
  worldRoot: string;
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, content: string): Promise<void>;
  deleteFile(relPath: string): Promise<void>;
  listFiles(prefix?: string): Promise<string[]>;
  move(from: string, to: string): Promise<MoveResult>;
  getManifest(): Promise<WorldManifest>;
  updateManifest(updates: Partial<WorldManifest>): Promise<void>;
  queryCanvas(sql: string, params?: any[]): any[];
  execCanvas(sql: string, params?: any[]): void;
  appendHistoryEntry(sessionId: string, type: string, content: string): Promise<void>;
  appendWorldEvent(type: string, payload: Record<string, any>): Promise<WorldEvent>;
  getEvents(limit?: number): Promise<WorldEvent[]>;
  close(): void;
}
