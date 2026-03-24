## ADDED Requirements

### Requirement: Play icon send button
The Send button SHALL display a Play icon (▶) instead of text.

#### Scenario: Play button sends message
- **WHEN** user clicks the Play button with text in the input
- **THEN** the message is sent (same as current Send behavior)

#### Scenario: Play button disabled when empty
- **WHEN** the input is empty
- **THEN** the Play button is disabled (grayed out)

### Requirement: Stop button during streaming
A red Stop button (■) SHALL appear at the end of the input field when the session is streaming.

#### Scenario: Stop button visible during streaming
- **WHEN** the session status is "streaming"
- **THEN** a red Stop button is visible next to the Play button

#### Scenario: Stop button hidden when idle
- **WHEN** the session status is "idle" or "ended"
- **THEN** the Stop button is not visible

#### Scenario: Stop button sends abort
- **WHEN** user clicks the Stop button
- **THEN** an `abort` message is sent to the session
