import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CardRecord, SeatFile, WorldStore } from './world-store.js';
import { deriveLayers, layerOfPath, cardsOfLayer, childLayers, WORLD_DIR } from './layers.js';
import { type WorldManifest, type LayerConfig, validateWorldManifest } from '../schemas/world.js';
import { parseFrontmatter } from '../schemas/frontmatter.js';
import type { MoveResult, WorldEvent } from '../schemas/events.js';
import { initCanvasDatabase, initHistoryDatabase } from '../db/schema.js';

/** Seating anchor (world coords, viewport agnostic). Cards spiral outward from here. */
export const SEAT_ANCHOR = { x: 960, y: 540 };
/** Spiral step between candidate cells, in world px. */
export const SEAT_STEP = 96;
/** Collision padding around card bounds when judging seat overlap. */
export const SEAT_PAD = 22;
/** Max candidate cells tried before falling back to the anchor itself. */
const SEAT_MAX_CANDIDATES = 600;

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
    mkdirSync(airpDir, { recursive: true });

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
    return results.map((abs) => path.relative(this.worldRoot, abs).split(path.sep).join('/'));
  }

  /** Every directory under `world/` (relative paths, sorted) — the layer tree. */
  async listDirs(): Promise<string[]> {
    const root = this.resolvePath(WORLD_DIR);
    const out: string[] = [];
    async function walk(current: string) {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) {
          const full = path.join(current, entry.name);
          out.push(full);
          await walk(full);
        }
      }
    }
    await walk(root);
    return [root, ...out].map((abs) => path.relative(this.worldRoot, abs).split(path.sep).join('/'));
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

  /**
   * The manifest. `layers` is ALWAYS derived from the directory tree — never
   * read from world.json. Declaring the tree in two places let them drift, so
   * the file carries only world-level facts (name/genre/characters/…).
   */
  async getManifest(): Promise<WorldManifest> {
    const raw = await this.readFile('world.json');
    const parsed = JSON.parse(raw);
    const layers = await this.scanLayers();
    this.manifestCache = validateWorldManifest({ ...parsed, layers });
    return this.manifestCache;
  }

  /** Derive every layer from the directory tree (see store/layers.ts). */
  private async scanLayers(): Promise<Record<string, LayerConfig>> {
    const dirs = await this.listDirs();
    const fmByDir = new Map<string, Record<string, any> | null>();
    for (const d of dirs) {
      try {
        fmByDir.set(d, parseFrontmatter(await this.readFile(`${d}/README.md`)).frontmatter);
      } catch {
        fmByDir.set(d, null); // no README → stub layer
      }
    }
    return deriveLayers(dirs, (d) => fmByDir.get(d) ?? null);
  }

  async updateManifest(updates: Partial<WorldManifest>): Promise<void> {
    const current = await this.getManifest();
    const merged = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const valid = validateWorldManifest(merged);
    // `layers` is derived, not declared — keep it out of the file so the tree
    // stays the single source (a written map would drift again).
    const { layers: _derived, ...persisted } = valid;
    await this.writeFile('world.json', JSON.stringify(persisted, null, 2));
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
        // Track every candidate so exhaustion falls back to the LAST one tried
        // instead of the anchor — otherwise two overflowing cards stack on the
        // same point and overlap (the spiral is a walk, always a valid-ish spot).
        placedX = cx - w / 2;
        placedY = cy - h / 2;
        if (!overlapsOccupied(occupied, cx, cy, w, h)) {
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(
          `[seat] no free cell within ${SEAT_MAX_CANDIDATES} candidates for "${file.path}"; placing at last candidate`
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

  /**
   * Re-flow the seated x/y of every card whose stored footprint no longer
   * matches the current form table. `w/h` are a pure function of kind (see
   * shared/schemas/forms.ts), so when a kind is resized in code the persisted
   * rows still carry the old box — cards then overlap on the next paint. This
   * re-seats ONLY drifted cards (keeping spiral order and every card whose size
   * is unchanged, so a player's own drags survive), writing x/y/w/h back.
   */
  async reseatLayer(layerId: string, files: SeatFile[]): Promise<CardRecord[]> {
    if (files.length === 0) return [];
    const rows = this.getLayerCards(files.map((f) => f.path));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const drifted = files
      .filter((f) => {
        const row = byId.get(f.path);
        return row && f.w && f.h && (row.w !== f.w || row.h !== f.h);
      })
      .sort((a, b) => a.path.localeCompare(b.path));
    if (drifted.length === 0) return [];

    const driftedPaths = new Set(drifted.map((f) => f.path));
    // Occupied = siblings at their CURRENT size, so drifters reflow around
    // (never through) cards that did not move.
    const occupied = files
      .filter((f) => !driftedPaths.has(f.path))
      .map((f) => {
        const row = byId.get(f.path);
        const w = row?.w ?? f.w ?? 280;
        const h = row?.h ?? f.h ?? 180;
        return { cx: (row?.x ?? 0) + w / 2, cy: (row?.y ?? 0) + h / 2, w, h };
      });

    const out: CardRecord[] = [];
    for (const file of drifted) {
      const w = file.w!;
      const h = file.h!;
      let placedX = SEAT_ANCHOR.x - w / 2;
      let placedY = SEAT_ANCHOR.y - h / 2;
      let tries = 0;
      for (const [gx, gy] of spiralCells()) {
        if (tries++ >= SEAT_MAX_CANDIDATES) break;
        const cx = SEAT_ANCHOR.x + gx * SEAT_STEP;
        const cy = SEAT_ANCHOR.y + gy * SEAT_STEP;
        // Fall back to the last tried cell (never the anchor) — see seatUnplaced.
        placedX = cx - w / 2;
        placedY = cy - h / 2;
        if (!overlapsOccupied(occupied, cx, cy, w, h)) break;
      }
      this.execCanvas('UPDATE cards SET x = ?, y = ?, width = ?, height = ? WHERE id = ?', [
        placedX, placedY, w, h, file.path,
      ]);
      const prev = byId.get(file.path)!;
      occupied.push({ cx: placedX + w / 2, cy: placedY + h / 2, w, h });
      out.push({ ...prev, x: placedX, y: placedY, w, h });
    }
    return out;
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
  /**
   * A layer's page as `{ cards, doorIds }`: markdown directly in its directory,
   * plus one door id per immediate child layer (README or stub). The route
   * turns each door id into a door card. Never reaches into a child's contents.
   */
  async pageOfLayer(layerId: string): Promise<{ cards: string[]; doorIds: string[] }> {
    const [allFiles, layers] = await Promise.all([this.listFiles(), this.scanLayers()]);
    return {
      cards: cardsOfLayer(layerId, allFiles),
      doorIds: childLayers(layerId, layers),
    };
  }

  /** Layer of a card path: longest derived layer id that fronts it, else 'map'. */
  private async deriveLayer(id: string): Promise<string> {
    return layerOfPath(id, await this.scanLayers());
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
