## ADDED Requirements

### Requirement: Accordion session card expansion
The selected session card SHALL expand to show additional detail sections. Non-selected cards SHALL remain compact.

#### Scenario: Card expands on selection
- **WHEN** a session card is selected
- **THEN** it expands with a smooth animation to show the OpenSpec section (if available)

#### Scenario: Card collapses on deselection
- **WHEN** a different session card is selected
- **THEN** the previously selected card collapses to compact view

### Requirement: OpenSpec section displays change list
The expanded session card SHALL show an OpenSpec section whose content depends on whether a proposal is attached. The section is **collapsed by default**. When collapsed, only a header line with a chevron (`▶`), label, and action buttons is visible. Clicking the header toggles expansion.

**When no proposal is attached:** The section header shows `▶ OpenSpec` with a "Bulk Archive" button and a refresh button. When expanded, all changes are listed (in-progress first, then completed), each with an "Attach" button. The "+ New Change" button is shown at the bottom.

**When a proposal is attached:** The section header shows `▶ OpenSpec: <proposalName>` with a "Detach" button and a refresh button (no Bulk Archive button). When expanded, only the attached proposal's change card is displayed. The "+ New Change" button is shown at the bottom.

#### Scenario: Collapsed by default
- **WHEN** a session card is selected and has openspec initialized
- **THEN** the OpenSpec section SHALL render collapsed, showing only the header line

#### Scenario: Expand on click
- **WHEN** the user clicks the OpenSpec header
- **THEN** the section SHALL expand to show changes and the "+ New Change" button, with the chevron changing to `▼`

#### Scenario: Collapse on click
- **WHEN** the user clicks the expanded OpenSpec header
- **THEN** the section SHALL collapse back to the header line only

#### Scenario: No openspec initialized
- **WHEN** the session's project does not have openspec initialized
- **THEN** the OpenSpec section is not shown

#### Scenario: Empty changes
- **WHEN** openspec is initialized but no changes exist
- **THEN** the collapsed header is shown; when expanded, only the "+ New Change" button is visible

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

### Requirement: OpenSpec action buttons
Each change card SHALL display action buttons appropriate to its status.

#### Scenario: In-progress change actions
- **WHEN** a change has status "no-tasks" or "in-progress"
- **THEN** the buttons [Explore], [Continue], and [FF] are shown

#### Scenario: Completed change actions
- **WHEN** a change has status "complete"
- **THEN** the buttons [Explore], [Apply], and [Archive] are shown

#### Scenario: Action sends command to session
- **WHEN** user clicks an action button (e.g., Continue for "theme-system")
- **THEN** a `send_prompt` is sent to the session with text `/opsx:continue theme-system`

### Requirement: New Change button
The OpenSpec section SHALL include a "+ New Change" button.

#### Scenario: New change action
- **WHEN** user clicks "+ New Change"
- **THEN** a `send_prompt` is sent to the session with text `/opsx:new`

### Requirement: Artifact letter indicators
Each change SHALL display artifact status as first-letter labels (e.g., P D S T) colored by readiness, replacing the previous colored dots.

The letter mapping SHALL be:
- `proposal` → **P**
- `design` → **D**
- `specs` → **S**
- `tasks` → **T**
- Any other artifact → first letter of its ID, uppercased

The color mapping SHALL be:
- `done` → green (`text-green-500`)
- `ready` → yellow (`text-yellow-500`)
- `blocked` → dim/muted (`text-[var(--text-muted)]`)

Letters SHALL be rendered in 10px bold monospace for alignment.

#### Scenario: All artifacts shown as letters
- **WHEN** a change has artifacts `[proposal: done, design: ready, specs: blocked, tasks: blocked]`
- **THEN** the display SHALL show `P D S T` where P is green, D is yellow, S and T are dim

#### Scenario: All artifacts done
- **WHEN** all artifacts have status `done`
- **THEN** all letters SHALL be green

#### Scenario: Letter tooltip
- **WHEN** the user hovers over an artifact letter
- **THEN** a tooltip SHALL show the full artifact name and status (e.g., "proposal: done")

### Requirement: Slim change card layout
Each change SHALL be displayed in a compact layout: one line for name, artifact letters, and task count; a second line for action buttons.

#### Scenario: Change card single line
- **WHEN** a change card is rendered
- **THEN** the first line SHALL show: change name (truncated), artifact letters, and task count (e.g., `2/5 tasks`) aligned to the end

#### Scenario: Task count inline
- **WHEN** a change has tasks
- **THEN** the task count SHALL appear on the same line as the name and letters, not on a separate line

#### Scenario: No tasks
- **WHEN** a change has `totalTasks: 0`
- **THEN** no task count SHALL be displayed on that line

#### Scenario: Action buttons on second line
- **WHEN** a change card is rendered
- **THEN** action buttons SHALL appear on a second line below the name/letters/tasks line

### Requirement: Refresh button always visible
The refresh button SHALL be visible in both collapsed and expanded states, on the header line.

#### Scenario: Refresh in collapsed state
- **WHEN** the OpenSpec section is collapsed
- **THEN** the refresh button SHALL be visible on the header line and clickable

#### Scenario: Refresh in expanded state
- **WHEN** the OpenSpec section is expanded
- **THEN** the refresh button SHALL remain on the header line

#### Scenario: Manual refresh
- **WHEN** user clicks the refresh button
- **THEN** an `openspec_refresh` message is sent and the data updates
