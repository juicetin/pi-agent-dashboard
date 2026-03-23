## MODIFIED Requirements

### Requirement: Shared data model types
The system SHALL define TypeScript types for the core data models shared across all components.

Types SHALL include:
- `Workspace`: id, name, path, sortOrder, createdAt
- `DashboardSession`: id, workspaceId, piSessionId, piSessionFile, cwd, source (tui|zed|tmux|unknown), displayName, status (active|idle|streaming|ended), model info, thinking level, token stats, cost, currentTool, timestamps
- `DashboardEvent`: id, sessionId, seq, eventType, payload, createdAt
- `SessionSource`: enum of tui, zed, tmux, unknown
- `SessionStatus`: enum of active, idle, streaming, ended
- `CommandInfo`: name, description, source, location, path

#### Scenario: Session status transitions
- **WHEN** a session status changes
- **THEN** it SHALL only transition through valid states: active → streaming → idle (cycling) or active/streaming/idle → ended (terminal)

#### Scenario: Idle status represents waiting for input
- **WHEN** a session's agent turn completes (`agent_end`)
- **THEN** the session status SHALL be `"idle"`, indicating it is waiting for user input
