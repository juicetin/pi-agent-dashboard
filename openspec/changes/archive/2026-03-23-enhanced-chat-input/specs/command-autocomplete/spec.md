## ADDED Requirements

### Requirement: Commands state in App
The App component SHALL store per-session commands in a `Map<string, CommandInfo[]>` keyed by session ID. When a `commands_list` message is received from the server, the commands for that session SHALL be updated. The active session's commands SHALL be passed to the `CommandInput` component.

#### Scenario: Commands received for session
- **WHEN** the server sends a `commands_list` message for session "abc-123"
- **THEN** the App SHALL store the commands and pass them to `CommandInput` when session "abc-123" is selected

#### Scenario: Switch sessions
- **WHEN** the user switches from session A to session B
- **THEN** the `CommandInput` SHALL receive session B's commands for autocomplete

#### Scenario: No commands received yet
- **WHEN** a session is selected but no `commands_list` has been received
- **THEN** the `CommandInput` SHALL receive an empty commands array

### Requirement: Request commands on subscribe
When the browser subscribes to a session, it SHALL also send a `request_commands` message to fetch the current command list.

#### Scenario: Subscribe to session
- **WHEN** the browser subscribes to a new session
- **THEN** it SHALL send both `subscribe` and `request_commands` messages

### Requirement: CommandInput replaces MessageInput
The App component SHALL use `CommandInput` instead of `MessageInput` for the chat input. `MessageInput` SHALL be removed from the codebase.

#### Scenario: Input renders with multiline and autocomplete
- **WHEN** the chat view is displayed
- **THEN** the input SHALL be a multiline textarea with `/` command autocomplete support
