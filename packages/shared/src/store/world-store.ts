import type { WorldManifest } from '../schemas/world.js';
import type { MoveResult, WorldEvent } from '../schemas/events.js';

/** Canvas card state row (id == repository-relative path of the card file). */
export interface CardRecord {
  id: string;
  layer: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

/** A card file pending seating; w/h defaults applied at seat time when absent. */
export interface SeatFile {
  path: string;
  w?: number;
  h?: number;
}

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
  getLayerCards(paths: string[]): CardRecord[];
  seatUnplaced(layerId: string, files: SeatFile[]): Promise<CardRecord[]>;
  saveCardPosition(id: string, x: number, y: number): Promise<CardRecord>;
  renameCardPosition(from: string, to: string): Promise<void>;
  close(): void;
}
