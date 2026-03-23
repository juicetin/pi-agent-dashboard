## MODIFIED Requirements

### Requirement: Session registry
The dashboard server SHALL maintain an in-memory registry of all connected pi sessions, indexed by piSessionId. The registry SHALL be backed by SQLite for persistence across server restarts.

On initialization, the session manager SHALL load all existing session records from SQLite into the in-memory Map. Any session with status `active` or `streaming` SHALL be updated to status `ended` with `endedAt` set to the current timestamp, both in memory and in SQLite.

#### Scenario: Session registration
- **WHEN** an extension sends `session_register`
- **THEN** the server SHALL add the session to the registry, match it to a workspace by cwd prefix, persist to SQLite, and broadcast `session_added` to subscribed browsers

#### Scenario: Session unregistration
- **WHEN** an extension sends `session_unregister` or disconnects
- **THEN** the server SHALL update the session status to `ended`, persist to SQLite, and broadcast `session_removed` to subscribed browsers

#### Scenario: Server restart with existing sessions
- **WHEN** the dashboard server restarts while pi sessions are still running
- **THEN** extensions SHALL reconnect and re-register, and the server SHALL update existing session records rather than creating duplicates

#### Scenario: Session hydration on startup
- **WHEN** the server starts and the SQLite database contains previous session records
- **THEN** the session manager SHALL load all sessions into memory and they SHALL be visible via `listAll()`

#### Scenario: Stale active sessions marked as ended on startup
- **WHEN** the server starts and SQLite contains sessions with status `active` or `streaming`
- **THEN** those sessions SHALL be updated to status `ended` with `endedAt` set to the current timestamp

#### Scenario: Reconnecting session revives ended record
- **WHEN** a pi session reconnects after server restart and sends `session_register` with the same id
- **THEN** the server SHALL replace the ended session record with a new active one via `INSERT OR REPLACE`
