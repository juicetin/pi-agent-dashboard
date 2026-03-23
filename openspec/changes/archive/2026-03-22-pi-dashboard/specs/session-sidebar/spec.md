## ADDED Requirements

### Requirement: Active session list
The session sidebar SHALL display all active and idle sessions for the selected workspace. Each session entry SHALL show:
- Status indicator (🟢 green dot for active/streaming, 🟡 yellow for idle, ⚫ gray for ended)
- Source badge (TUI / Zed / tmux)
- Model name and thinking level
- Token count (formatted: e.g., "45.2k")
- Cost (formatted: e.g., "$0.23")
- Current tool being executed (if any, e.g., "🔧 reading files")
- Session display name or auto-generated label

#### Scenario: Session starts streaming
- **WHEN** an `agent_start` event arrives for a session
- **THEN** the sidebar SHALL update the status indicator to green/active and show "● streaming"

#### Scenario: Session becomes idle
- **WHEN** an `agent_end` event arrives for a session
- **THEN** the sidebar SHALL update the status indicator to yellow/idle and show "● idle"

#### Scenario: Tool execution in progress
- **WHEN** a `tool_execution_start` event arrives
- **THEN** the sidebar SHALL show the tool name (e.g., "🔧 read") next to the session until `tool_execution_end` arrives

#### Scenario: Stats update
- **WHEN** a `session_updated` event arrives with new token/cost stats
- **THEN** the sidebar SHALL update the displayed values in real-time

### Requirement: Session selection
Clicking a session in the sidebar SHALL select it and display its conversation in the chat view. The selected session SHALL be visually highlighted.

#### Scenario: Select active session
- **WHEN** a user clicks an active session in the sidebar
- **THEN** the chat view SHALL load and display that session's conversation with live streaming

#### Scenario: Select inactive session
- **WHEN** a user clicks an inactive session
- **THEN** the chat view SHALL load the session's historical conversation (read-only, no input box)

#### Scenario: Selected session ends
- **WHEN** the currently selected session's pi process exits
- **THEN** the chat view SHALL show a "Session ended" indicator and disable the input box

### Requirement: Inactive sessions toggle
The sidebar SHALL show inactive (ended) sessions in a collapsed section with a toggle. When expanded, inactive sessions SHALL show with basic metadata (name, date, model, cost).

#### Scenario: Toggle inactive sessions
- **WHEN** a user clicks the "Inactive" toggle in the sidebar
- **THEN** the section SHALL expand to show ended sessions for the selected workspace

#### Scenario: Filter inactive sessions
- **WHEN** inactive sessions are shown
- **THEN** they SHALL be sorted by last activity timestamp (most recent first) and limited to sessions within the 30-day retention period

### Requirement: New session button
The sidebar SHALL include a "+ New session" button that spawns a new pi session in the selected workspace via tmux (see process-manager spec).

#### Scenario: Click new session
- **WHEN** a user clicks "+ New session" in a workspace
- **THEN** the system SHALL spawn pi in tmux for that workspace's path and show a "Starting..." indicator until the session connects

#### Scenario: New session without workspace selected
- **WHEN** a user clicks "+ New session" with no workspace selected
- **THEN** the system SHALL show a workspace picker dialog before spawning

### Requirement: Mobile swipe drawer
On mobile viewports (width < 768px), the session sidebar SHALL be hidden by default and accessible via a swipe-from-left gesture or hamburger menu button.

#### Scenario: Open drawer on mobile
- **WHEN** a user swipes from the left edge or taps the hamburger icon on mobile
- **THEN** the session sidebar SHALL slide in as an overlay

#### Scenario: Close drawer on session select
- **WHEN** a user selects a session in the mobile drawer
- **THEN** the drawer SHALL close and the chat view SHALL show the selected session
