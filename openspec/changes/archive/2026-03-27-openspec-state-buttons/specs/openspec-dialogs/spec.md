## ADDED Requirements

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
