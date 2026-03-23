## ADDED Requirements

### Requirement: Config file location and schema
The shared config module SHALL read configuration from `~/.pi/dashboard/config.json`. The config schema SHALL include the following fields with defaults:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | 8000 | HTTP + Browser WebSocket port |
| `piPort` | number | 9999 | Pi extension WebSocket port |
| `dbPath` | string | `~/.pi/dashboard/dashboard.db` | SQLite database path |
| `retentionDays` | number | 30 | Event retention period in days |
| `autoStart` | boolean | true | Whether the extension auto-starts the server |

#### Scenario: Config with all fields present
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 3000, "piPort": 4000, "autoStart": false }`
- **THEN** `loadConfig()` SHALL return those values with defaults for omitted fields

#### Scenario: Config with partial fields
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 3000 }`
- **THEN** `loadConfig()` SHALL return `port: 3000` with all other fields at their defaults

#### Scenario: Empty or missing config
- **WHEN** `~/.pi/dashboard/config.json` does not exist or is empty
- **THEN** `loadConfig()` SHALL return all default values

### Requirement: Auto-create config on first access
The shared config module SHALL provide an `ensureConfig()` function that creates `~/.pi/dashboard/config.json` with default values if it does not exist. The directory `~/.pi/dashboard/` SHALL be created recursively if needed.

#### Scenario: First-time access with no config directory
- **WHEN** `ensureConfig()` is called and `~/.pi/dashboard/` does not exist
- **THEN** it SHALL create the directory and write `config.json` with all default values

#### Scenario: Config already exists
- **WHEN** `ensureConfig()` is called and `~/.pi/dashboard/config.json` already exists
- **THEN** it SHALL not modify the existing file

#### Scenario: Config directory exists but no config file
- **WHEN** `~/.pi/dashboard/` exists but `config.json` does not
- **THEN** `ensureConfig()` SHALL create `config.json` with default values

### Requirement: Shared module importable by both components
The shared config module SHALL be importable by both `src/extension/bridge.ts` and `src/server/cli.ts`. It SHALL export `loadConfig()`, `ensureConfig()`, and the `DashboardConfig` type.

#### Scenario: Server CLI imports shared config
- **WHEN** the server CLI starts
- **THEN** it SHALL import `loadConfig()` from the shared config module instead of using inline config loading

#### Scenario: Bridge extension imports shared config
- **WHEN** the bridge extension loads
- **THEN** it SHALL import `loadConfig()` from the shared config module to determine the WebSocket port
