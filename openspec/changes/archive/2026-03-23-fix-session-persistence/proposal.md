## Why

The dashboard uses sql.js (pure JavaScript SQLite) which operates entirely in-memory. `db.save()` is never called during normal operation — only on graceful shutdown via `db.close()`. If the server is killed, crashes, or restarts ungracefully, all sessions and events since startup are lost. Additionally, the session manager never hydrates its in-memory Map from SQLite on startup, so even data that was saved is invisible to the API and UI after a restart.

## What Changes

- **Periodic database flush**: Call `db.save()` at regular intervals (e.g., every 30 seconds) to persist in-memory SQLite state to disk during normal operation.
- **Session hydration on startup**: Load existing session records from SQLite into the in-memory Map when `createSessionManager` initializes.
- **Stale session cleanup**: Mark any sessions with status `active` or `streaming` as `ended` during hydration, since those sessions are no longer connected after a restart. If a pi session is still running, the bridge will reconnect and re-register.

## Capabilities

### New Capabilities

_(none — this is a bug fix for existing capabilities)_

### Modified Capabilities

- `event-persistence`: Add requirement for periodic database flush to disk during normal operation (not just on shutdown).
- `dashboard-server`: Clarify that session registry must hydrate from SQLite on startup and mark stale active sessions as ended.

## Impact

- `src/server/db.ts` — Add periodic save mechanism or auto-save wrapper
- `src/server/session-manager.ts` — Load sessions from SQLite on init, mark stale sessions as ended
- `src/server/server.ts` — Wire up periodic save (timer start/stop lifecycle)
- Tests for session hydration and periodic save behavior
