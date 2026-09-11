import { DatabaseSync } from 'node:sqlite';

export function initCanvasDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      layer TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 280,
      height REAL NOT NULL DEFAULT 180,
      z_index INTEGER NOT NULL DEFAULT 1,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      layer TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      style TEXT DEFAULT 'solid',
      label TEXT
    );

    CREATE TABLE IF NOT EXISTS presence (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      layer TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      following INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
}

export function initHistoryDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_proj ON entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_entries_sess ON entries(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_proj ON events(project_id);
  `);
}
