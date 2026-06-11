## ADDED Requirements

### Requirement: `keeperLog.capturePiOutput` config field gates keeper pi-output capture
The config SHALL support a `keeperLog` object with a boolean `capturePiOutput` field that controls whether per-session keepers archive pi's stdout/stderr into `keeper-<sessionId>.log`. `loadConfig` SHALL default `keeperLog` to `{ capturePiOutput: false }` (capture OFF) when the field is absent. A non-object `keeperLog` or a non-boolean `capturePiOutput` SHALL fall back to the default. `ensureConfig` SHALL NOT write `keeperLog` into the on-disk defaults (absent field implies capture OFF).

#### Scenario: Default value is false when field absent
- **WHEN** `loadConfig` reads a config with no `keeperLog` key
- **THEN** the resolved config SHALL have `keeperLog.capturePiOutput === false`

#### Scenario: Explicit true is preserved
- **WHEN** the config file contains `{ "keeperLog": { "capturePiOutput": true } }`
- **THEN** the resolved config SHALL have `keeperLog.capturePiOutput === true`

#### Scenario: Non-boolean value falls back to default
- **WHEN** the config file contains `{ "keeperLog": { "capturePiOutput": "yes" } }`
- **THEN** the resolved config SHALL have `keeperLog.capturePiOutput === false`

#### Scenario: Round-trip via PUT /api/config
- **WHEN** a client PUTs `{ "keeperLog": { "capturePiOutput": true } }` to `/api/config`
- **THEN** the value SHALL be persisted and returned on the next config read
