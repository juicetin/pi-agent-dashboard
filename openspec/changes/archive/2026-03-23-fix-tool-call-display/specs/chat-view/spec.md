## MODIFIED Requirements

### Requirement: Tool call rendering (collapsed by default)
The chat view SHALL render tool calls as collapsible step blocks using the `ToolCallStep` component. Each tool call SHALL appear in the message list immediately when `tool_execution_start` is received, showing a running/spinner state. On `tool_execution_end`, the same message SHALL update in-place to show completion status.

Each tool call SHALL be collapsed by default, showing only a one-line summary: status icon, tool name, and a brief description of the arguments.

When expanded, the tool call SHALL display:
- **Args section**: The tool arguments as formatted JSON
- **Output section**: The tool result text, truncated to 30 lines maximum

Collapsed summaries by tool type:
- `read`: "Read {filepath}"
- `bash`: "$ {command} (truncated to 60 chars)"
- `edit`: "Edit {filepath}"
- `write`: "Write {filepath}"
- Custom tools: "{toolName}"

Status icons:
- Running: ⏳ (yellow)
- Complete: ✓ (green)
- Error: ✗ (red)

#### Scenario: Tool call appears on start
- **WHEN** a `tool_execution_start` event arrives with `toolCallId`, `toolName`, and `args`
- **THEN** the chat view SHALL immediately show a collapsed tool call step with ⏳ spinner and tool summary

#### Scenario: Tool call updates with partial result
- **WHEN** a `tool_execution_update` event arrives with `partialResult`
- **THEN** the tool call message SHALL update its stored result with the partial content (truncated to 30 lines)

#### Scenario: Tool call completes
- **WHEN** a `tool_execution_end` event arrives with `result` and `isError`
- **THEN** the existing tool call message SHALL update in-place: status changes to ✓ or ✗, result content is stored (truncated to 30 lines)

#### Scenario: Tool call expanded display
- **WHEN** a user clicks a collapsed tool call step
- **THEN** the step SHALL expand to show args as JSON and output as preformatted text

#### Scenario: Tool call error
- **WHEN** a tool result has `isError: true`
- **THEN** the collapsed summary SHALL show a red ✗ indicator

#### Scenario: Result truncation
- **WHEN** a tool result exceeds 30 lines
- **THEN** only the first 30 lines SHALL be displayed
