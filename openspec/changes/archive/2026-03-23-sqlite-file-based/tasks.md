## 1. Dependencies

- [x] 1.1 Remove `sql.js` from package.json
- [x] 1.2 Add `better-sqlite3` and `@types/better-sqlite3` to package.json
- [x] 1.3 Run `npm install` and verify build succeeds

## 2. Database Layer

- [x] 2.1 Rewrite `src/server/db.ts` to use `better-sqlite3`: open file-based DB, enable WAL mode, run migrations, return simplified `Database` interface (no `save()` method)
- [x] 2.2 Update `Database` interface: `raw` type to `BetterSqlite3.Database`, remove `save()`, simplify `close()` to just `db.close()`

## 3. Query Call Sites

- [x] 3.1 Update `src/server/event-store.ts` to use `better-sqlite3` prepared statement API (`.prepare().all()`, `.prepare().run()`, `.prepare().get()`)
- [x] 3.2 Update any direct `db.raw` usage in `src/server/session-manager.ts`, `src/server/workspace-manager.ts`, and `src/server/server.ts` to use the new API

## 4. Remove Periodic Flush

- [x] 4.1 Remove `DB_SAVE_INTERVAL_MS`, `saveTimer`, and the `setInterval`/`clearInterval` logic from `src/server/server.ts`
- [x] 4.2 Remove any `db.save()` calls across the codebase

## 5. Tests

- [x] 5.1 Update `db.test.ts` — remove `save()` tests, verify WAL mode is enabled, verify file-based persistence
- [x] 5.2 Update `event-store.test.ts` to work with the new `better-sqlite3` API
- [x] 5.3 Update any other tests that reference `db.save()` or mock `sql.js` (session-manager, event-retention, removed periodic-save)
- [x] 5.4 Run full test suite and verify all tests pass
