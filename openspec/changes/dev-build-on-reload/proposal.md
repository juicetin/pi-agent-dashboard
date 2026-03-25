## Why

During development of pi-agent-dashboard, refreshing the full stack (extension + server + client) after code changes requires multiple manual steps: build the client, restart the server, then `/reload` in pi. A single `/reload` should be able to rebuild and restart everything automatically, controlled by a config flag.

## What Changes

- Add `devBuildOnReload` boolean config option (default `false`) to `DashboardConfig`
- When `devBuildOnReload` is `true`, the bridge cleanup hook on `/reload` will:
  - Run `npm run build` (Vite client build) synchronously, logging progress to the terminal
  - Send `POST /api/shutdown` to stop the running dashboard server
- Add `POST /api/shutdown` endpoint to the dashboard server that gracefully stops it
- The existing `autoStart` behavior then spawns a fresh server on reconnect, completing the cycle

## Capabilities

### New Capabilities
- `dev-build-on-reload`: Config-gated dev workflow that rebuilds the client and restarts the dashboard server when the bridge extension reloads via `/reload`

### Modified Capabilities
- `shared-config`: Add `devBuildOnReload` boolean field (default `false`) to the config schema
- `dashboard-server`: Add `POST /api/shutdown` endpoint that gracefully stops the server process
- `bridge-extension`: Cleanup hook gains build + shutdown behavior when `devBuildOnReload` is enabled

## Impact

- **Config**: New `devBuildOnReload` field in `~/.pi/dashboard/config.json`
- **Server**: New REST endpoint `POST /api/shutdown`
- **Extension**: `bridge.ts` cleanup hook runs `execSync` and HTTP fetch when flag is on
- **UX**: `/reload` blocks for ~2-5s during client build (dev-only, opt-in)
- **Multi-session**: Stopping the server affects all connected bridges; they auto-reconnect when one restarts it
