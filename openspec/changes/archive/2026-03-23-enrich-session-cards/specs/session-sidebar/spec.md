## MODIFIED Requirements

### Requirement: Active session list
The session sidebar SHALL display all active and idle sessions for the selected workspace. Each session entry SHALL show:
- Status indicator (🟢 green dot for streaming, 🟡 yellow pulsing for active/processing, ⚪ gray dot for idle/waiting, ⚫ dark gray for ended)
- Source badge (TUI / Zed / tmux)
- Model name and thinking level
- Token count (formatted: e.g., "45.2k in" / "12k out")
- Cost (formatted: e.g., "$0.23")
- Current tool being executed (if any, e.g., "⚡ Read")
- Relative time since session started (e.g., "3m", "1h")
- Session display name or auto-generated label

#### Scenario: Session starts streaming
- **WHEN** a `session_updated` event arrives with `status: "streaming"`
- **THEN** the sidebar SHALL update the status indicator to green and show the streaming state

#### Scenario: Session becomes idle
- **WHEN** a `session_updated` event arrives with `status: "idle"`
- **THEN** the sidebar SHALL update the status indicator to gray/idle

#### Scenario: Tool execution in progress
- **WHEN** a `session_updated` event arrives with `currentTool` set to a tool name
- **THEN** the sidebar SHALL show the tool name (e.g., "⚡ Read") on the session card until a subsequent update clears `currentTool`

#### Scenario: Stats update
- **WHEN** a `session_updated` event arrives with new token/cost stats
- **THEN** the sidebar SHALL update the displayed token counts and cost values in real-time

#### Scenario: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, source badge, and relative time; second line with model name; third line with activity indicator (current tool or state label) and token/cost stats

#### Scenario: Token formatting
- **WHEN** token counts are displayed
- **THEN** values above 1000 SHALL be formatted with "k" suffix (e.g., 12400 → "12.4k"), values below 1000 SHALL show as-is
