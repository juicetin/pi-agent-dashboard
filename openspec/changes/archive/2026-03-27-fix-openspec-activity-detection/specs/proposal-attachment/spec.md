## ADDED Requirements

### Requirement: Case-insensitive tool name matching in activity detector
The `detectOpenSpecActivity` function SHALL match tool names case-insensitively. Pi emits lowercase tool names (`"read"`, `"bash"`, `"write"`) and the detector SHALL handle any casing.

#### Scenario: Lowercase tool name from pi
- **WHEN** a `tool_execution_start` event arrives with `toolName: "read"` and a path matching an openspec skill file
- **THEN** the detector SHALL return the detected phase

#### Scenario: Capitalized tool name
- **WHEN** a `tool_execution_start` event arrives with `toolName: "Read"` and a path matching an openspec change file
- **THEN** the detector SHALL return the detected change name

#### Scenario: Lowercase bash with openspec CLI command
- **WHEN** a `tool_execution_start` event arrives with `toolName: "bash"` and a command containing `openspec status --change "add-auth"`
- **THEN** the detector SHALL return `{ changeName: "add-auth" }`

### Requirement: Detect change name from openspec new change command
The activity detector SHALL detect the change name from `openspec new change "name"` commands using positional arguments, not just the `--change` flag pattern.

#### Scenario: openspec new change with quoted name
- **WHEN** a bash tool call contains `openspec new change "add-auth"`
- **THEN** the detector SHALL return `{ changeName: "add-auth" }`

#### Scenario: openspec new change with unquoted name
- **WHEN** a bash tool call contains `openspec new change add-auth`
- **THEN** the detector SHALL return `{ changeName: "add-auth" }`
