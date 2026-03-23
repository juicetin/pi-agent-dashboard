## MODIFIED Requirements

### Requirement: Session registry
The dashboard server SHALL maintain an in-memory registry of all connected pi sessions, indexed by piSessionId. The registry SHALL be backed by SQLite for persistence across server restarts.

On initialization, the session manager SHALL load all existing session records from SQLite into the in-memory Map. Any session with status `active` or `streaming` SHALL be updated to status `ended` with `endedAt` set to the current timestamp, both in memory and in SQLite.

The sessions table SHALL include columns for: `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. These SHALL be added via migration if the table already exists.

When `update()` is called with session field changes, the session manager SHALL persist the following fields to SQLite if present in the updates: `status`, `ended_at`, `tokens_in`, `tokens_out`, `cost`, `model`, `thinking_level`, `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. Transient fields like `currentTool` SHALL only be updated in memory.

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

#### Scenario: Stats persisted on update
- **WHEN** `update()` is called with `tokensIn`, `tokensOut`, or `cost` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Git info persisted on update
- **WHEN** `update()` is called with `gitBranch`, `gitBranchUrl`, `gitPrNumber`, or `gitPrUrl` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Cache stats persisted on update
- **WHEN** `update()` is called with `cacheRead` or `cacheWrite` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Transient fields not persisted
- **WHEN** `update()` is called with only `currentTool` changes
- **THEN** no SQL UPDATE SHALL be executed

#### Scenario: Git and cache fields hydrated on startup
- **WHEN** the server starts and SQLite contains sessions with git and cache data
- **THEN** the hydrated session objects SHALL include those fields
