## ADDED Requirements

### Requirement: Attach dialog renders group sections and pill row when groups defined
When the searchable attach dialog is opened from `SessionOpenSpecActions` for a session whose cwd has `groups.length >= 1`, the dialog body SHALL render a pill row above the existing search input plus collapsible group sections in the change list. The pill row SHALL contain "All" plus one pill per group plus the trailing "Manage groups…" link. Group sections SHALL be ordered by `group.order` with the implicit "Ungrouped" section rendered last. When the cwd has zero groups, the dialog renders exactly as today (flat list, in-progress-first sort, existing search input only).

#### Scenario: Zero groups → today's layout
- **WHEN** the attach dialog opens for session `"s1"` in cwd `/project/foo` and `groups.length === 0`
- **THEN** no pill row SHALL render
- **AND** no group section headers SHALL render
- **AND** the change list SHALL render flat sorted in-progress first then complete

#### Scenario: One+ groups → pill row + group sections
- **WHEN** the attach dialog opens for cwd `/project/foo` and at least one group is defined
- **THEN** a pill row SHALL render with `[All] [<group>...] [Manage groups…]`
- **AND** the change list SHALL partition into one collapsible section per group (in `group.order`) plus an `Ungrouped` section last

### Requirement: Existing dialog search input becomes the unified name-substring filter
The searchable attach dialog's existing search input SHALL act as the name-substring filter when groups are present, composing with the active pill via AND. The dialog's search behavior is otherwise unchanged.

#### Scenario: Search composes with pill via AND
- **WHEN** the user types `"auth"` in the dialog search input and the active pill is `UI`
- **THEN** only changes assigned to group `"ui"` whose names contain `"auth"` SHALL render

#### Scenario: Search continues to work when zero groups
- **WHEN** `groups.length === 0` and the user types `"auth"`
- **THEN** the search SHALL filter the flat list exactly as today

### Requirement: Selecting a change from any group attaches it
Selecting a change from any group section SHALL issue the same `attach_proposal` browser message as today (`{ type: "attach_proposal", sessionId, changeName }`). Group membership has no effect on the attach action itself.

#### Scenario: Attach from named group section
- **WHEN** the user selects change `"add-auth"` from the `UI` group section in the attach dialog for session `"s1"`
- **THEN** the browser SHALL send `{ type: "attach_proposal", sessionId: "s1", changeName: "add-auth" }`

#### Scenario: Attach from Ungrouped section
- **WHEN** the user selects change `"fix-bug"` from the `Ungrouped` section in the attach dialog
- **THEN** the browser SHALL send `attach_proposal` exactly as if no grouping existed

### Requirement: Per-row group picker NOT exposed inside attach dialog
The per-row group-picker affordance (chip / dropdown that reassigns a change to a different group) defined for the folder view SHALL NOT be rendered inside the attach dialog. Reassignment is a folder-level concern; the attach dialog is for selection only.

#### Scenario: No group picker on rows in attach dialog
- **WHEN** the attach dialog is rendered with at least one group defined
- **THEN** no group-picker chip / dropdown SHALL render on any change row inside the dialog
- **AND** group sections SHALL still render (selection-only experience)

### Requirement: Pill state local to dialog instance
Pill selection in the attach dialog SHALL be local to that dialog instance and SHALL reset when the dialog closes. Re-opening the dialog SHALL default to the "All" pill.

#### Scenario: Pill resets on dialog close/reopen
- **WHEN** the user opens the dialog, selects the `UI` pill, closes the dialog, and re-opens it
- **THEN** the dialog SHALL re-open with the "All" pill active

#### Scenario: Pill state independent of folder view
- **WHEN** the folder view's pill is set to `Server` and the user opens the attach dialog
- **THEN** the dialog SHALL open with the "All" pill active, independent of the folder view

## MODIFIED Requirements

### Requirement: Session card shows attach combo box when no proposal attached
Each session card SHALL display a `<select>` dropdown listing available changes from the folder-level OpenSpec data when the session has no attached proposal and the directory has initialized OpenSpec data. **When the user opens the searchable attach dialog (the dialog reachable from the combo box's "Browse all changes…" entry or equivalent affordance), the dialog SHALL render group sections + pill row when the cwd has at least one defined group; otherwise the dialog renders the flat list exactly as today.** The inline `<select>` combo box itself remains a flat list — group structure is exposed only inside the searchable dialog.

#### Scenario: Combo box lists available changes (flat, unchanged)
- **WHEN** session `"s1"` in cwd `/project/foo` has `attachedProposal = null` and the folder has changes `["add-auth", "fix-bug", "refactor-db"]`
- **THEN** the inline `<select>` SHALL show options: placeholder "Attach change...", "add-auth", "fix-bug", "refactor-db"
- **AND** the inline combo SHALL NOT show group structure

#### Scenario: Selecting a change sends attach_proposal
- **WHEN** the user selects `"add-auth"` from the combo box on session `"s1"`
- **THEN** the browser SHALL send `{ type: "attach_proposal", sessionId: "s1", changeName: "add-auth" }`

#### Scenario: No OpenSpec data available
- **WHEN** the session's directory has no OpenSpec data or `initialized: false`
- **THEN** no combo box SHALL be rendered

#### Scenario: No changes available
- **WHEN** OpenSpec is initialized but has zero changes
- **THEN** the combo box SHALL be rendered as disabled with placeholder text "No changes"

#### Scenario: Changes sorted in combo box (flat, unchanged)
- **WHEN** the folder has in-progress and completed changes
- **THEN** in-progress changes SHALL appear first in the combo, then completed changes

#### Scenario: Searchable dialog opens with group sections when groups defined
- **WHEN** the user opens the searchable attach dialog for cwd `/project/foo` and `groups.length >= 1`
- **THEN** the dialog SHALL render the pill row + group sections + the existing search input acting as a name-substring filter

#### Scenario: Searchable dialog renders flat when zero groups
- **WHEN** the user opens the searchable attach dialog for cwd `/project/foo` and `groups.length === 0`
- **THEN** the dialog SHALL render flat (in-progress-first sort, search input only) exactly as today
