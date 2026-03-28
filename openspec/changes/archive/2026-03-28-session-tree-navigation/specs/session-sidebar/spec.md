## ADDED Requirements

### Requirement: Fork relationship indicator
When a session was created via a fork operation (indicated by a `session_snapshot` with `reason: "fork"` and `forkedFrom` field), the session card in the sidebar SHALL display a small "🔀 forked" badge.

#### Scenario: Forked session badge
- **WHEN** a session receives a `session_snapshot` with `reason: "fork"` and `forkedFrom` is set
- **THEN** the session card SHALL display a "🔀 forked" badge below the session metadata

#### Scenario: Non-forked session
- **WHEN** a session has never received a fork snapshot
- **THEN** no fork badge SHALL be displayed on the session card
