## MODIFIED Requirements

### Requirement: Collapsible change list in folder section
The folder OpenSpec section SHALL be collapsed by default, showing a header line with chevron, label, change count, and action buttons. The header SHALL include Refresh, Bulk Archive, and `+ New` buttons.

#### Scenario: Collapsed header shows + New button
- **WHEN** the folder OpenSpec section is rendered
- **THEN** the header SHALL show `▶ OpenSpec (N changes)` with Refresh, Bulk Archive, and `+ New` buttons

#### Scenario: + New button opens NewChangeDialog
- **WHEN** the user clicks `+ New` in the folder OpenSpec header
- **THEN** a `NewChangeDialog` SHALL open

#### Scenario: + New button disabled when no active sessions
- **WHEN** the folder has no active (non-ended) sessions
- **THEN** the `+ New` button SHALL be disabled with reduced opacity

### Requirement: Change list displays linked sessions
The expanded folder OpenSpec change list SHALL show clickable session indicators per change, displaying sessions that have `attachedProposal` matching the change name.

#### Scenario: Change with attached sessions
- **WHEN** change `"add-auth"` is listed in folder `/project/foo` and sessions `["s1", "s2"]` have `attachedProposal = "add-auth"`
- **THEN** the change row SHALL show clickable session names/IDs next to the change name

#### Scenario: Clicking session link navigates to session
- **WHEN** the user clicks on session `"s1"` link in the change row for `"add-auth"`
- **THEN** the UI SHALL navigate/scroll to session `"s1"`

#### Scenario: Change with no attached sessions
- **WHEN** change `"fix-bug"` has no sessions with `attachedProposal = "fix-bug"`
- **THEN** the change row SHALL show no session indicators

#### Scenario: Change card shows name, artifact letters, session links, task count
- **WHEN** change `"add-auth"` has artifacts `[proposal: done, design: ready]`, 2 attached sessions, and `3/8 tasks`
- **THEN** the change row SHALL show: `add-auth  P D  [s1] [s2]  3/8 tasks`
