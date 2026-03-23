## Why

The dashboard server uses sql.js (pure JS/WASM SQLite) which operates entirely in-memory and requires periodic flushing to disk every 30 seconds. This creates a data loss window on crash, wastes memory by holding the entire DB in the JS heap, and performs expensive full-database serialization on every save. Switching to a file-based SQLite engine eliminates all three problems.

## What Changes

- **BREAKING**: Replace `sql.js` dependency with `better-sqlite3` (native Node.js SQLite binding)
- Enable WAL (Write-Ahead Logging) mode for better concurrent read/write performance
- Remove periodic database flush mechanism (`save()`, `setInterval`, `db.export()`)
- Simplify the `Database` interface — no more `save()` method
- All writes persist immediately to disk (zero data loss on crash)

## Capabilities

### New Capabilities

_(none — this is a pure implementation swap)_

### Modified Capabilities

- `event-persistence`: Remove the "Periodic database flush to disk" requirement. Replace with immediate file-based persistence. All other event-persistence requirements remain unchanged.

## Impact

- **Dependencies**: `sql.js` removed, `better-sqlite3` + `@types/better-sqlite3` added. Native addon requires build toolchain or prebuilt binaries.
- **Code**: `src/server/db.ts` (major rewrite), `src/server/event-store.ts` (API changes), `src/server/server.ts` (remove flush timer), tests updated.
- **API**: No external API changes. The `Database` interface loses `save()` method (internal only).
- **Data**: Existing `dashboard.db` files are standard SQLite — fully compatible with `better-sqlite3`.
