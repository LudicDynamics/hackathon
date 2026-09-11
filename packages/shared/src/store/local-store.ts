import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { WorldStore } from './world-store.js';
import { type WorldManifest, validateWorldManifest } from '../schemas/world.js';
import type { MoveResult, WorldEvent } from '../schemas/events.js';
import { initCanvasDatabase, initHistoryDatabase } from '../db/schema.js';

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

  close(): void {
    this.canvasDb.close();
    this.historyDb.close();
  }
}
