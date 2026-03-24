## ADDED Requirements

### Requirement: OpenSpec polling
The bridge extension SHALL poll `openspec list --json` and `openspec status --change <name> --json` for each change every 30 seconds. It SHALL send an `openspec_update` message when data changes.

#### Scenario: Poll on session start
- **WHEN** the session starts
- **THEN** the extension runs openspec CLI and sends an initial `openspec_update`

#### Scenario: Periodic poll with changes
- **WHEN** 30 seconds elapse and openspec data has changed
- **THEN** the extension sends an `openspec_update` with the new data

#### Scenario: Periodic poll without changes
- **WHEN** 30 seconds elapse but openspec data is unchanged
- **THEN** no message is sent

### Requirement: OpenSpec refresh handling
The bridge extension SHALL handle `openspec_refresh` messages by immediately running the CLI and responding with `openspec_update`.

#### Scenario: Refresh request
- **WHEN** the extension receives an `openspec_refresh` message
- **THEN** it runs the openspec CLI immediately and sends `openspec_update`

### Requirement: Graceful CLI failure
The extension SHALL handle openspec CLI failures gracefully without crashing.

#### Scenario: CLI not found
- **WHEN** `openspec` is not installed
- **THEN** the extension sends `openspec_update` with `{ initialized: false, changes: [] }`

#### Scenario: Project not initialized
- **WHEN** `openspec list --json` returns an error (no openspec dir)
- **THEN** the extension sends `openspec_update` with `{ initialized: false, changes: [] }`
