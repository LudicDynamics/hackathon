import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CardRecord, SeatFile, WorldStore } from './world-store.js';
import { type WorldManifest, validateWorldManifest } from '../schemas/world.js';
import type { MoveResult, WorldEvent } from '../schemas/events.js';
import { initCanvasDatabase, initHistoryDatabase } from '../db/schema.js';

/** Seating anchor (world coords, viewport agnostic). Cards spiral outward from here. */
export const SEAT_ANCHOR = { x: 960, y: 540 };
/** Spiral step between candidate cells, in world px. */
export const SEAT_STEP = 96;
/** Collision padding around card bounds when judging seat overlap. */
export const SEAT_PAD = 22;
/** Max candidate cells tried before falling back to the anchor itself. */
const SEAT_MAX_CANDIDATES = 100;

// Ulam spiral cells: R -> D -> L -> U, step lengths [1,1,2,2,3,3,...], starting at (0,0).
function* spiralCells(): Generator<[number, number]> {
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let x = 0;
  let y = 0;
  yield [x, y];
  let step = 1;
  let dir = 0;
  while (true) {
    for (let i = 0; i < 2; i++) {
      for (let s = 0; s < step; s++) {
        x += dirs[dir][0];
        y += dirs[dir][1];
        yield [x, y];
      }
      dir = (dir + 1) % 4;
    }
    step++;
  }
}

export class LocalWorldStore implements WorldStore {
  public worldRoot: string;
  private canvasDb: DatabaseSync;
  private historyDb: DatabaseSync;
  private manifestCache: WorldManifest | null = null;

  constructor(worldRoot: string) {
    this.worldRoot = path.resolve(worldRoot);
    const airpDir = path.join(this.worldRoot, '.airpworld');

    this.canvasDb = new DatabaseSync(path.join(airpDir, 'canvas.db'));
    this.historyDb = new DatabaseSync(path.join(airpDir, 'history.db'));

    initCanvasDatabase(this.canvasDb);
    initHistoryDatabase(this.historyDb);
  }

