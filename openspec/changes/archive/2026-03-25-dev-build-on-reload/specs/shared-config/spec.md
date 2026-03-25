## MODIFIED Requirements

### Requirement: Config file location and schema
The shared config module SHALL read configuration from `~/.pi/dashboard/config.json`. The config schema SHALL include the following fields with defaults:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | 8000 | HTTP + Browser WebSocket port |
| `piPort` | number | 9999 | Pi extension WebSocket port |
| `dbPath` | string | `~/.pi/dashboard/dashboard.db` | SQLite database path |
| `retentionDays` | number | 30 | Event retention period in days |
| `autoStart` | boolean | true | Whether the extension auto-starts the server |
| `autoShutdown` | boolean | true | Whether the server auto-shuts down when idle |
| `shutdownIdleSeconds` | number | 300 | Seconds to wait after last pi session disconnects before shutting down |
| `tunnel.enabled` | boolean | true | Whether to create a zrok public tunnel on server startup |
| `devBuildOnReload` | boolean | false | Whether to build client and restart server on `/reload` |

#### Scenario: Config with all fields present
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 3000, "piPort": 4000, "autoStart": false }`
- **THEN** `loadConfig()` SHALL return those values with defaults for omitted fields

#### Scenario: Config with partial fields
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 3000 }`
- **THEN** `loadConfig()` SHALL return `port: 3000` with all other fields at their defaults

#### Scenario: Empty or missing config
- **WHEN** `~/.pi/dashboard/config.json` does not exist or is empty
- **THEN** `loadConfig()` SHALL return all default values

#### Scenario: Config with auto-shutdown fields
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "autoShutdown": false, "shutdownIdleSeconds": 60 }`
- **THEN** `loadConfig()` SHALL return those values with defaults for all other fields

#### Scenario: Config with devBuildOnReload enabled
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "devBuildOnReload": true }`
- **THEN** `loadConfig()` SHALL return `devBuildOnReload: true` with defaults for all other fields

#### Scenario: Config without devBuildOnReload
- **WHEN** `~/.pi/dashboard/config.json` does not include `devBuildOnReload`
- **THEN** `loadConfig()` SHALL return `devBuildOnReload: false`
