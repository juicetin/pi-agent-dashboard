/**
 * SQLite database layer using sql.js (pure JS SQLite).
 */
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";

export interface Database {
  /** Get the underlying sql.js database */
  raw: SqlJsDatabase;
  /** List all table names */
  listTables(): string[];
  /** List all index names */
  listIndexes(): string[];
  /** Save database to disk */
  save(): void;
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
];

export async function createDatabaseAsync(dbPath: string): Promise<Database> {
  const SQL = await initSqlJs();

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing database or create new
  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run migrations
  for (const sql of MIGRATIONS) {
    db.run(sql);
  }

  // Run ALTER TABLE migrations (ignore errors for already-existing columns)
  for (const sql of ALTER_MIGRATIONS) {
    try {
      db.run(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Save after migrations
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  return {
    raw: db,

    listTables(): string[] {
      const result = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      if (result.length === 0) return [];
      return result[0].values.map((row) => row[0] as string);
    },

    listIndexes(): string[] {
      const result = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      if (result.length === 0) return [];
      return result[0].values.map((row) => row[0] as string);
    },

    save(): void {
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    },

    close(): void {
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
      db.close();
    },
  };
}

/** Synchronous wrapper for testing convenience */
export function createDatabase(dbPath: string): Database {
  // For synchronous usage, we need a blocking approach
  // sql.js can be initialized synchronously if the wasm is bundled
  throw new Error("Use createDatabaseAsync instead");
}
