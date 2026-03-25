## ADDED Requirements

### Requirement: Bash output and command feedback event types
The `DashboardEvent` type SHALL accept `bash_output` and `command_feedback` as valid `eventType` values. These events flow through the existing `event_forward` (extension→server) and `event` (server→browser) message pipeline with no new message types required.

`bash_output` event data shape:
- `command`: string
- `output`: string
- `exitCode`: number
- `excludeFromContext`: boolean

`command_feedback` event data shape:
- `command`: string
- `status`: `"started"` | `"completed"` | `"error"`
- `message?`: string

#### Scenario: Bash output event flows through pipeline
- **WHEN** the extension sends an `event_forward` with a `bash_output` event
- **THEN** the server SHALL store it in the event buffer and forward it to subscribed browsers as an `event` message

#### Scenario: Command feedback event flows through pipeline
- **WHEN** the extension sends an `event_forward` with a `command_feedback` event
- **THEN** the server SHALL store it in the event buffer and forward it to subscribed browsers as an `event` message

### Requirement: Terminal session source type
The `SessionSource` type SHALL include `"terminal"` as a valid union member alongside existing values (`"interactive"`, `"headless"`, `"sdk"`).

#### Scenario: Terminal source type compiles
- **WHEN** the shared types are compiled
- **THEN** `SessionSource` SHALL accept `"terminal"` as a valid value
