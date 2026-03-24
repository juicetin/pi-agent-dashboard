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
The expanded card SHALL show an OpenSpec section with changes grouped by status: in-progress and completed.

#### Scenario: In-progress changes shown
- **WHEN** the session has openspec changes with status "no-tasks" or "in-progress"
- **THEN** they appear under "In Progress" with artifact status indicators and task progress

#### Scenario: Completed changes shown
- **WHEN** the session has openspec changes with status "complete"
- **THEN** they appear under "Completed" with task count

#### Scenario: No openspec initialized
- **WHEN** the session's project does not have openspec initialized
- **THEN** the OpenSpec section is not shown

#### Scenario: Empty changes
- **WHEN** openspec is initialized but no changes exist
- **THEN** only the "+ New Change" button is shown

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

### Requirement: Refresh button
The OpenSpec section header SHALL include a refresh button (🔄).

#### Scenario: Manual refresh
- **WHEN** user clicks the refresh button
- **THEN** an `openspec_refresh` message is sent and the data updates
