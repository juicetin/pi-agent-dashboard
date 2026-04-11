## ADDED Requirements

### Requirement: pendingPrompt cleared on agent_end
The event reducer SHALL clear `pendingPrompt` when an `agent_end` event arrives, in addition to the existing clearing on `agent_start` and `message_start(user)`.

#### Scenario: agent_end clears stuck pending prompt
- **WHEN** `pendingPrompt` is set (spinner visible)
- **AND** an `agent_end` event arrives without a prior `message_start(user)` for this prompt
- **THEN** `pendingPrompt` SHALL be cleared to `undefined`

#### Scenario: Normal flow unaffected
- **WHEN** `pendingPrompt` is set
- **AND** `agent_start` arrives followed by `message_start(user)`
- **THEN** `pendingPrompt` SHALL be cleared by `message_start(user)` as before (agent_end clearing is a no-op since already cleared)

### Requirement: pendingPrompt safety timeout
The client SHALL implement a 30-second timeout for `pendingPrompt`. If `pendingPrompt` is set and no clearing event (`agent_start`, `message_start(user)`, or `agent_end`) arrives within 30 seconds, the prompt SHALL be auto-cleared and an error SHALL be shown.

#### Scenario: Timeout triggers after 30 seconds
- **WHEN** `pendingPrompt` is set
- **AND** 30 seconds pass with no clearing event
- **THEN** `pendingPrompt` SHALL be cleared
- **AND** `lastError` SHALL be set with a message indicating the prompt may not have been received

#### Scenario: Timeout cancelled by clearing event
- **WHEN** `pendingPrompt` is set and the timeout is running
- **AND** an `agent_start` event arrives within 30 seconds
- **THEN** the timeout SHALL be cancelled (no error shown)
