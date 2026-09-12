import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { CardRecord, LinkRecord, SeatFile, WorldStore } from './world-store.js';
import { deriveLayers, layerOfPath, layerOfDir, cardsOfLayer, childLayers, WORLD_DIR } from './layers.js';
import { linkIdOf } from '../schemas/canvas.js';
import { type WorldManifest, type LayerConfig, validateWorldManifest } from '../schemas/world.js';
import { entityName, parseFrontmatter } from '../schemas/frontmatter.js';
import type { ActorValue, AppendEventArgs, DanglingRef, MoveResult, WorldEvent } from '../schemas/events.js';
import { EventDetailSchemas } from '../schemas/events.js';
import { ActionError } from '../actions/errors.js';
import { dirname as posixDirname, relFrom, rewriteOwnRefs, scanOwnRefs, scanRefs, rewriteRefs } from '../actions/refs.js';
import { initCanvasDatabase, initHistoryDatabase } from '../db/schema.js';
import { CARD_FORMS } from '../schemas/forms.js';
import type { PresenceRecord, SeatPresenceResult } from './world-store.js';

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
  /** `manifest.id` is stable for a world; reading it re-scans every layer dir. */
  private projectIdCache: string | null = null;

  constructor(worldRoot: string) {
    this.worldRoot = path.resolve(worldRoot);
    const airpDir = path.join(this.worldRoot, '.airpworld');
    mkdirSync(airpDir, { recursive: true });

    this.canvasDb = new DatabaseSync(path.join(airpDir, 'canvas.db'));
    this.historyDb = new DatabaseSync(path.join(airpDir, 'history.db'));

    initCanvasDatabase(this.canvasDb);
    initHistoryDatabase(this.historyDb);
  }

  /**
   * Validate BEFORE joining, then assert AFTER joining (two layers, 01 §7.3).
   * The old implementation only stripped LEADING `../` — `a/../../etc/passwd`
   * still escaped the world root after `path.join` normalisation, making every
   * model-supplied path an arbitrary-write channel.
   */
  private resolvePath(relPath: string): string {
    if (!relPath) {
      throw new ActionError({ code: 'invalid_argument', message: 'Path must not be empty' });
    }
    if (path.isAbsolute(relPath)) {
      throw new ActionError({
        code: 'invalid_path',
        message: `Path must be world-relative, got "${relPath}"`,
      });
    }
    if (relPath.includes('\\')) {
      throw new ActionError({
        code: 'invalid_path',
        message: `Path must use POSIX separators, got "${relPath}"`,
      });
    }
    const segs = relPath.split('/').filter((s) => s !== '' && s !== '.');
    if (segs.includes('..')) {
      throw new ActionError({
        code: 'invalid_path',
        message: `Path must not contain "..", got "${relPath}"`,
      });
    }
    // `.airpworld/assets/**` is world CONTENT (generated images) — the only
    // hidden root the store may touch (01 §7.3 / 00 §2.5, REVIEW B-2).
    const inAssetTree = segs[0] === '.airpworld' && segs[1] === 'assets';
    if (!inAssetTree && (segs.some((s) => s.startsWith('.')) || segs.includes('node_modules'))) {
      throw new ActionError({
        code: 'invalid_path',
        message: `Path is inside a reserved directory: "${relPath}"`,
      });
    }
    const abs = path.join(this.worldRoot, segs.join('/'));
    // Belt: even after normalisation, never leave the world root.
    if (abs !== this.worldRoot && !abs.startsWith(this.worldRoot + path.sep)) {
      throw new ActionError({
        code: 'invalid_path',
        message: `Path escapes the world root: "${relPath}"`,
      });
    }
    return abs;
  }

  async readFile(relPath: string): Promise<string> {
    const absPath = this.resolvePath(relPath);
    return await fs.readFile(absPath, 'utf-8');
  }

  async writeFile(relPath: string, content: string | Buffer): Promise<void> {
    const absPath = this.resolvePath(relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content);
  }

  /**
   * Same-dir temp file + rename. The original is untouched on failure, and the
   * temp name carries pid + a random segment because two processes may write
   * the same file concurrently (01 §10.3).
   */
  async writeFileAtomic(relPath: string, content: string | Buffer): Promise<void> {
    const absPath = this.resolvePath(relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const tmp = `${absPath}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
    try {
      await fs.writeFile(tmp, content);
      await fs.rename(tmp, absPath);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw new ActionError({
        code: 'write_failed',
        message: `Failed to write "${relPath}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /** `readFile` is utf-8 only; PNG/asset tiers need base64. */
  async readFileBase64(relPath: string): Promise<string> {
    const absPath = this.resolvePath(relPath);
    return (await fs.readFile(absPath)).toString('base64');
  }

  async statKind(relPath: string): Promise<'file' | 'dir' | 'missing'> {
    try {
      const st = await fs.stat(this.resolvePath(relPath));
      return st.isDirectory() ? 'dir' : 'file';
    } catch {
      return 'missing';
    }
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

  /**
   * Physical move + reference rewrite (01 §2.7 keeps this signature). The
   * action layer (`moveEntity`) owns validation, canvas migration and seating;
   * this wrapper keeps the historical shape for direct store callers and lands
   * the `engine` event those callers expect. `moveEntity` uses `moveFile` so it
   * can land the event itself with the REAL actor (04 §3.1 step 9).
   */
  async move(from: string, to: string): Promise<MoveResult> {
    const { name, rewrote, dangling } = await this.moveFile(from, to);
    const event = await this.appendEvent({
      type: 'entity_moved',
      actor: { type: 'engine' },
      detail: { from, to, name, rewrote: rewrote.length, dangling: dangling.length },
      subject: to,
      layer: (await this.resolveLayer(from)) ?? (await this.resolveLayer(to)) ?? undefined,
    });
    return { ok: true, from, to, name, rewrote, dangling, event };
  }

  /**
   * The three physical steps of a move: rewrite references pointing AT the file
   * (two passes, 04 §3.6.1), rename, then re-base the moved file's OWN relative
   * references (step 7, §3.6.6). No event — the caller owns actor + turn.
   */
  async moveFile(
    from: string,
    to: string
  ): Promise<{ name: string; rewrote: string[]; dangling: DanglingRef[] }> {
    const absFrom = this.resolvePath(from);
    const absTo = this.resolvePath(to);

    const rawFrom = await fs.readFile(absFrom, 'utf-8');
    const { frontmatter } = parseFrontmatter(rawFrom);
    const name = entityName(frontmatter, from);

    // Scanning happens BEFORE the rename so bare-basename references still
    // resolve unambiguously to `from`; the file contents the offsets point into
    // are unchanged by a rename.
    const sites = await scanRefs(this, from, to);

    await fs.mkdir(path.dirname(absTo), { recursive: true });
    // Link creation is exclusive: never overwrite another carried item's file.
    // Both paths belong to the same world filesystem; directory moves are not
    // part of this item API. Unlink only after the destination exists safely.
    await fs.link(absFrom, absTo);
    await fs.unlink(absFrom);

    const { rewrote, dangling } = await rewriteRefs(this, from, to, sites);

    // Step 7: the file's own relative links now point into the wrong directory.
    const oldDir = posixDirname(from);
    const newDir = posixDirname(to);
    if (oldDir !== newDir) {
      const own = await scanOwnRefs(this, to, oldDir);
      await rewriteOwnRefs(this, to, oldDir, newDir, own);
    }

    return { name, rewrote, dangling };
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

  /**
   * Append one world event and return it ALREADY COMMITTED (01 §3.8): the
   * server's tail reader may query the moment this resolves, and a pre-commit
   * return could let it see `seq=n` without `seq=n-1`.
   */
  async appendEvent(args: AppendEventArgs): Promise<WorldEvent> {
    const projectId = await this.projectId();
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only shape check: a mistyped detail field explodes here, not in a
      // renderer three layers away.
      const schema = EventDetailSchemas[args.type];
      const parsed = schema.safeParse(args.detail);
      if (!parsed.success) {
        throw new ActionError({
          code: 'invalid_argument',
          message: `Event '${args.type}' detail does not match its schema: ${parsed.error.message}`,
        });
      }
    }
    const now = new Date().toISOString();
    this.historyDb.exec('BEGIN IMMEDIATE');
    try {
      const info = this.historyDb
        .prepare(
          `INSERT INTO events (id, project_id, type, actor_type, actor_id, layer, subject, turn, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          '',
          projectId,
          args.type,
          args.actor.type,
          args.actor.id ?? null,
          args.layer ?? null,
          args.subject ?? null,
          args.turn ?? null,
          JSON.stringify(args.detail),
          now
        );
      const seq = Number(info.lastInsertRowid);
      this.historyDb.prepare('UPDATE events SET id = ? WHERE seq = ?').run(`evt-${seq}`, seq);
      this.historyDb.exec('COMMIT');
      return {
        seq,
        id: `evt-${seq}`,
        projectId,
        type: args.type,
        actor: args.actor,
        layer: args.layer ?? null,
        subject: args.subject ?? null,
        turn: args.turn ?? null,
        detail: args.detail,
        createdAt: now,
      };
    } catch (err) {
      this.historyDb.exec('ROLLBACK');
      if (err instanceof ActionError) throw err;
      throw new ActionError({
        code: 'event_failed',
        message: `Failed to append event '${args.type}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /** Ascending — the consumption side renders in time order; DESC is getEvents'. */
  async getEventsSince(
    seq: number,
    opts: { layer?: string; excludeActor?: ActorValue } = {}
  ): Promise<WorldEvent[]> {
    const projectId = await this.projectId();
    const where = ['project_id = ?', 'seq > ?'];
    const params: Array<string | number> = [projectId, seq];
    if (opts.layer !== undefined) {
      where.push('layer = ?');
      params.push(opts.layer);
    }
    if (opts.excludeActor) {
      // NOT (type AND id) — an OR here would also drop every character event.
      where.push(`NOT (actor_type = ? AND COALESCE(actor_id, '') = ?)`);
      params.push(opts.excludeActor.type, opts.excludeActor.id ?? '');
    }
    // node:sqlite hands back `Record<string, SQLOutputValue>`; the row shape is
    // fixed by our own CREATE TABLE, so the unchecked cast is checked by hand.
    const rows = this.historyDb
      .prepare(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY seq ASC`)
      .all(...params) as unknown as EventRow[];
    return rows.map((r) => this.rowToEvent(r));
  }

  async getMaxSeq(): Promise<number> {
    const projectId = await this.projectId();
    const row = this.historyDb
      .prepare('SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM events WHERE project_id = ?')
      .get(projectId) as { maxSeq?: number } | undefined;
    return Number(row?.maxSeq ?? 0);
  }

  async readCursor(reader: string): Promise<number> {
    const row = this.historyDb.prepare('SELECT seq FROM read_cursors WHERE reader = ?').get(reader) as
      | { seq?: number }
      | undefined;
    return Number(row?.seq ?? 0); // no row → 0 = "read from genesis"
  }

  /** Bare write: no implicit monotonic clamp (01 §3.4). Pushing backwards is legal. */
  async writeCursor(reader: string, seq: number): Promise<void> {
    try {
      this.historyDb
        .prepare(
          `INSERT INTO read_cursors (reader, seq, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(reader) DO UPDATE SET seq = excluded.seq, updated_at = excluded.updated_at`
        )
        .run(reader, seq, new Date().toISOString());
    } catch (err) {
      throw new ActionError({
        code: 'write_failed',
        message: `Failed to write cursor for '${reader}': ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  async getAllReadCursors(): Promise<Array<{ reader: string; seq: number }>> {
    // node:sqlite yields null-prototype rows; normalize so consumers get plain
    // objects (rollback pushes every cursor to the max seq, doc-21 §6).
    const rows = this.historyDb.prepare('SELECT reader, seq FROM read_cursors').all() as unknown as Array<{
      reader: string;
      seq: number;
    }>;
    return rows.map((r) => ({ reader: String(r.reader), seq: Number(r.seq) }));
  }

  /** Newest-first, history panel only. `seq` ordering keeps same-ms rows stable. */
  async getEvents(limit = 50): Promise<WorldEvent[]> {
    const projectId = await this.projectId();
    const rows = this.historyDb
      .prepare('SELECT * FROM events WHERE project_id = ? ORDER BY seq DESC LIMIT ?')
      .all(projectId, limit) as unknown as EventRow[];
    return rows.map((r) => this.rowToEvent(r));
  }

  /**
   * Layer id a world path belongs to, or null when it is NOT in the layer tree
   * (`player/**`, `characters/<id>/**`, `world.json`). Mapping a bag path to
   * 'map' would be a lie and would leak bag events into a character's layer
   * window (01 §3.9 / doc-22 §3.2).
   */
  async resolveLayer(relPath: string): Promise<string | null> {
    const normalized = relPath.replace(/^\.\//, '').replace(/\/+$/, '');
    if (normalized !== WORLD_DIR && !normalized.startsWith(`${WORLD_DIR}/`)) {
      // player/**, characters/<id>/**, world.json are not layers. Reporting them
      // as 'map' would leak bag events into a character's layer window.
      return null;
    }
    const layers = await this.scanLayers();
    // A path that IS a layer directory names that layer; anything else belongs
    // to the layer of its containing directory (world/README.md → 'map').
    if (layers[layerOfDir(normalized)]) return layerOfDir(normalized);
    const dir = normalized.slice(0, normalized.lastIndexOf('/'));
    return dir === WORLD_DIR || dir.startsWith(`${WORLD_DIR}/`) ? layerOfDir(dir) : null;
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

  // === Canvas state layer (doc-09 §4.2) =====================================

  async upsertLink(link: {
    id?: string;
    layer: string;
    from: string;
    to: string;
    style?: LinkRecord['style'];
    color?: LinkRecord['color'];
    directed?: boolean;
    z?: number;
    label?: string | null;
  }): Promise<LinkRecord> {
    const id = link.id ?? linkIdOf(link.layer, link.from, link.to);
    const cols = ['id', 'layer', 'from_id', 'to_id', 'created_at'];
    const vals: Array<string | number | null> = [id, link.layer, link.from, link.to, new Date().toISOString()];
    const updates = ['layer = excluded.layer', 'from_id = excluded.from_id', 'to_id = excluded.to_id'];

    if (link.style !== undefined) {
      cols.push('style');
      vals.push(link.style);
      updates.push('style = excluded.style');
    }
    if (link.color !== undefined) {
      cols.push('color');
      vals.push(link.color);
      updates.push('color = excluded.color');
    }
    if (link.directed !== undefined) {
      cols.push('directed');
      vals.push(link.directed ? 1 : 0);
      updates.push('directed = excluded.directed');
    }
    if (link.z !== undefined) {
      cols.push('z_index');
      vals.push(link.z);
      updates.push('z_index = excluded.z_index');
    }
    if (link.label !== undefined) {
      cols.push('label');
      vals.push(link.label);
      updates.push('label = excluded.label');
    }

    this.execCanvas(
      `INSERT INTO links (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
      vals
    );
    return this.getLayerLinkById(id);
  }

  async deleteLink(id: string): Promise<boolean> {
    const result = this.canvasDb.prepare('DELETE FROM links WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  async placeCard(
    layer: string,
    path: string,
    box: { x?: number; y?: number; z?: number }
  ): Promise<CardRecord> {
    this.applyPlaceCard(layer, path, box);
    return this.cardById(path);
  }

  async placeCards(
    rows: Array<{ layer: string; path: string; x: number; y: number; z?: number }>
  ): Promise<CardRecord[]> {
    if (rows.length === 0) return [];
    // One transaction: a half-reflowed layer is worse than an un-reflowed one,
    // and a reader may poll between statements (doc-09 §3.2 step 3).
    this.execCanvas('BEGIN IMMEDIATE');
    try {
      for (const row of rows) this.applyPlaceCard(row.layer, row.path, row);
      this.execCanvas('COMMIT');
    } catch (err) {
      try {
        this.execCanvas('ROLLBACK');
      } catch {
        // Already rolled back by SQLite; the original error is what matters.
      }
      throw err;
    }
    return rows.map((row) => this.cardById(row.path));
  }

  async getLayerLinks(layer?: string): Promise<LinkRecord[]> {
    const cols = 'id, layer, from_id, to_id, style, color, directed, z_index, label';
    const rows =
      layer === undefined
        ? this.queryCanvas(`SELECT ${cols} FROM links ORDER BY z_index, id`)
        : this.queryCanvas(`SELECT ${cols} FROM links WHERE layer = ? ORDER BY z_index, id`, [layer]);
    return rows.map((raw) => this.rowToLink(raw as Record<string, unknown>));
  }

  /** Single UPSERT statement, column-narrow: w/h are never written (doc-09 §11 冲突 1). */
  private applyPlaceCard(
    layer: string,
    path: string,
    box: { x?: number; y?: number; z?: number }
  ): void {
    const cols = ['id', 'layer'];
    const vals: Array<string | number> = [path, layer];
    const updates = ['layer = excluded.layer'];
    if (box.x !== undefined) {
      cols.push('x');
      vals.push(box.x);
      updates.push('x = excluded.x');
    }
    if (box.y !== undefined) {
      cols.push('y');
      vals.push(box.y);
      updates.push('y = excluded.y');
    }
    if (box.z !== undefined) {
      cols.push('z_index');
      vals.push(box.z);
      updates.push('z_index = excluded.z_index');
    }
    this.execCanvas(
      `INSERT INTO cards (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
      vals
    );
  }

  private cardById(path: string): CardRecord {
    const rows = this.queryCanvas(
      'SELECT id, layer, x, y, width, height, z_index FROM cards WHERE id = ?',
      [path]
    );
    return this.toCardRecord(rows[0] as Record<string, unknown>);
  }

  private getLayerLinkById(id: string): LinkRecord {
    const rows = this.queryCanvas(
      'SELECT id, layer, from_id, to_id, style, color, directed, z_index, label FROM links WHERE id = ?',
      [id]
    );
    return this.rowToLink(rows[0] as Record<string, unknown>);
  }

  /** One row → link mapping, so every read path shares the snake→camel rules. */
  private rowToLink(row: Record<string, unknown>): LinkRecord {
    return {
      id: String(row.id),
      layer: String(row.layer),
      from: String(row.from_id),
      to: String(row.to_id),
      style: String(row.style) as LinkRecord['style'],
      color: row.color == null ? null : (String(row.color) as NonNullable<LinkRecord['color']>),
      directed: Number(row.directed) === 1,
      z: Number(row.z_index),
      label: row.label == null ? null : String(row.label),
    };
  }

  async saveCardPosition(id: string, x: number, y: number): Promise<CardRecord> {
    // Keeps the historical behavior: `deriveLayer` (layerOfPath fallback to
    // 'map') still fronts the player drag route, which only ever passes cards
    // shown on a layer page (doc-09 §2.5).
    const layer = await this.deriveLayer(id);
    return this.placeCard(layer, id, { x, y });
  }

  /**
   * Migrate a card (and every line touching it) after a file move (04 §3.8.2).
   * The old version relayered by `deriveLayer` — which falls back to 'map' — so
   * a bag object was silently dragged onto the world map, and it swallowed link
   * failures. Now the canvas boundary is judged by `resolveLayer`: leaving the
   * layer tree drops the card; staying migrates `id` + `layer`, and each line
   * follows its endpoints (a line keeps the layer of whichever end stays).
   */
  async renameCardPosition(from: string, to: string): Promise<void> {
    const toLayer = await this.resolveLayer(to);

    try {
      this.execCanvas('BEGIN IMMEDIATE');
      if (toLayer === null) {
        // Out of the layer tree (player/, characters/, outside the world):
        // the card leaves the canvas. A line whose endpoint goes dangling is
        // KEPT (09 §4.4) — it revives when the file comes back.
        this.execCanvas('DELETE FROM cards WHERE id = ?', [from]);
      } else {
        this.execCanvas('UPDATE cards SET id = ?, layer = ? WHERE id = ?', [to, toLayer, from]);
        // One row per endpoint: the line's layer follows the end that STAYS in
        // a layer; when both ends are in layers they are in the same one by
        // construction (a move crosses exactly one boundary).
        this.execCanvas('UPDATE links SET from_id = ?, layer = ? WHERE from_id = ?', [to, toLayer, from]);
        this.execCanvas('UPDATE links SET to_id = ?, layer = ? WHERE to_id = ?', [to, toLayer, from]);
      }
      this.execCanvas('COMMIT');
    } catch (err) {
      try {
        this.execCanvas('ROLLBACK');
      } catch {
        // SQLite already rolled back; the original error is the useful one.
      }
      throw new ActionError({
        code: 'internal',
        message: `Entity moved to "${to}" but its canvas card could not be migrated: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Remove a card and every line that touches it (09 §4.4). Used when an entity
   * is deleted (04 §3.2 step 4) and when a card leaves the canvas boundary.
   * Returns how many cards / links were dropped, for the caller to report.
   */
  dropCard(path: string): { cards: number; links: number } {
    try {
      this.execCanvas('BEGIN IMMEDIATE');
      const cards = this.runCanvas('DELETE FROM cards WHERE id = ?', [path]);
      const links = this.runCanvas('DELETE FROM links WHERE from_id = ? OR to_id = ?', [path, path]);
      this.execCanvas('COMMIT');
      return { cards, links };
    } catch (err) {
      try {
        this.execCanvas('ROLLBACK');
      } catch {
        // Already rolled back.
      }
      throw new ActionError({
        code: 'internal',
        message: `Failed to drop the canvas card for "${path}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /** How many rows a write actually touched — `BEGIN`/`COMMIT` friendly. */
  private runCanvas(sql: string, params: Array<string | number | null> = []): number {
    return Number(this.canvasDb.prepare(sql).run(...params).changes);
  }

  /**
   * Seat one new card NEXT TO an existing card (04 §3.9.3). Same spiral as
   * `seatUnplaced`, but the origin is the anchor card's centre and the anchor's
   * own cell is skipped — so the neighbour lands at ring 1, never on top of it.
   * Already-seated cards are never re-flowed (doc-06 §2.5). The extra
   * `exhausted` flag is how the caller surfaces "placed, but overlapping"
   * instead of silently pretending the seat is clean.
   */
  async seatNear(
    layerId: string,
    file: SeatFile,
    anchorPath: string
  ): Promise<CardRecord & { exhausted: boolean }> {
    // The anchor card is seated first when it has no row; one shared helper so
    // `seatNear` and `seatPresence` can never diverge (04 §3.9.3 / 05 §11 冲突 5).
    const { cx: aCx, cy: aCy } = await this.anchorOf(layerId, anchorPath);
    const anchor = this.getLayerCards([anchorPath])[0];

    const w = file.w && file.w > 0 ? file.w : 280;
    const h = file.h && file.h > 0 ? file.h : 180;
    const occupied = this.getLayerCards(this.cardsInLayer(layerId)).map((r) => ({
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2,
      w: r.w,
      h: r.h,
    }));

    const maxZRows = this.queryCanvas(
      'SELECT COALESCE(MAX(z_index), 0) AS maxZ FROM cards WHERE layer = ?',
      [layerId]
    );
    const nextZ = Number((maxZRows[0] as Record<string, unknown> | undefined)?.maxZ ?? 0) + 1;

    // Fallback: one card-width to the anchor's left (never the anchor's own
    // centre — overlapping the anchor is the one outcome the spiral avoids).
    let placedX = anchor.x - w;
    let placedY = anchor.y;
    let found = false;
    let tries = 0;
    for (const [gx, gy] of spiralCells()) {
      if (tries++ >= SEAT_MAX_CANDIDATES) break;
      if (gx === 0 && gy === 0) continue; // the anchor's own cell is taken
      const cx = aCx + gx * SEAT_STEP;
      const cy = aCy + gy * SEAT_STEP;
      placedX = cx - w / 2;
      placedY = cy - h / 2;
      if (!overlapsOccupied(occupied, cx, cy, w, h)) {
        found = true;
        break;
      }
    }
    if (!found) {
      console.warn(
        `[seatNear] no free cell within ${SEAT_MAX_CANDIDATES} candidates for "${file.path}"; placing at last candidate`
      );
    }

    this.execCanvas(
      `INSERT INTO cards (id, layer, x, y, width, height, z_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET layer = excluded.layer, x = excluded.x,
         y = excluded.y, width = excluded.width, height = excluded.height`,
      [file.path, layerId, placedX, placedY, w, h, nextZ]
    );
    return {
      id: file.path,
      layer: layerId,
      x: placedX,
      y: placedY,
      w,
      h,
      z: nextZ,
      exhausted: !found,
    };
  }

  /** Every card path seated on a layer (for the seatNear occupancy set). */
  cardsInLayer(layerId: string): string[] {
    return this.queryCanvas('SELECT id FROM cards WHERE layer = ?', [layerId]).map((r) =>
      String((r as Record<string, unknown>).id)
    );
  }

  /**
   * The card centre for an anchor path, seating it first when it has no row
   * (05 §7.3 / 04 §3.9.3). Without the pre-seat, a `near` anchor that was never
   * flushed by `/api/layer` would hand `undefined` to the spiral and produce
   * `NaN` coordinates. `anchorOf` is the ONE such helper, shared by
   * `seatPresence` and `seatNear`.
   */
  private async anchorOf(layerId: string, anchorPath: string): Promise<{ cx: number; cy: number }> {
    let anchor = this.getLayerCards([anchorPath])[0];
    if (!anchor) {
      await this.seatUnplaced(layerId, [{ path: anchorPath }]);
      anchor = this.getLayerCards([anchorPath])[0];
    }
    if (!anchor) {
      throw new ActionError({
        code: 'internal',
        message: `Could not seat the anchor card "${anchorPath}" before seating beside it`,
      });
    }
    return { cx: anchor.x + anchor.w / 2, cy: anchor.y + anchor.h / 2 };
  }

  /**
   * Seat a character presence (05 §3.9.3). The third seating method, beside
   * `seatUnplaced` / `seatNear`, and deliberately in THIS module so it can use
   * the private `SEAT_MAX_CANDIDATES` / `spiralCells` / `overlapsOccupied` —
   * the seat grid and the card grid are the same sheet of paper.
   *
   * Two things make presence seating its own algorithm:
   *  - the occupancy set is cards UNION the layer's other presences (so Watson
   *    never stands on the counter card, nor inside the Constable);
   *  - the anchor is either a card centre (`near`) or the global SEAT_ANCHOR.
   *
   * The returned `x`/`y` are the presence CENTRE, not a top-left corner: the
   * front end paints `PresenceEntry{x,y}` as a circle centre, while `cards`
   * stores top-left. Mixing the two would offset every avatar by half a body.
   */
  async seatPresence(
    layerId: string,
    opts: { near?: string; excludeCharacter?: string } = {}
  ): Promise<SeatPresenceResult> {
    const { w, h } = CARD_FORMS.sprite;
    const cards = (
      this.queryCanvas('SELECT x, y, width, height FROM cards WHERE layer = ?', [
        layerId,
      ]) as Array<Record<string, unknown>>
    ).map((r) => ({
      cx: Number(r.x) + Number(r.width) / 2,
      cy: Number(r.y) + Number(r.height) / 2,
      w: Number(r.width),
      h: Number(r.height),
    }));
    const pres = (
      this.queryCanvas(
        `SELECT x, y FROM presence WHERE layer = ?${opts.excludeCharacter ? ' AND character_id != ?' : ''}`,
        opts.excludeCharacter ? [layerId, opts.excludeCharacter] : [layerId]
      ) as Array<Record<string, unknown>>
    ).map((r) => ({ cx: Number(r.x), cy: Number(r.y), w, h }));

    const anchor = opts.near
      ? await this.anchorOf(layerId, opts.near)
      : { cx: SEAT_ANCHOR.x, cy: SEAT_ANCHOR.y };
    const occupied = [...cards, ...pres];

    let tries = 0;
    // Fallback is the LAST walked cell, never the anchor: the anchor's cell
    // belongs to the anchor card (05 §3.9.3, same rule as seatUnplaced).
    let last = { x: anchor.cx, y: anchor.cy };
    for (const [gx, gy] of spiralCells()) {
      // Cell 0 is the anchor itself — always taken. `tries` counts every cell
      // visited (cell 0 included), matching `seatUnplaced` / `seatNear`.
      tries++;
      if (tries === 1) continue;
      if (tries > SEAT_MAX_CANDIDATES) break;
      const cx = anchor.cx + gx * SEAT_STEP;
      const cy = anchor.cy + gy * SEAT_STEP;
      last = { x: cx, y: cy };
      if (!overlapsOccupied(occupied, cx, cy, w, h)) {
        return { x: cx, y: cy, seat: { gx, gy, tries, exhausted: false } };
      }
    }
    console.warn(
      `[seatPresence] no free presence cell within ${SEAT_MAX_CANDIDATES} candidates in "${layerId}"; placing at last candidate`
    );
    return { x: last.x, y: last.y, seat: { gx: 0, gy: 0, tries, exhausted: true } };
  }

  /**
   * One UPSERT keyed by `character_id` (05 §3.4). `following` omitted KEEPS the
   * row's current value — that is what lets `move_to` relocate a follower
   * without quietly un-teaming them. Single statement, therefore atomic; the
   * action layer adds no lock (后写者赢, 01 §7.3).
   */
  async upsertPresence(p: {
    characterId: string;
    layer: string;
    x: number;
    y: number;
    following?: boolean;
  }): Promise<PresenceRecord> {
    const now = new Date().toISOString();
    const keepFollowing = p.following === undefined;
    if (keepFollowing) {
      this.execCanvas(
        `INSERT INTO presence (id, character_id, layer, x, y, following, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(character_id) DO UPDATE SET layer = excluded.layer, x = excluded.x,
           y = excluded.y, updated_at = excluded.updated_at`,
        [`presence:${p.characterId}`, p.characterId, p.layer, p.x, p.y, now]
      );
    } else {
      this.execCanvas(
        `INSERT INTO presence (id, character_id, layer, x, y, following, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(character_id) DO UPDATE SET layer = excluded.layer, x = excluded.x,
           y = excluded.y, following = excluded.following, updated_at = excluded.updated_at`,
        [`presence:${p.characterId}`, p.characterId, p.layer, p.x, p.y, p.following ? 1 : 0, now]
      );
    }
    return (await this.getPresenceOf(p.characterId))!;
  }

  /** Presence rows, whole world or one layer, stable order (05 §3.6.2). */
  getPresence(layer?: string): PresenceRecord[] {
    const rows = (
      layer === undefined
        ? this.queryCanvas('SELECT * FROM presence ORDER BY character_id')
        : this.queryCanvas('SELECT * FROM presence WHERE layer = ? ORDER BY character_id', [layer])
    ) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToPresence(r));
  }

  /** One character's row, or null when they have never been placed (05 §3.6.1). */
  getPresenceOf(characterId: string): PresenceRecord | null {
    const rows = this.queryCanvas('SELECT * FROM presence WHERE character_id = ?', [
      characterId,
    ]) as Array<Record<string, unknown>>;
    return rows.length > 0 ? this.rowToPresence(rows[0]) : null;
  }

  private rowToPresence(row: Record<string, unknown>): PresenceRecord {
    return {
      characterId: String(row.character_id),
      layer: String(row.layer),
      x: Number(row.x),
      y: Number(row.y),
      following: Number(row.following) === 1,
      updatedAt: String(row.updated_at),
    };
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

  /**
   * `manifest.id` cached per process. Reading it calls `getManifest`, which
   * reads world.json AND re-scans every layer dir — far too expensive to run
   * once per appended event (01 §3.2).
   */
  private async projectId(): Promise<string> {
    if (this.projectIdCache === null) {
      this.projectIdCache = (await this.getManifest()).id;
    }
    return this.projectIdCache;
  }

  /** One row → event mapping, so every read path shares the snake→camel rules. */
  private rowToEvent(row: EventRow): WorldEvent {
    return {
      seq: Number(row.seq),
      id: String(row.id),
      projectId: String(row.project_id),
      type: row.type as WorldEvent['type'],
      actor: { type: row.actor_type as ActorValue['type'], ...(row.actor_id ? { id: row.actor_id } : {}) },
      layer: row.layer ?? null,
      subject: row.subject ?? null,
      turn: row.turn ?? null,
      detail: JSON.parse(row.detail) as Record<string, unknown>,
      createdAt: String(row.created_at),
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

/** Raw `events` row as SQLite hands it over (snake_case, JSON detail). */
interface EventRow {
  seq: number;
  id: string;
  project_id: string;
  type: string;
  actor_type: string;
  actor_id: string | null;
  layer: string | null;
  subject: string | null;
  turn: string | null;
  detail: string;
  created_at: string;
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
