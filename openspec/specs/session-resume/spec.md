## Purpose

Enables resuming and forking ended pi sessions from the dashboard UI, spawning new pi instances with the appropriate CLI flags.

## ADDED Requirements

### Requirement: Resume session (continue)
The dashboard SHALL support resuming a session by spawning a new pi instance with `pi --session <session-file-path>`. This continues the same JSONL file and reuses the same pi session ID.

#### Scenario: Resume ended session
- **WHEN** the user clicks "Resume" on an ended session that has a `sessionFile` stored
- **THEN** the server SHALL spawn pi with `pi --session <session-file-path>` in the session's cwd via tmux
- **AND** the spawned pi instance SHALL connect via the bridge with the same session ID, setting `hidden = false` and `status = "active"`

#### Scenario: Resume session without session file
- **WHEN** the user tries to resume a session that has no `sessionFile` stored (e.g., pre-migration session)
- **THEN** the server SHALL return an error indicating the session file is unknown

#### Scenario: Resume already active session
- **WHEN** the user tries to resume a session that is currently active
- **THEN** the server SHALL return an error indicating the session is already running

### Requirement: Fork session
The dashboard SHALL support forking a session by spawning a new pi instance with `pi --fork <session-file-path>`. This creates a new JSONL file with a new session ID. The server SHALL record a pending fork entry so the new session is placed after its parent in the session order.

#### Scenario: Fork ended session
- **WHEN** the user clicks "Fork" on an ended session that has a `sessionFile` stored
- **THEN** the server SHALL spawn pi with `pi --fork <session-file-path>` in the session's cwd via tmux
- **AND** pi SHALL create a new session with a new ID, which connects via the bridge as a new visible session
- **AND** the original session SHALL remain hidden
- **AND** the server SHALL record a pending fork entry with the parent session's ID and cwd

#### Scenario: Fork active session
- **WHEN** the user clicks "Fork" on an active session
- **THEN** the server SHALL spawn pi with `pi --fork <session-file-path>` in the session's cwd
- **AND** a new independent session SHALL be created without affecting the original
- **AND** the server SHALL record a pending fork entry with the parent session's ID and cwd

### Requirement: Resume/fork protocol messages
The browser SHALL send a `resume_session` message to the server specifying the session ID and mode (`"continue"` or `"fork"`). The server SHALL look up the session file and spawn pi accordingly.

#### Scenario: Continue mode
- **WHEN** the browser sends `resume_session` with `mode: "continue"` and `sessionId`
- **THEN** the server SHALL look up the `session_file` for that session and spawn `pi --session <path>`

#### Scenario: Fork mode
- **WHEN** the browser sends `resume_session` with `mode: "fork"` and `sessionId`
- **THEN** the server SHALL look up the `session_file` for that session and spawn `pi --fork <path>`

#### Scenario: Spawn result reported to browser
- **WHEN** the server spawns pi for resume/fork
- **THEN** it SHALL send a response message back to the requesting browser with `success: boolean` and `message: string`

### Requirement: Resuming flag on session
`DashboardSession` SHALL include an optional `resuming?: boolean` field that indicates the session is being auto-resumed.

#### Scenario: Resuming flag set during auto-resume
- **WHEN** an auto-resume is initiated for an ended session
- **THEN** the session's `resuming` field SHALL be set to `true`
- **AND** `session_updated` SHALL be broadcast with the change

#### Scenario: Resuming flag cleared on success
- **WHEN** the auto-resume completes successfully (prompt flushed to new session)
- **THEN** the old session's `resuming` field SHALL be set to `false`

#### Scenario: Resuming flag cleared on timeout
- **WHEN** the auto-resume times out (30 seconds)
- **THEN** the old session's `resuming` field SHALL be set to `false`
- **AND** `session_updated` SHALL be broadcast

### Requirement: Resuming visual indicator on session card
When a session has `resuming === true`, the session card SHALL display a "Resuming…" indicator.

#### Scenario: Pulsing dot and text
- **WHEN** `session.resuming` is `true`
- **THEN** the session card SHALL show a pulsing yellow status dot (same style as streaming)
- **AND** the `ActivityIndicator` SHALL display "Resuming…" in yellow text

#### Scenario: Resuming takes priority over ended state
- **WHEN** `session.resuming` is `true` and `session.status` is `"ended"`
- **THEN** the resuming indicator SHALL be shown instead of the normal ended appearance (grey dot, no activity)

### Requirement: Resume and Fork buttons disabled during resuming
When a session has `resuming === true`, the Resume and Fork buttons SHALL be disabled.

#### Scenario: Buttons disabled while resuming
- **WHEN** `session.resuming` is `true`
- **THEN** the Resume and Fork buttons SHALL be disabled with reduced opacity (`disabled:opacity-50`)

#### Scenario: Optimistic resuming state on button click
- **WHEN** the user clicks Resume or Fork
- **THEN** the client SHALL set `resuming: true` optimistically on the session
- **AND** buttons SHALL be disabled immediately

#### Scenario: Resuming cleared on failure
- **WHEN** the server returns `resume_result` with `success: false`
- **THEN** the client SHALL clear `resuming` to `false` and re-enable buttons

#### Scenario: Resuming cleared on session activation
- **WHEN** a `session_added` message arrives with `status !== "ended"` for the same cwd
- **THEN** the client SHALL clear `resuming` on any other session in that cwd
