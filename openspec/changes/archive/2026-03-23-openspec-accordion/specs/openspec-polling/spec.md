## ADDED Requirements

### Requirement: Extension polls openspec CLI periodically
The bridge extension SHALL run `openspec list --json` and `openspec status --change <name> --json` every 30 seconds and send the combined result as an `openspec_update` message.

#### Scenario: First poll on session start
- **WHEN** a pi session starts and the extension connects
- **THEN** the extension runs the openspec CLI and sends an `openspec_update` message

#### Scenario: Periodic poll
- **WHEN** 30 seconds have elapsed since the last poll
- **THEN** the extension runs the openspec CLI and sends an `openspec_update` if data changed

#### Scenario: CLI not installed
- **WHEN** `openspec` CLI is not available or project not initialized
- **THEN** the extension sends `openspec_update` with `{ initialized: false, changes: [] }`

### Requirement: Browser can request immediate refresh
The browser SHALL be able to send an `openspec_refresh` message to trigger an immediate poll from the extension.

#### Scenario: Refresh request
- **WHEN** the browser sends `openspec_refresh` for a session
- **THEN** the server forwards it to the extension, which runs the CLI immediately and responds with `openspec_update`
