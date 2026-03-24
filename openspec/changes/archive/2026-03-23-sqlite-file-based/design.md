## Context

The dashboard server uses `sql.js` — a pure JS/WASM SQLite implementation. It loads the entire database into memory on startup, runs all queries against the in-memory copy, and periodically exports the full database to disk every 30 seconds via `db.export()` + `fs.writeFileSync()`.

This works but has downsides: up to 30s data loss on crash, full DB in JS heap, and expensive serialization on every flush.

## Goals / Non-Goals

**Goals:**
- Replace `sql.js` with `better-sqlite3` for native file-based SQLite
- Enable WAL mode for concurrent read performance
- Eliminate periodic flush — all writes persist immediately
- Simplify the `Database` interface (remove `save()`)
- Maintain full backward compatibility with existing `.db` files

**Non-Goals:**
- Changing the database schema or migrations
- Changing the event store or session manager query logic
- Adding new database features (connection pooling, etc.)

## Decisions

### Decision 1: Use `better-sqlite3` over other alternatives

**Choice:** `better-sqlite3`

**Alternatives considered:**
- **Keep sql.js with shorter flush interval** — Still in-memory, just reduces the loss window. Doesn't solve the fundamental problem.
- **node:sqlite (Node 22.5+)** — Built-in but still experimental, API less mature.
- **libsql/turso** — Overkill for a local single-process dashboard.

**Rationale:** `better-sqlite3` is the most widely used native SQLite binding for Node.js. Synchronous API fits our existing code patterns (no async query changes needed). Prebuilt binaries available for all major platforms.

### Decision 2: Enable WAL mode

**Choice:** Run `PRAGMA journal_mode=WAL` on database open.

**Rationale:** WAL mode allows concurrent readers while writing, which matches our pattern: the browser gateway reads events while the extension gateway inserts them. WAL also improves write performance by avoiding full-page rewrites.

### Decision 3: Adapt the Database interface

**Current interface:**
```typescript
interface Database {
  raw: SqlJsDatabase;
  listTables(): string[];
  listIndexes(): string[];
  save(): void;
  close(): void;
}
```

**New interface:**
```typescript
interface Database {
  raw: BetterSqlite3.Database;
  listTables(): string[];
  listIndexes(): string[];
  close(): void;
}
```

Changes:
- `raw` type changes from `SqlJsDatabase` to `BetterSqlite3.Database`
- `save()` removed (writes are immediate)
- `close()` just calls `db.close()` (no export step)

### Decision 4: Query API adaptation

`sql.js` uses `db.exec()` returning `{columns, values}[]`. `better-sqlite3` uses prepared statements:
- `db.prepare(sql).all(...params)` → returns array of row objects
- `db.prepare(sql).run(...params)` → returns `{changes, lastInsertRowid}`
- `db.prepare(sql).get(...params)` → returns single row or undefined

All call sites in `event-store.ts` and any direct `db.raw` usage need updating.

## Risks / Trade-offs

- **[Native addon]** → `better-sqlite3` requires compilation or prebuilt binaries. Mitigated by: prebuilds exist for macOS (arm64/x64), Linux (x64/arm64), Windows. The package uses `prebuild-install` for seamless installs.
- **[API surface change]** → All code touching `db.raw` must be updated. Mitigated by: the call sites are contained to `event-store.ts`, `session-manager.ts`, and `server.ts`. Relatively small surface.
- **[Sync API]** → `better-sqlite3` is synchronous, which blocks the event loop during queries. Mitigated by: our queries are small/fast (single row inserts, index lookups). sql.js was also synchronous, so no regression.
