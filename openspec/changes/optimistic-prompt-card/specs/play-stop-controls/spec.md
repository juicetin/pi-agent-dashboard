## MODIFIED Requirements

### Requirement: Stop button during streaming
A red Stop button (■) SHALL appear at the end of the input field when the session is streaming OR when a pending prompt exists.

#### Scenario: Stop button visible during streaming
- **WHEN** the session status is "streaming"
- **THEN** a red Stop button is visible next to the Play button

#### Scenario: Stop button visible during pending
- **WHEN** a `pendingPrompt` exists on the session state
- **THEN** a red Stop button is visible next to the Play button

#### Scenario: Stop button hidden when idle
- **WHEN** the session status is "idle" or "ended" AND no `pendingPrompt` exists
- **THEN** the Stop button is not visible

#### Scenario: Stop button sends abort
- **WHEN** user clicks the Stop button
- **THEN** an `abort` message is sent to the session
