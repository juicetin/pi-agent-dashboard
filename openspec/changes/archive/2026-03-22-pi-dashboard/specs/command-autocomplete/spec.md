## ADDED Requirements

### Requirement: Input box with send button
The chat view SHALL include an input box at the bottom for composing messages. The input SHALL support multi-line text and have a send button. Pressing Enter SHALL send the message; Shift+Enter SHALL insert a newline.

#### Scenario: Send message
- **WHEN** a user types text and presses Enter (or clicks Send)
- **THEN** the message SHALL be sent to the selected pi session via the `send_prompt` protocol message

#### Scenario: Send to disconnected session
- **WHEN** a user tries to send a message to an ended/disconnected session
- **THEN** the input box SHALL be disabled and show "Session disconnected"

#### Scenario: Empty message
- **WHEN** a user presses Enter with an empty input
- **THEN** nothing SHALL be sent

### Requirement: Slash command autocomplete
When the user types `/` as the first character in the input box, an autocomplete dropdown SHALL appear showing available commands for the selected session.

Commands SHALL be sourced from the `commands_list` protocol message received from the bridge extension, which reflects `pi.getCommands()` output.

#### Scenario: Trigger autocomplete
- **WHEN** a user types `/` at the start of the input
- **THEN** an autocomplete dropdown SHALL appear showing all available commands

#### Scenario: Filter commands
- **WHEN** a user types `/fix`
- **THEN** the dropdown SHALL filter to show only commands matching "fix" (case-insensitive substring match)

#### Scenario: No matches
- **WHEN** a user types `/xyznonexistent`
- **THEN** the dropdown SHALL show "No commands found"

#### Scenario: Select command
- **WHEN** a user clicks a command in the dropdown or presses Enter on a highlighted command
- **THEN** the input SHALL be populated with `/<command-name>` and the dropdown SHALL close

### Requirement: Command source badges
Each command in the autocomplete dropdown SHALL show a source badge indicating its origin:
- 📋 for prompt templates
- 🔧 for skills (name prefixed with `skill:`)
- ⚡ for extension commands

#### Scenario: Mixed command sources
- **WHEN** the autocomplete dropdown shows commands from different sources
- **THEN** each command SHALL have the appropriate source badge and description

### Requirement: Keyboard navigation
The autocomplete dropdown SHALL support keyboard navigation.

#### Scenario: Arrow key navigation
- **WHEN** the dropdown is open and the user presses ArrowDown/ArrowUp
- **THEN** the highlight SHALL move to the next/previous command

#### Scenario: Enter to select
- **WHEN** a command is highlighted and the user presses Enter
- **THEN** that command SHALL be selected and the dropdown SHALL close

#### Scenario: Escape to dismiss
- **WHEN** the dropdown is open and the user presses Escape
- **THEN** the dropdown SHALL close and the input SHALL retain its current text

#### Scenario: Tab completion
- **WHEN** the dropdown is open and the user presses Tab
- **THEN** the highlighted command SHALL be completed in the input (same as Enter)

### Requirement: Argument autocomplete
For commands that support argument completion (via `getArgumentCompletions` in pi), the system SHALL proxy argument completion requests to the bridge extension.

#### Scenario: Command with argument completions
- **WHEN** a user has typed `/deploy ` (command + space) and the command supports argument completion
- **THEN** the system SHALL request argument completions from the extension and show them in a dropdown

#### Scenario: Command without argument completions
- **WHEN** a user has typed `/fix-tests ` and the command does not support argument completion
- **THEN** no argument dropdown SHALL appear

### Requirement: Touch-friendly autocomplete on mobile
On mobile viewports, the autocomplete dropdown SHALL be positioned above the input (to avoid keyboard overlap) and items SHALL have adequate touch target size (minimum 44px height).

#### Scenario: Mobile autocomplete positioning
- **WHEN** the autocomplete opens on a mobile device
- **THEN** the dropdown SHALL appear above the input box with touch-friendly item sizes
