## MODIFIED Requirements

### Requirement: OpenSpec section displays change list
The expanded session card SHALL show an OpenSpec section whose content depends on whether a proposal is attached.

**When no proposal is attached:** The section header shows `▶ OpenSpec` with a "Bulk Archive" button and a refresh button. When expanded, all changes are listed (in-progress first, then completed), each with an "Attach" button. The "+ New Change" button is shown at the bottom.

**When a proposal is attached:** The section header shows `▶ OpenSpec: <proposalName>` with a "Detach" button and a refresh button (no Bulk Archive button). When expanded, only the attached proposal's change card is displayed. The "+ New Change" button is shown at the bottom.

#### Scenario: No attachment — all changes shown with Attach buttons
- **WHEN** a session card is selected with `attachedProposal = null` and openspec initialized with changes `["change-a", "change-b"]`
- **THEN** the OpenSpec section SHALL show both changes, each with an "Attach" button

#### Scenario: No attachment — Bulk Archive in header
- **WHEN** a session card is selected with `attachedProposal = null` and openspec initialized
- **THEN** the OpenSpec section header SHALL include a "Bulk Archive" button

#### Scenario: Proposal attached — header shows name and Detach
- **WHEN** a session has `attachedProposal = "change-a"`
- **THEN** the OpenSpec section header SHALL show `OpenSpec: change-a` with a "Detach" button
- **AND** the "Bulk Archive" button SHALL NOT be shown in the header

#### Scenario: Proposal attached — only attached change shown
- **WHEN** a session has `attachedProposal = "change-a"` and openspec data has changes `["change-a", "change-b"]`
- **THEN** only the `"change-a"` change card SHALL be displayed

#### Scenario: Proposal attached but not in openspec data
- **WHEN** a session has `attachedProposal = "archived-change"` but openspec data does not contain that change
- **THEN** the OpenSpec section SHALL show no change cards (just the header with Detach and the "+ New Change" button)

#### Scenario: Attach button sends attach_proposal
- **WHEN** the user clicks "Attach" on change `"change-a"`
- **THEN** the browser SHALL send `{ type: "attach_proposal", sessionId, changeName: "change-a" }`

#### Scenario: Detach button sends detach_proposal
- **WHEN** the user clicks "Detach" in the OpenSpec header
- **THEN** the browser SHALL send `{ type: "detach_proposal", sessionId }`

### Requirement: Bulk Archive button with confirmation
When no proposal is attached, the OpenSpec section header SHALL include a "Bulk Archive" button. Clicking it SHALL show a confirmation dialog. On confirm, it SHALL send `/opsx:bulk-archive` as a `send_prompt` to the session. Bulk Archive SHALL NOT change the session's `attachedProposal`.

#### Scenario: Bulk Archive confirmation dialog
- **WHEN** the user clicks "Bulk Archive" in the OpenSpec header
- **THEN** a confirmation dialog SHALL appear with message "Bulk archive all completed changes?"

#### Scenario: Bulk Archive confirmed
- **WHEN** the user confirms the Bulk Archive dialog
- **THEN** a `send_prompt` SHALL be sent with text `/opsx:bulk-archive`

#### Scenario: Bulk Archive cancelled
- **WHEN** the user cancels the Bulk Archive dialog
- **THEN** no action SHALL be taken

#### Scenario: Bulk Archive does not affect attachment
- **WHEN** the user confirms Bulk Archive
- **THEN** `session.attachedProposal` SHALL remain unchanged
