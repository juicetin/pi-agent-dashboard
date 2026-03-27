## ADDED Requirements

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
