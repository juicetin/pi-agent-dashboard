## MODIFIED Requirements

### Requirement: Dashboard configuration schema
The shared config module SHALL load configuration from `~/.pi/dashboard/config.json` with the following fields and defaults:

- `port` (default: 8000) — HTTP/browser WebSocket port
- `piPort` (default: 9999) — Pi gateway WebSocket port
- `dbPath` (default: `~/.pi/dashboard/dashboard.db`) — SQLite database path
- `retentionDays` (default: 30) — Event retention period
- `autoStart` (default: true) — Auto-start server from bridge extension
- `autoShutdown` (default: true) — Auto-shutdown when no sessions connected
- `shutdownIdleSeconds` (default: 300) — Idle timeout before auto-shutdown
- `tunnel` (default: `{ enabled: true }`) — Tunnel configuration

#### Scenario: Default config with tunnel
- **WHEN** no config file exists and `ensureConfig()` is called
- **THEN** the created config SHALL include `tunnel: { enabled: true }`

#### Scenario: Config without tunnel field
- **WHEN** an existing config file does not have a `tunnel` field
- **THEN** `loadConfig()` SHALL return `tunnel: { enabled: true }` as the default
