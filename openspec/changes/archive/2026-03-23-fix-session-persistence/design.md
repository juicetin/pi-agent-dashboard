## Context

The dashboard uses sql.js, a pure JavaScript SQLite compiled to WebAssembly. Unlike native SQLite bindings, sql.js loads the entire database file into memory and operates on that in-memory copy. Changes are only written to disk when `db.export()` is called followed by `fs.writeFileSync()`. Currently this only happens in `db.save()` and `db.close()`, and `db.save()` is never called during normal operation — only `db.close()` on graceful shutdown.

The `SessionManager` creates an empty `Map<string, DashboardSession>` on initialization and never loads existing records from SQLite. The `EventStore` reads directly from sql.js on every query, so events are available as long as the in-memory database has them — but they're lost if the process dies without flushing to disk.

## Goals / Non-Goals

**Goals:**
- Ensure database state is periodically flushed to disk so ungraceful shutdowns lose at most ~30 seconds of data
- Hydrate the session registry from SQLite on startup so historical sessions appear in the UI
- Mark stale active/streaming sessions as `ended` on startup since their pi processes are no longer connected

**Non-Goals:**
- Changing from sql.js to a native SQLite binding (out of scope, larger migration)
- Real-time fsync on every write (too expensive for the write volume)
- Session reconnection matching (bridge already handles re-register)

## Decisions

### 1. Periodic save via interval timer in server.ts

Add a `setInterval` in `createServer` that calls `db.save()` every 30 seconds. The timer is cleared on `server.stop()`. This keeps the change minimal — no wrapper classes, no write-counting, just a timer.

**Why not save on every write?** sql.js `export()` serializes the entire database to a buffer and writes it to disk. With ~12K events, that's a 40MB write. Doing this on every INSERT would be too expensive. 30 seconds is a reasonable compromise between durability and performance.

**Why not debounced save after writes?** Added complexity for marginal benefit. A fixed interval is simpler and predictable.

### 2. Session hydration via SQL query in createSessionManager

Add a `SELECT * FROM sessions` query at the start of `createSessionManager()`. Map each row to a `DashboardSession` object and populate the in-memory Map. This is a single query that runs once at startup.

### 3. Mark stale sessions as ended during hydration

Any session loaded from SQLite with status `active` or `streaming` gets its status set to `ended` and `endedAt` set to the current timestamp — both in the Map and via an UPDATE query. If the pi session is still alive, the bridge extension will reconnect and call `register()` which does `INSERT OR REPLACE`, effectively reviving it.

## Risks / Trade-offs

- **[Up to 30s data loss on crash]** → Acceptable trade-off vs. the current total data loss. Can reduce interval if needed.
- **[40MB write every 30s]** → Negligible on modern SSDs. The file is already 40MB. If the database grows significantly, we may need to revisit (native SQLite bindings would solve this).
- **[Stale sessions briefly show as ended then revive]** → Bridge reconnects within seconds. The UI will update via the normal `session_added` broadcast. Users may see a brief flicker on restart which is acceptable.
