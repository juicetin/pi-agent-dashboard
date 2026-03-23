## 1. Periodic Database Flush

- [x] 1.1 Add test: `db.save()` is called periodically during server operation (verify file on disk updates after writes)
- [x] 1.2 Add `setInterval` in `createServer` that calls `db.save()` every 30 seconds, clear on `server.stop()`

## 2. Session Hydration on Startup

- [x] 2.1 Add test: `createSessionManager` loads existing sessions from SQLite into memory on init
- [x] 2.2 Add test: sessions with status `active` or `streaming` are marked as `ended` with `endedAt` set during hydration
- [x] 2.3 Implement session hydration in `createSessionManager` — query all rows from `sessions` table, map to `DashboardSession`, populate the Map
- [x] 2.4 Implement stale session cleanup — UPDATE status to `ended` for active/streaming sessions, set `endedAt` to current timestamp

## 3. Integration Verification

- [x] 3.1 Add test: after server restart, `/api/sessions` returns previously persisted sessions
- [x] 3.2 Add test: reconnecting pi session with same id replaces the ended record
