# Shared Config & Auto-Start

## 1. Shared Config Module

- [x] 1.1 Write tests for `loadConfig()`: config with all fields, partial fields, missing file, malformed JSON. Verify defaults applied correctly for each case.
- [x] 1.2 Write tests for `ensureConfig()`: no directory exists, directory exists but no file, file already exists. Verify file created with defaults, existing file not overwritten.
- [x] 1.3 Implement `src/shared/config.ts`: export `DashboardConfig` type, `loadConfig()`, `ensureConfig()`, and `CONFIG_DIR`/`CONFIG_FILE` constants. Use `~/.pi/dashboard/config.json` as the path. Defaults: `port: 8000`, `piPort: 9999`, `dbPath: ~/.pi/dashboard/dashboard.db`, `retentionDays: 30`, `autoStart: true`.

## 2. Server CLI Migration

- [x] 2.1 Update `src/server/cli.ts`: remove inline `ConfigFile` interface and `loadConfig()` function. Import `loadConfig`, `ensureConfig` from `src/shared/config.ts`. Call `ensureConfig()` on startup.
- [x] 2.2 Verify existing server tests still pass after migration.

## 3. Bridge Extension — Config Integration

- [x] 3.1 Write tests for TCP port probe: mock `net.connect` to simulate port open (resolve `true`) and port closed/timeout (resolve `false`).
- [x] 3.2 Implement TCP probe function in `src/extension/server-probe.ts`: attempt `net.connect()` on `localhost:{port}` with 1s timeout, return `Promise<boolean>`.
- [x] 3.3 Update `src/extension/bridge.ts`: import `loadConfig` and `ensureConfig` from shared config. In `session_start`, call `ensureConfig()` then `loadConfig()`. Build WebSocket URL from `piPort` (or `PI_DASHBOARD_URL` env var override).

## 4. Bridge Extension — Auto-Start

- [x] 4.1 Write tests for server spawning logic: verify spawn called with correct CLI path and `--port`/`--pi-port` args, verify detached + stdio ignore options, verify `unref()` called.
- [x] 4.2 Implement `src/extension/server-launcher.ts`: resolve server CLI path relative to extension (`../../server/cli.ts`), spawn detached with configured ports, monitor for early exit (within 2s) and return success/failure.
- [x] 4.3 Update `src/extension/bridge.ts` `session_start` handler: after loading config, run TCP probe. If port closed and `autoStart` is `true`, call server launcher. On success, notify user via `ctx.ui.notify("🌐 Dashboard started at http://localhost:{port}", "info")`. On failure, notify with warning. If port open or `autoStart` false, connect silently.

## 5. Documentation

- [x] 5.1 Update `docs/architecture.md`: add shared config section describing the config file, defaults, and auto-start flow.
- [x] 5.2 Update `README.md`: document `autoStart` config option, update configuration table, update local dev workflow to mention auto-start behavior.
- [x] 5.3 Update `AGENTS.md`: add `src/shared/config.ts` to key files table.
