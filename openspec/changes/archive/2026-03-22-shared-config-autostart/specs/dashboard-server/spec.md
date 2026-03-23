## MODIFIED Requirements

### Requirement: Server configuration
The dashboard server SHALL accept configuration via CLI flags, environment variables, and the shared config module which reads `~/.pi/dashboard/config.json`. The server CLI SHALL import `loadConfig()` from `src/shared/config.ts` instead of implementing its own config loading.

Configurable options:
- `port` (default: 8000, env: `PI_DASHBOARD_PORT`)
- `piPort` (default: 9999, env: `PI_DASHBOARD_PI_PORT`)
- `dbPath` (default: `~/.pi/dashboard/dashboard.db`)
- `retentionDays` (default: 30)
- `autoStart` (default: true) — read by the bridge extension, not used by the server itself

CLI flags SHALL override environment variables, which SHALL override config file values.

On startup, the server SHALL call `ensureConfig()` from the shared config module to create the default config file if it does not exist.

#### Scenario: Custom ports via CLI
- **WHEN** the server starts with `--port 3000 --pi-port 3001`
- **THEN** it SHALL listen on port 3000 for HTTP/browser-WS and port 3001 for pi-extension-WS

#### Scenario: Default configuration
- **WHEN** the server starts with no configuration
- **THEN** it SHALL use default ports 8000 and 9999, and create the database at `~/.pi/dashboard/dashboard.db`

#### Scenario: First-time server start creates config
- **WHEN** the server starts and `~/.pi/dashboard/config.json` does not exist
- **THEN** it SHALL create the config file with default values before proceeding