  private resolvePath(relPath: string): string {
    const safeRel = relPath.replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.worldRoot, safeRel);
  }

  async readFile(relPath: string): Promise<string> {
    const absPath = this.resolvePath(relPath);
    return await fs.readFile(absPath, 'utf-8');
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const absPath = this.resolvePath(relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
  }

  async deleteFile(relPath: string): Promise<void> {
    const absPath = this.resolvePath(relPath);
    await fs.rm(absPath, { force: true, recursive: true });
  }

  async listFiles(prefix = ''): Promise<string[]> {
    const rootDir = prefix ? this.resolvePath(prefix) : this.worldRoot;
    const results: string[] = [];

    async function walk(current: string) {
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else {
            results.push(full);
          }
        }
      } catch {
        // Ignored if path does not exist
      }
    }

    await walk(rootDir);
    return results.map((abs) => path.relative(this.worldRoot, abs));
  }

  async move(from: string, to: string): Promise<MoveResult> {
    const absFrom = this.resolvePath(from);
    const absTo = this.resolvePath(to);

    await fs.mkdir(path.dirname(absTo), { recursive: true });
    await fs.rename(absFrom, absTo);

    const rewrote: string[] = [];
    const dangling: Array<{ file: string; target: string }> = [];

    const allMdFiles = (await this.listFiles()).filter((f) => f.endsWith('.md'));
    const oldName = path.basename(from);
    const newName = path.basename(to);

    for (const file of allMdFiles) {
      const content = await this.readFile(file);
      if (content.includes(from) || content.includes(oldName)) {
        const updated = content.replaceAll(from, to);
        if (updated !== content) {
          await this.writeFile(file, updated);
          rewrote.push(file);
        } else {
          dangling.push({ file, target: from });
        }
      }
    }

    const event = await this.appendWorldEvent('item_moved', {
      from,
      to,
      oldName,
      newName,
      rewroteCount: rewrote.length,
    });

    return {
      ok: true,
      from,
      to,
      rewrote,
      dangling,
      event,
    };
  }

  async getManifest(): Promise<WorldManifest> {
    const raw = await this.readFile('world.json');
    const parsed = JSON.parse(raw);
    this.manifestCache = validateWorldManifest(parsed);
    return this.manifestCache;
  }

  async updateManifest(updates: Partial<WorldManifest>): Promise<void> {
    const current = await this.getManifest();
    const merged = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const valid = validateWorldManifest(merged);
    await this.writeFile('world.json', JSON.stringify(valid, null, 2));
    this.manifestCache = valid;
  }

  queryCanvas(sql: string, params: any[] = []): any[] {
    const stmt = this.canvasDb.prepare(sql);
    return stmt.all(...params);
  }

  execCanvas(sql: string, params: any[] = []): void {
    const stmt = this.canvasDb.prepare(sql);
    stmt.run(...params);
  }

  async appendHistoryEntry(sessionId: string, type: string, content: string): Promise<void> {
    const manifest = await this.getManifest();
    const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const stmt = this.historyDb.prepare(`
      INSERT INTO entries (id, project_id, session_id, type, content, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, manifest.id, sessionId, type, content, new Date().toISOString());
  }

  async appendWorldEvent(type: string, payload: Record<string, any>): Promise<WorldEvent> {
    const manifest = await this.getManifest();
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const stmt = this.historyDb.prepare(`
      INSERT INTO events (id, project_id, type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, manifest.id, type, JSON.stringify(payload), now);

    return {
      id,
      projectId: manifest.id,
      type: type as any,
      payload,
      createdAt: now,
    };
  }

  async getEvents(limit = 50): Promise<WorldEvent[]> {
    const stmt = this.historyDb.prepare(`
      SELECT * FROM events ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      type: r.type,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
    }));
  }

  getLayerCards(paths: string[]): CardRecord[] {
    if (paths.length === 0) return [];
    const placeholders = paths.map(() => '?').join(',');
    const rows = this.queryCanvas(
      `SELECT id, layer, x, y, width, height, z_index FROM cards WHERE id IN (${placeholders})`,
      paths
    );
    const byId = new Map<string, CardRecord>();
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      byId.set(String(row.id), this.toCardRecord(row));
    }
    return [...byId.values()];
  }

  async seatUnplaced(layerId: string, files: SeatFile[]): Promise<CardRecord[]> {
    if (files.length === 0) return [];

    const existing = this.getLayerCards(files.map((f) => f.path));
    const existingIds = new Set(existing.map((r) => r.id));
    // Only seat cards with no row yet; stable sort for deterministic output.
    const missing = files
      .filter((f) => !existingIds.has(f.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (missing.length === 0) return [];

    const maxZRows = this.queryCanvas(
      'SELECT COALESCE(MAX(z_index), 0) AS maxZ FROM cards WHERE layer = ?',
      [layerId]
    );
    const rawMax = maxZRows[0] as Record<string, unknown> | undefined;
    let nextZ = Number(rawMax?.maxZ ?? 0) + 1;

    // Occupied bounds = existing rows in this batch ∪ seats already assigned here.
    const occupied = existing.map((r) => ({
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2,
      w: r.w,
      h: r.h,
    }));

    const seats: CardRecord[] = [];
    for (const file of missing) {
      const w = file.w && file.w > 0 ? file.w : 280;
      const h = file.h && file.h > 0 ? file.h : 180;

      let placedX = SEAT_ANCHOR.x - w / 2;
      let placedY = SEAT_ANCHOR.y - h / 2;
      let found = false;
      let tries = 0;
      for (const [gx, gy] of spiralCells()) {
        if (tries++ >= SEAT_MAX_CANDIDATES) break;
        const cx = SEAT_ANCHOR.x + gx * SEAT_STEP;
        const cy = SEAT_ANCHOR.y + gy * SEAT_STEP;
        if (!overlapsOccupied(occupied, cx, cy, w, h)) {
          placedX = cx - w / 2;
          placedY = cy - h / 2;
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(
          `[seatUnplaced] no free cell within ${SEAT_MAX_CANDIDATES} candidates for "${file.path}"; placing at anchor`
        );
      }

      this.execCanvas(
        `INSERT INTO cards (id, layer, x, y, width, height, z_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [file.path, layerId, placedX, placedY, w, h, nextZ]
      );
      seats.push({ id: file.path, layer: layerId, x: placedX, y: placedY, w, h, z: nextZ });
      occupied.push({ cx: placedX + w / 2, cy: placedY + h / 2, w, h });
      nextZ++;
    }
    return seats;
  }

  async saveCardPosition(id: string, x: number, y: number): Promise<CardRecord> {
    const layer = await this.deriveLayer(id);
    this.execCanvas(
      `INSERT INTO cards (id, layer, x, y)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET x = excluded.x, y = excluded.y, layer = excluded.layer`,
      [id, layer, x, y]
    );
    const rows = this.queryCanvas(
      'SELECT id, layer, x, y, width, height, z_index FROM cards WHERE id = ?',
      [id]
    );
    return this.toCardRecord(rows[0] as Record<string, unknown>);
  }

  async renameCardPosition(from: string, to: string): Promise<void> {
    const layer = await this.deriveLayer(to);
    this.execCanvas('UPDATE cards SET id = ?, layer = ? WHERE id = ?', [to, layer, from]);
    try {
      this.execCanvas('UPDATE links SET from_id = ? WHERE from_id = ?', [to, from]);
      this.execCanvas('UPDATE links SET to_id = ? WHERE to_id = ?', [to, from]);
    } catch (err) {
      console.warn('[renameCardPosition] link migration skipped:', err);
    }
  }

  /** Layer of a card path: longest manifest layer key that is a path prefix, else 'map'. */
  private async deriveLayer(id: string): Promise<string> {
    const manifest = await this.getManifest();
    const keys = Object.keys(manifest.layers ?? {});
    keys.sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (id.startsWith(`${key}/`)) return key;
    }
    return 'map';
  }

  private toCardRecord(row: Record<string, unknown>): CardRecord {
    return {
      id: String(row.id),
      layer: String(row.layer),
      x: Number(row.x),
      y: Number(row.y),
      w: Number(row.width),
      h: Number(row.height),
      z: Number(row.z_index),
    };
  }

  close(): void {
    this.canvasDb.close();
    this.historyDb.close();
  }
}

function overlapsOccupied(
  occupied: Array<{ cx: number; cy: number; w: number; h: number }>,
  cx: number,
  cy: number,
  w: number,
  h: number
): boolean {
  for (const o of occupied) {
    const ox = (w + o.w) / 2 + SEAT_PAD - Math.abs(cx - o.cx);
    const oy = (h + o.h) / 2 + SEAT_PAD - Math.abs(cy - o.cy);
    if (ox > 0 && oy > 0) return true;
  }
  return false;
}
