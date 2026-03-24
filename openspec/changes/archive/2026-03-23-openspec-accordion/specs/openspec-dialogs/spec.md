## ADDED Requirements

### Requirement: Explore dialog
Clicking [Explore] on a change SHALL open a modal dialog with a multiline text input.

#### Scenario: Open explore dialog
- **WHEN** user clicks [Explore] on change "theme-system"
- **THEN** a dialog appears with title "Explore: theme-system" and a multiline text input

#### Scenario: Send explore command
- **WHEN** user types text and clicks [Send] in the explore dialog
- **THEN** a `send_prompt` is sent with text `/skill:openspec-explore theme-system\n<user text>`
- **AND** the dialog closes

#### Scenario: Cancel explore dialog
- **WHEN** user clicks [Cancel] in the explore dialog
- **THEN** the dialog closes without sending anything

### Requirement: Quick confirm dialog for Archive
Clicking [Archive] SHALL show a confirmation dialog before executing.

#### Scenario: Archive confirm shown
- **WHEN** user clicks [Archive] on change "theme-system"
- **THEN** a confirm dialog appears asking "Archive theme-system?"

#### Scenario: Archive confirmed
- **WHEN** user clicks [Archive] in the confirm dialog
- **THEN** a `send_prompt` is sent with text `/opsx:archive theme-system`
- **AND** the dialog closes

#### Scenario: Archive cancelled
- **WHEN** user clicks [Cancel] in the confirm dialog
- **THEN** the dialog closes without sending anything
