## Requirements

### Requirement: Error extraction from agent_end events
The event reducer SHALL inspect `agent_end` events for error information. When `data.messages` contains a final assistant message with `stopReason === "error"`, the reducer SHALL set `lastError` on `SessionState` with the `errorMessage` value and the event timestamp.

#### Scenario: LLM provider returns quota exceeded error
- **WHEN** an `agent_end` event arrives with the last message having `stopReason: "error"` and `errorMessage: "Rate limit exceeded"`
- **THEN** `SessionState.lastError` SHALL be set to `{ message: "Rate limit exceeded", timestamp: <event timestamp> }`
- **AND** `SessionState.status` SHALL be `"idle"`
- **AND** `SessionState.isStreaming` SHALL be `false`

#### Scenario: agent_end without error
- **WHEN** an `agent_end` event arrives with the last message having `stopReason: "end_turn"` (normal completion)
- **THEN** `SessionState.lastError` SHALL remain unchanged (not set)

#### Scenario: agent_end with missing or empty messages array
- **WHEN** an `agent_end` event arrives with no `messages` array or an empty array
- **THEN** `SessionState.lastError` SHALL remain unchanged (defensive fallback)

### Requirement: Error state cleared on new turn
The `lastError` field SHALL be cleared when a new agent turn begins, indicating the error is stale.

#### Scenario: New turn clears previous error
- **WHEN** `lastError` is set from a previous error
- **AND** an `agent_start` event arrives
- **THEN** `SessionState.lastError` SHALL be cleared to `undefined`

### Requirement: Error banner in chat view
The ChatView SHALL render an inline error banner when `SessionState.lastError` is present. The banner SHALL display the error message, a warning icon, and a dismiss button.

#### Scenario: Error banner shown after LLM error
- **WHEN** `SessionState.lastError` is set with a message
- **THEN** a red/amber error banner SHALL be visible at the bottom of the chat above the input area

#### Scenario: Error banner dismissed by user
- **WHEN** user clicks the dismiss button on the error banner
- **THEN** `lastError` SHALL be cleared and the banner SHALL disappear

#### Scenario: Error banner auto-clears on new turn
- **WHEN** a new `agent_start` event arrives
- **THEN** the error banner SHALL disappear

### Requirement: Error indicator on session card
The session card in the sidebar SHALL show a red status dot when the session has an active error.

#### Scenario: Red dot shown for errored session
- **WHEN** a session has `lastError` set in its `SessionState`
- **THEN** the session card status dot SHALL be red

#### Scenario: Red dot cleared when error dismissed
- **WHEN** `lastError` is cleared (by new turn or user dismiss)
- **THEN** the session card status dot SHALL return to its normal color
