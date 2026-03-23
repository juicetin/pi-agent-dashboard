## ADDED Requirements

### Requirement: Server-side session status extraction from forwarded events
The dashboard server SHALL inspect `event_forward` messages and update session metadata when activity-relevant events are detected. The server SHALL broadcast `session_updated` to all browser clients for each status change.

The following event types SHALL trigger session updates:
- `agent_start`: set session status to `"streaming"`, clear `currentTool`
- `agent_end`: set session status to `"idle"`, clear `currentTool`
- `tool_execution_start`: set `currentTool` to the tool name from the event data
- `tool_execution_end`: clear `currentTool`

#### Scenario: Agent starts streaming
- **WHEN** the server receives an `event_forward` with `eventType: "agent_start"`
- **THEN** it SHALL update the session's status to `"streaming"` and broadcast `session_updated` with `{ status: "streaming" }` to all browser clients

#### Scenario: Agent finishes and waits for input
- **WHEN** the server receives an `event_forward` with `eventType: "agent_end"`
- **THEN** it SHALL update the session's status to `"idle"` and clear `currentTool`, broadcasting `session_updated` with `{ status: "idle", currentTool: undefined }` to all browser clients

#### Scenario: Tool execution begins
- **WHEN** the server receives an `event_forward` with `eventType: "tool_execution_start"` and the event data contains `toolName: "Read"`
- **THEN** it SHALL update the session's `currentTool` to `"Read"` and broadcast `session_updated` with `{ currentTool: "Read" }`

#### Scenario: Tool execution ends
- **WHEN** the server receives an `event_forward` with `eventType: "tool_execution_end"`
- **THEN** it SHALL clear the session's `currentTool` and broadcast `session_updated` with `{ currentTool: undefined }`

#### Scenario: Rapid tool calls
- **WHEN** multiple `tool_execution_start` and `tool_execution_end` events arrive in quick succession
- **THEN** the server SHALL update and broadcast for each event individually without debouncing
