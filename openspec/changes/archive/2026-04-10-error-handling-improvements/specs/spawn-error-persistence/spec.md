## ADDED Requirements

### Requirement: Persistent spawn error display
When a session spawn fails, the error SHALL be shown as a persistent dismissible banner in the workspace area, not only as a transient toast.

#### Scenario: Spawn fails with error message
- **WHEN** a `spawn_result` message arrives with `success: false`
- **THEN** a dismissible error banner SHALL be shown in the workspace for that `cwd`
- **AND** the toast notification SHALL still appear (existing behavior preserved)

#### Scenario: User dismisses spawn error
- **WHEN** user clicks the dismiss button on the spawn error banner
- **THEN** the banner SHALL disappear

#### Scenario: Successful spawn clears error
- **WHEN** a previous spawn error banner is visible for a workspace
- **AND** a new `spawn_result` arrives with `success: true` for the same `cwd`
- **THEN** the error banner SHALL be cleared

### Requirement: Persistent resume error display
When a session resume fails, the error SHALL be shown as a persistent dismissible banner near the session card, not only logged to console.

#### Scenario: Resume fails with error message
- **WHEN** a `resume_result` message arrives with `success: false`
- **THEN** a dismissible error banner SHALL be shown near the session card
- **AND** the `resuming` flag SHALL be cleared

#### Scenario: User dismisses resume error
- **WHEN** user clicks the dismiss button on the resume error banner
- **THEN** the banner SHALL disappear
