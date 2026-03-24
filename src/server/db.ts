/**
 * SQLite database layer using better-sqlite3 (native file-based SQLite).
 */
import BetterSqlite3 from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export interface Database {
  /** Get the underlying better-sqlite3 database */
  raw: BetterSqlite3.Database;
  /** List all table names */
  listTables(): string[];
  /** List all index names */
  listIndexes(): string[];
  /** Close the database */
  close(): void;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    status TEXT NOT NULL DEFAULT 'active',
    model TEXT,
    thinking_level TEXT,
    workspace_id TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost REAL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_session_seq ON events(session_id, seq)`,
  `CREATE INDEX IF NOT EXISTS idx_events_session_type ON events(session_id, event_type)`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS commands_cache (
    session_id TEXT PRIMARY KEY,
    commands TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  )`,
];

/** Migrations that add columns to existing tables. Each is tried and errors ignored (column may already exist). */
const ALTER_MIGRATIONS = [
  "ALTER TABLE sessions ADD COLUMN cache_read INTEGER DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN cache_write INTEGER DEFAULT 0",
  "ALTER TABLE sessions ADD COLUMN git_branch TEXT",
  "ALTER TABLE sessions ADD COLUMN git_branch_url TEXT",
  "ALTER TABLE sessions ADD COLUMN git_pr_number INTEGER",
  "ALTER TABLE sessions ADD COLUMN git_pr_url TEXT",
  "ALTER TABLE sessions ADD COLUMN name TEXT",
  "ALTER TABLE sessions ADD COLUMN openspec_data TEXT",
];

export function createDatabase(dbPath: string): Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new BetterSqlite3(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma("journal_mode = WAL");

  // Run migrations
  for (const sql of MIGRATIONS) {
    db.exec(sql);
  }

  // Run ALTER TABLE migrations (ignore errors for already-existing columns)
  for (const sql of ALTER_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  return {
    raw: db,

    listTables(): string[] {
      const rows = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all() as Array<{ name: string }>;
      return rows.map((row) => row.name);
    },

    listIndexes(): string[] {
      const rows = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as Array<{ name: string }>;
      return rows.map((row) => row.name);
    },

    close(): void {
      db.close();
    },
  };
}

/** Async wrapper for backward compatibility */
export async function createDatabaseAsync(dbPath: string): Promise<Database> {
  return createDatabase(dbPath);
}
