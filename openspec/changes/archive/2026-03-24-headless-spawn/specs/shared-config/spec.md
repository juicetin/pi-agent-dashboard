## MODIFIED Requirements

### Requirement: Config file location and schema
The `DashboardConfig` interface SHALL include a `spawnStrategy` field of type `"tmux" | "headless"` with default value `"tmux"`.

#### Scenario: Config with spawnStrategy set to headless
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "spawnStrategy": "headless" }`
- **THEN** `loadConfig()` SHALL return `spawnStrategy: "headless"` with defaults for all other fields

#### Scenario: Config without spawnStrategy
- **WHEN** `~/.pi/dashboard/config.json` does not contain a `spawnStrategy` field
- **THEN** `loadConfig()` SHALL return `spawnStrategy: "tmux"`

#### Scenario: Config with invalid spawnStrategy
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "spawnStrategy": "invalid" }`
- **THEN** `loadConfig()` SHALL return `spawnStrategy: "tmux"` (fall back to default)
