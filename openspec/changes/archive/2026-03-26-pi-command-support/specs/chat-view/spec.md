## ADDED Requirements

### Requirement: Bash output event rendering
The chat view SHALL render `bash_output` events as styled cards in the message stream. Each card SHALL display:
- The command in monospace font
- The output in a pre-formatted scrollable block (max-height with overflow scroll)
- Exit code indicator: green for 0, red for non-zero
- A "silent" badge (e.g., "!!") when `excludeFromContext` is `true`, indicating output was not sent to the LLM

#### Scenario: Successful command rendered
- **WHEN** a `bash_output` event with `exitCode: 0` and `excludeFromContext: false` is in the event stream
- **THEN** the chat view SHALL render a card with the command, output, and green exit indicator

#### Scenario: Failed command rendered
- **WHEN** a `bash_output` event with `exitCode: 1` is in the event stream
- **THEN** the chat view SHALL render a card with a red exit code indicator

#### Scenario: Silent command badge
- **WHEN** a `bash_output` event with `excludeFromContext: true` is in the event stream
- **THEN** the card SHALL show a "!!" or "silent" badge to distinguish it from LLM-sent commands

### Requirement: Command feedback event rendering
The chat view SHALL render `command_feedback` events as inline status cards:
- `started`: Subtle info card with command name (e.g., "⏳ /compact in progress")
- `completed`: Success card
- `error`: Error card with the error message

#### Scenario: Started feedback rendered
- **WHEN** a `command_feedback` event with `status: "started"` is in the event stream
- **THEN** the chat view SHALL render an info-style card

#### Scenario: Error feedback rendered
- **WHEN** a `command_feedback` event with `status: "error"` is in the event stream
- **THEN** the chat view SHALL render an error-style card with the message
