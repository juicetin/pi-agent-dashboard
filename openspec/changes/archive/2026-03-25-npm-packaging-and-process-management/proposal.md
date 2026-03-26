## Why

The dashboard is on GitHub and has a `pi install` flow, but it's not actually publishable — the npm scope is a placeholder (`@user/pi-dashboard`), `tsx` is a devDependency yet required at runtime for the server CLI, and the README has stale references. Additionally, the server runs as a fire-and-forget detached process with no way to manage it (stop, restart, check status). Users need a reliable `pi-dashboard start/stop/restart/status` workflow.

## What Changes

- **BREAKING**: Rename package from `@user/pi-dashboard` to `@blackbelt-technology/pi-dashboard`
- Move `tsx` from `devDependencies` to `dependencies` so the server CLI works when installed via npm
- Add subcommands to `pi-dashboard` CLI: `start`, `stop`, `restart`, `status`
- Write a PID file at `~/.pi/dashboard/server.pid` when the server starts as a daemon
- Add a `/api/health` endpoint for liveness checks
- Update the bridge extension's `server-launcher.ts` to use the same PID file mechanism
- Fix README stale `pi-chainlint` references and update install instructions for new scope
- `pi-dashboard` with no subcommand runs in foreground (backward compatible)

## Capabilities

### New Capabilities
- `server-process-management`: PID file tracking and CLI subcommands (start/stop/restart/status) for managing the dashboard server as a daemon process

### Modified Capabilities
- `packaging`: Rename scope to `@blackbelt-technology`, move tsx to dependencies, fix README references
- `dashboard-server`: Add `/api/health` endpoint, write PID file on startup

## Impact

- `package.json` — name, dependencies
- `src/server/cli.ts` — subcommand parsing, daemonization
- `src/server/server.ts` — health endpoint
- New `src/server/server-pid.ts` — PID file read/write/check
- `src/extension/server-launcher.ts` — use PID file instead of fire-and-forget
- `README.md` — install instructions, scope references
