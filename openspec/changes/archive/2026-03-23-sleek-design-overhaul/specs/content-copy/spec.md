## MODIFIED Requirements

### Requirement: Message copy buttons
Each message bubble (user and assistant) SHALL display copy buttons separated from message content by a thin horizontal divider (`border-t border-gray-700/30`). The divider row SHALL contain: 📋 (copy as markdown) and 📝 (copy as plain text) buttons.

#### Scenario: Copy buttons with divider
- **WHEN** a message bubble is rendered
- **THEN** a thin divider SHALL separate the message content from the copy button row below

#### Scenario: Copy message as markdown
- **WHEN** the user clicks the 📋 button on a message
- **THEN** the full message content SHALL be copied as the original markdown source

#### Scenario: Copy message as plain text
- **WHEN** the user clicks the 📝 button on a message
- **THEN** the message content SHALL be copied as plain text with formatting stripped
