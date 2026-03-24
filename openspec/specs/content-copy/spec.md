## ADDED Requirements

### Requirement: Copy button component
The CopyButton component SHALL accept `text` (string to copy), `icon` (emoji string), and `title` (tooltip string) props. On click, it SHALL copy the text to the clipboard using `navigator.clipboard.writeText()` and display a ✓ checkmark for 1.5 seconds before reverting to the original icon.

#### Scenario: Successful copy
- **WHEN** the user clicks a CopyButton
- **THEN** the text SHALL be copied to the clipboard and the icon SHALL change to ✓ for 1.5 seconds

#### Scenario: Clipboard unavailable
- **WHEN** `navigator.clipboard` is not available
- **THEN** the button SHALL fail silently without errors

### Requirement: Code block copy button
Each fenced code block SHALL display an always-visible 📋 button in the top-right corner. Clicking it SHALL copy the raw code content (without fences or language tag) to the clipboard.

#### Scenario: Copy code block
- **WHEN** the user clicks the 📋 button on a code block
- **THEN** the raw code string SHALL be copied to the clipboard

#### Scenario: Inline code excluded
- **WHEN** inline code (backtick-wrapped) is rendered
- **THEN** no copy button SHALL be displayed

### Requirement: Table copy buttons
Each rendered markdown table SHALL display an always-visible icon bar in the top-right corner with two buttons: 📋 (copy as markdown) and 📊 (copy as TSV).

#### Scenario: Copy table as markdown
- **WHEN** the user clicks the 📋 button on a table
- **THEN** the table content SHALL be copied as a markdown-formatted table string (pipe-delimited with header separator)

#### Scenario: Copy table as TSV
- **WHEN** the user clicks the 📊 button on a table
- **THEN** the table content SHALL be copied as tab-separated values with rows separated by newlines

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

### Requirement: Copy button visibility
All copy buttons (on code blocks, tables, and messages) SHALL be always visible, not hidden behind hover states.

#### Scenario: Copy buttons visible without hover
- **WHEN** a message, code block, or table is rendered
- **THEN** the copy buttons SHALL be visible immediately without requiring mouse hover
