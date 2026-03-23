## MODIFIED Requirements

### Requirement: Active session list
The session sidebar SHALL display all active and idle sessions for the selected workspace. Each session entry SHALL show:
- Status indicator (🟢 green dot for active/idle, 🟡 yellow pulsing dot for streaming, ⚫ gray for ended)
- Source badge (TUI / Zed / tmux)
- Model name and thinking level (e.g., "claude-4-sonnet (high)")
- Token count (formatted: e.g., "45.2k in" / "12k out")
- Cost (formatted: e.g., "$0.23")
- Current tool being executed (if any, e.g., "⚡ Read")
- Relative time since session started (e.g., "3m", "1h")
- Session display name or auto-generated label

#### Scenario: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, source badge, and relative time; second line with model name and thinking level in parentheses; third line with activity indicator (current tool or state label) and token/cost stats

#### Scenario: Thinking level displayed
- **WHEN** a session has both `model` and `thinkingLevel` set
- **THEN** the card SHALL display them as "model-name (thinking-level)" on line 2

#### Scenario: Thinking level absent
- **WHEN** a session has `model` set but `thinkingLevel` is undefined
- **THEN** the card SHALL display only the model name on line 2

#### Scenario: Token formatting
- **WHEN** token counts are displayed
- **THEN** values above 1000 SHALL be formatted with "k" suffix (e.g., 12400 → "12.4k"), values below 1000 SHALL show as-is
