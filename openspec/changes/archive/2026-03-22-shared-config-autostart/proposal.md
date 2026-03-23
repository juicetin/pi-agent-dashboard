## Why

The bridge extension and dashboard server both need configuration (ports, paths) but currently read it independently — the server reads `~/.pi/dashboard/config.json` while the extension hardcodes `ws://localhost:9999` with only an env var override. This means users must set `PI_DASHBOARD_URL` per-session if they change the server port. Additionally, users must manually start the dashboard server in a separate terminal before pi sessions can connect, adding friction to the setup.

## What Changes

- **Shared config module** (`src/shared/config.ts`): Extract configuration loading into a shared module imported by both the server CLI and bridge extension. Single source of truth for `~/.pi/dashboard/config.json`.
- **Auto-create default config**: If `~/.pi/dashboard/config.json` doesn't exist when either component reads it, create it with sensible defaults so users always have a file to edit.
- **Add `autoStart` config option**: New boolean field (default `true`) that tells the bridge extension to spawn the dashboard server if it detects the server is not running.
- **Bridge reads config for WebSocket URL**: The extension reads `piPort` from the shared config instead of hardcoding `9999`. Removes reliance on `PI_DASHBOARD_URL` env var for port configuration.
- **Auto-start server from extension**: On `session_start`, the bridge extension probes `localhost:{piPort}` via TCP. If the port is closed and `autoStart` is `true`, it spawns the server as a detached process, resolving the CLI script path relative to its own location.
- **Notify user on server start**: When the extension spawns the server, it uses `ctx.ui.notify()` to display `🌐 Dashboard started at http://localhost:{port}`. Silent when server is already running.
- **Server CLI imports shared config**: Remove the inline `loadConfig()` from `src/server/cli.ts` and import from `src/shared/config.ts`.

## Capabilities

### New Capabilities
- `shared-config`: Shared configuration module that loads/creates `~/.pi/dashboard/config.json`, used by both server and extension. Defines the config schema including `port`, `piPort`, `dbPath`, `retentionDays`, and `autoStart`.

### Modified Capabilities
- `bridge-extension`: Extension reads port config from shared config instead of hardcoding. Adds TCP probe and auto-start logic on `session_start`. Notifies user when server is spawned.
- `dashboard-server`: Server CLI imports shared config loader instead of inline implementation.

## Impact

- **Files changed**: `src/shared/config.ts` (new), `src/extension/bridge.ts`, `src/server/cli.ts`, `docs/architecture.md`, `README.md`
- **Dependencies**: None new — uses `node:net` for TCP probe, `node:child_process` for spawning (both built-in).
- **Config file**: `~/.pi/dashboard/config.json` gains the `autoStart` field. Existing configs without it default to `true`.
- **Backwards compatible**: Existing setups continue working. `PI_DASHBOARD_URL` env var still works as a final override.
