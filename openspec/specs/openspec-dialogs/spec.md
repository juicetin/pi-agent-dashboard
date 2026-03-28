## ADDED Requirements

### Requirement: Explore dialog
Clicking [Explore] on a change SHALL open a modal dialog with a multiline text input. The dialog SHALL render via DialogPortal at document.body with z-[60].

#### Scenario: Open explore dialog
- **WHEN** user clicks [Explore] on change "theme-system"
- **THEN** a dialog appears with title "Explore: theme-system" and a multiline text input
- **AND** the dialog is rendered at document.body via DialogPortal

#### Scenario: Send explore command
- **WHEN** user types text and clicks [Send] in the explore dialog
- **THEN** a `send_prompt` is sent with text `/skill:openspec-explore theme-system\n<user text>`
- **AND** the dialog closes

#### Scenario: Cancel explore dialog
- **WHEN** user clicks [Cancel] in the explore dialog
- **THEN** the dialog closes without sending anything

### Requirement: Quick confirm dialog for Archive
Clicking [Archive] SHALL show a confirmation dialog before executing. The dialog SHALL render via DialogPortal at document.body with z-[60].

#### Scenario: Archive confirm shown
- **WHEN** user clicks [Archive] on change "theme-system"
- **THEN** a confirm dialog appears asking "Archive theme-system?"
- **AND** the dialog is rendered at document.body via DialogPortal

#### Scenario: Archive confirmed
- **WHEN** user clicks [Archive] in the confirm dialog
- **THEN** a `send_prompt` is sent with text `/opsx:archive theme-system`
- **AND** the dialog closes

#### Scenario: Archive cancelled
- **WHEN** user clicks [Cancel] in the confirm dialog
- **THEN** the dialog closes without sending anything

### Requirement: NewChangeDialog for creating changes
Clicking `+ New` in the folder OpenSpec header SHALL open a `NewChangeDialog` modal with optional name and description fields.

#### Scenario: Dialog fields
- **WHEN** the NewChangeDialog opens
- **THEN** it SHALL show a single-line input for change name (placeholder: "change-name") and a multiline textarea for description

#### Scenario: Send with name and description
- **WHEN** the user enters name `"add-auth"` and description `"Add OAuth support"` and clicks Send
- **THEN** a `send_prompt` SHALL be sent with text `/opsx:new add-auth\nAdd OAuth support` to the target session
- **AND** the dialog SHALL close

#### Scenario: Send with name only
- **WHEN** the user enters name `"add-auth"` with empty description and clicks Send
- **THEN** a `send_prompt` SHALL be sent with text `/opsx:new add-auth` to the target session

#### Scenario: Send with description only
- **WHEN** the user enters no name but description `"Add OAuth support"` and clicks Send
- **THEN** a `send_prompt` SHALL be sent with text `/opsx:new\nAdd OAuth support` to the target session

#### Scenario: Send with both empty
- **WHEN** the user enters no name and no description and clicks Send
- **THEN** a `send_prompt` SHALL be sent with text `/opsx:new` to the target session

#### Scenario: Cancel dialog
- **WHEN** the user clicks Cancel in the NewChangeDialog
- **THEN** the dialog SHALL close without sending anything

#### Scenario: Target session selection
- **WHEN** the NewChangeDialog sends a prompt
- **THEN** it SHALL target the first active (non-ended) session in the folder group
