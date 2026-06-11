## ADDED Requirements

### Requirement: Capture pi session output toggle in General tab
The Settings panel General tab SHALL render a "Capture pi session output (debug)" toggle alongside the diagnostic tooling (`DiagnosticsSection` / `ToolsSection` / `SpawnFailuresSection`). The toggle SHALL be bound to `config.keeperLog.capturePiOutput`, SHALL default to off when the field is absent, and SHALL include explanatory help text noting that capture is for debugging and consumes disk. Changes SHALL be included in the save diff and persisted via the config write endpoint.

#### Scenario: Toggle reflects current config
- **WHEN** the General tab renders with `config.keeperLog.capturePiOutput === false` (or absent)
- **THEN** the "Capture pi session output (debug)" toggle SHALL be off

#### Scenario: Toggling on persists to config
- **WHEN** the user enables the toggle and saves
- **THEN** the save diff SHALL include `keeperLog.capturePiOutput: true`
- **AND** the config write endpoint SHALL persist the value

#### Scenario: Toggle placed with diagnostic tools
- **WHEN** the General tab is displayed
- **THEN** the toggle SHALL appear in the same region as the diagnostics sections, not under an unrelated section
