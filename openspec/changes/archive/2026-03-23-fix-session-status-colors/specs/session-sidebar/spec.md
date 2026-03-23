## MODIFIED Requirements

### Requirement: Active session list
The session sidebar SHALL display all active and idle sessions for the selected workspace. Each session entry SHALL show:
- Status indicator (🟢 green dot for active/idle, 🟡 yellow pulsing dot for streaming, ⚫ gray for ended)
- Source badge (TUI / Zed / tmux)
- Model name and thinking level
- Token count (formatted: e.g., "45.2k")
- Cost (formatted: e.g., "$0.23")
- Current tool being executed (if any, e.g., "🔧 reading files")
- Session display name or auto-generated label

#### Scenario: Session starts streaming
- **WHEN** an `agent_start` event arrives for a session
- **THEN** the sidebar SHALL update the status indicator to yellow pulsing and show "● streaming"

#### Scenario: Session becomes idle
- **WHEN** an `agent_end` event arrives for a session
- **THEN** the sidebar SHALL update the status indicator to green/connected and show "● idle"

#### Scenario: Session is active (connected, no agent activity yet)
- **WHEN** a session is registered but no agent activity has occurred
- **THEN** the sidebar SHALL show a green status indicator

#### Scenario: Session ends
- **WHEN** a session is unregistered or heartbeat times out
- **THEN** the sidebar SHALL show a gray status indicator

#### Scenario: Tool execution in progress
- **WHEN** a `tool_execution_start` event arrives
- **THEN** the sidebar SHALL show the tool name (e.g., "🔧 read") next to the session until `tool_execution_end` arrives

#### Scenario: Stats update
- **WHEN** a `session_updated` event arrives with new token/cost stats
- **THEN** the sidebar SHALL update the displayed values in real-time
