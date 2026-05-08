## ADDED Requirements

### Requirement: Folder OpenSpec section renders group sections, pill row, and substring filter
When `FolderOpenSpecSection` is expanded and the cwd has at least one defined group (`groups.length >= 1`), the section body SHALL render three composing controls below the header:
1. A **pill row** with one pill per group plus a leading "All" pill plus a trailing "Manage groups…" link.
2. A **name-substring filter** `<input type="search">` matched case-insensitively against `change.name` only.
3. **Group sections** — one collapsible section per group, ordered by `group.order`, plus an implicit "Ungrouped" section rendered last.

When the cwd has zero groups, none of these three controls SHALL render and the change list SHALL render flat as today.

#### Scenario: Zero groups → flat list, no controls
- **WHEN** the folder OpenSpec section is expanded for cwd `/project/foo` and `groups.length === 0`
- **THEN** no pill row, no substring filter, and no group section headers SHALL render
- **AND** the change list SHALL render flat (sorted: incomplete first, then complete) identical to today's behavior

#### Scenario: One group → pill row + Ungrouped section + named section
- **WHEN** the section is expanded and `groups = [{ id: "ui", name: "UI", order: 0 }]` and one change is assigned to `"ui"` and one is unassigned
- **THEN** a pill row SHALL render with `[All] [UI] [Manage groups…]`
- **AND** the section SHALL show two collapsible group sections: `UI` first, `Ungrouped` second

#### Scenario: Multiple groups → ordered + Ungrouped last
- **WHEN** groups are `[{ id: "ui", order: 0 }, { id: "server", order: 1 }, { id: "build", order: 2 }]` and one change is unassigned
- **THEN** the section bodies SHALL render in order: UI, Server, Build, Ungrouped (Ungrouped always last regardless of order values)

### Requirement: Pill selection narrows visible content
The pill row SHALL display "All" + one pill per group. Selecting a pill narrows the visible content to the changes belonging to that group (or to no group, for the implicit "Ungrouped" pill if shown). The "All" pill restores the full grouped view. Pill state is local to each `FolderOpenSpecSection` (per cwd, per surface) and resets when the section is unmounted.

#### Scenario: Default pill is "All"
- **WHEN** `FolderOpenSpecSection` is freshly expanded
- **THEN** the "All" pill SHALL be active
- **AND** every group section (named + Ungrouped) SHALL be visible

#### Scenario: Selecting a named-group pill hides other sections
- **WHEN** the user clicks the "UI" pill
- **THEN** only the UI section SHALL render
- **AND** the Server, Build, and Ungrouped sections SHALL NOT render
- **AND** the selected pill SHALL be visually marked active

#### Scenario: Pill row hidden when zero groups defined
- **WHEN** `groups.length === 0`
- **THEN** the pill row SHALL NOT render
- **AND** the change list SHALL render as a flat list (no Ungrouped header either)

#### Scenario: Manage groups link opens manager
- **WHEN** the user clicks the "Manage groups…" link inside the pill row for cwd `/project/foo`
- **THEN** the `OpenSpecGroupManager` dialog SHALL open scoped to that cwd

### Requirement: Name-substring filter narrows changes within active pill
A `<input type="search">` SHALL be rendered below the pill row when the section is expanded and `groups.length >= 1`. The substring is matched case-insensitively against `change.name` only. Filter state is local to each `FolderOpenSpecSection` and resets on unmount. The filter composes with the active pill via AND: a change is visible only when it belongs to the selected pill's group AND its name contains the substring.

#### Scenario: Substring filter narrows the visible set
- **WHEN** the user types "auth" in the substring input and the active pill is "All"
- **THEN** only changes whose `name` contains "auth" (case-insensitive) SHALL render
- **AND** group sections with zero matching changes SHALL render their header but with an empty body

#### Scenario: Filter composes with pill via AND
- **WHEN** the active pill is "UI" and the user types "auth"
- **THEN** only changes assigned to group `"ui"` whose name contains "auth" SHALL render

#### Scenario: Empty filter restores full set within active pill
- **WHEN** the substring input is empty
- **THEN** every change in the active pill's scope SHALL render

#### Scenario: Filter does NOT auto-expand collapsed sections
- **WHEN** the user has collapsed the `UI` group section and types in the substring filter
- **THEN** the `UI` section SHALL remain collapsed (consistent with no-auto-expand decision)

### Requirement: Group section header shows count and group color
Each group section header SHALL display: a chevron (▶/▼), the group `name`, the count of changes in that group within the active filter scope, and a small color swatch reflecting `group.color` (or a palette default if absent). The Ungrouped section header SHALL be styled neutrally (no swatch). Headers are clickable to toggle collapse independently of pill / filter state.

#### Scenario: Header shows live count
- **WHEN** the UI group has 5 assigned changes and the substring filter narrows to 2
- **THEN** the UI section header SHALL show `▼ ● UI (2 of 5)` (or equivalent count display reflecting filtered/total)

#### Scenario: Collapse state independent of pill changes
- **WHEN** the user collapses the `UI` section, then switches the active pill to `Server`, then back to `All`
- **THEN** the `UI` section SHALL remain collapsed across the pill changes

#### Scenario: Ungrouped header has neutral styling, no swatch
- **WHEN** the Ungrouped section header renders
- **THEN** no color swatch SHALL be displayed in its header

### Requirement: Per-row group picker assigns change to a group
Each change row SHALL render a small group-picker affordance (a clickable chip showing the current group color + name, or a "+ Group" placeholder for unassigned changes). Clicking opens a dropdown listing all defined groups + a footer "Create new group…" entry. Selecting a group SHALL issue `PUT /api/openspec/groups/assignments` with `{ changeName, groupId }`. Selecting "Create new group…" SHALL inline-prompt for a name, POST a new group, then assign the change.

#### Scenario: Unassigned change shows + Group placeholder
- **WHEN** a change row is rendered for `"add-foo"` with `groupId: null`
- **THEN** the row SHALL include a "+ Group" affordance

#### Scenario: Assigned change shows current group chip
- **WHEN** a change row is rendered for `"add-foo"` with `groupId: "ui"` and group `"ui"` has `color: "#3b82f6"`
- **THEN** the row SHALL include a chip showing the UI group's name and a swatch using `#3b82f6`

#### Scenario: Selecting a group issues PUT assignment
- **WHEN** the user opens the picker on `"add-foo"` and selects `"server"`
- **THEN** the browser SHALL issue `PUT /api/openspec/groups/assignments?cwd=/project/foo` with body `{ changeName: "add-foo", groupId: "server" }`

#### Scenario: Selecting unassign clears assignment
- **WHEN** the dropdown contains an explicit "Unassign / Ungrouped" entry and the user selects it
- **THEN** the browser SHALL issue PUT with `{ changeName: "add-foo", groupId: null }`

#### Scenario: Create new group inline
- **WHEN** the user selects "Create new group…" and types `"Auth"` in the inline name input
- **THEN** the browser SHALL POST `{ name: "Auth" }`, then on success PUT the assignment to the newly returned `id`

#### Scenario: Group picker click does not toggle folder collapse
- **WHEN** the user clicks the group-picker affordance on a change row
- **THEN** event propagation SHALL be stopped
- **AND** the surrounding `FolderOpenSpecSection` collapse state SHALL be unchanged

### Requirement: Header `OpenSpec (N changes)` continues to count unfiltered total
The header label `OpenSpec (N changes)` rendered on the collapsed/expanded section header SHALL continue to count the unfiltered total number of changes for the cwd. Pill selection and substring filter SHALL NOT affect `N`.

#### Scenario: Header count unaffected by pill
- **WHEN** the cwd has 14 changes and the active pill narrows visible content to 3
- **THEN** the header label SHALL still read `OpenSpec (14 changes)`

#### Scenario: Header count unaffected by substring filter
- **WHEN** the substring filter narrows visible content to 2 of 14
- **THEN** the header label SHALL still read `OpenSpec (14 changes)`

### Requirement: Empty-state messaging when filters yield zero matches
When pill + substring filter together yield zero visible changes inside an active group section, the section body SHALL render an explicit empty-state row indicating the cause (`"No matching changes in 'UI'"` or similar). The empty state SHALL distinguish "no changes assigned to this group at all" from "filter excludes all changes in this group".

#### Scenario: Empty group with no assignments
- **WHEN** the `UI` group has zero assigned changes and substring filter is empty
- **THEN** the `UI` section body SHALL render `"No changes in this group yet"`

#### Scenario: Group has assignments but filter excludes them
- **WHEN** the `UI` group has 3 assigned changes and substring filter `"auth"` excludes all 3
- **THEN** the `UI` section body SHALL render `"No matching changes in 'UI'"` (or similar copy referencing the filter)

## MODIFIED Requirements

### Requirement: Change list displays all changes with status
The expanded folder OpenSpec section SHALL list all changes, sorted with in-progress first then completed, **partitioned into group sections when at least one group is defined for the cwd**. When zero groups are defined, the list SHALL render flat as today.

Within each group section the same in-progress-first-then-completed sort SHALL apply. The implicit "Ungrouped" section is rendered last regardless of contents.

#### Scenario: Changes sorted by status within a group
- **WHEN** the `UI` group has changes `["done-change" (complete), "wip-change" (in-progress)]`
- **THEN** within the `UI` section body `"wip-change"` SHALL appear before `"done-change"`

#### Scenario: Change card shows name, PDST button, session links, task count, and group picker
- **WHEN** a change `"add-auth"` has artifacts `[proposal: done, design: ready]`, 2 attached sessions, `3/8 tasks`, and is assigned to group `"ui"`
- **THEN** the change card SHALL show: `add-auth  [s1] [s2]  3/8 tasks  [PD]  [● UI ▾]` where `[● UI ▾]` is the inline group-picker chip

#### Scenario: Zero groups → flat sorted list, no group picker chip on rows
- **WHEN** `groups.length === 0`
- **THEN** the change list SHALL render flat, sorted in-progress first then complete
- **AND** rows SHALL NOT render the group-picker affordance (since no groups exist to pick)

### Requirement: Drag-and-drop reassignment between group sections
Each change row inside the grouped view SHALL be draggable. Each `OpenSpecGroupSection` (named groups and Ungrouped) SHALL register as a drop target. Releasing a dragged change on a section different from its current group SHALL fire `PUT /api/openspec/groups/assignments` with the target group's id (or `null` for Ungrouped).

#### Scenario: Drag from named group to Ungrouped
- **WHEN** change `"add-auth"` is currently in group `"ui"` and the user drags its row onto the `Ungrouped` section header
- **THEN** the assignments map SHALL be updated to remove the `"add-auth"` entry
- **AND** the row SHALL appear under the `Ungrouped` section after the next render

#### Scenario: Drag between named groups
- **WHEN** change `"add-auth"` is in group `"ui"` and the user drags it onto the `"server"` section
- **THEN** assignments SHALL update to `{ "add-auth": "server" }`

#### Scenario: Whole row is grab target (no handle icon)
- **WHEN** rendering a change row in the grouped view
- **THEN** the entire row SHALL act as the drag handle (cursor: grab on hover)
- **AND** no separate drag-handle icon SHALL be rendered
- **AND** drag activation SHALL require an 8 px movement threshold to avoid accidental drags when clicking inner buttons

### Requirement: Per-row group picker hidden in named-group sections
Change rows rendered inside a named group section SHALL NOT render the `OpenSpecGroupPicker` chip. Rows inside the `Ungrouped` section SHALL render the picker.

#### Scenario: Row in named group hides picker
- **WHEN** change `"add-auth"` is rendered inside the `"ui"` section
- **THEN** the row SHALL NOT show the per-row group-picker chip

#### Scenario: Row in Ungrouped section shows picker
- **WHEN** change `"add-auth"` has no group assignment and is rendered inside the `Ungrouped` section
- **THEN** the row SHALL show the per-row group-picker chip

### Requirement: Ungrouped section always rendered as drop target when groups exist
When `groups.length >= 1`, the `Ungrouped` section SHALL always render. When the active pill is not `Ungrouped` and not `All`, the section header SHALL render with a collapsed body (consistent with the named-group inactive-header behavior). Clicking the header SHALL switch the active pill to `Ungrouped` and expand the body.

#### Scenario: Ungrouped header visible while UI pill active
- **WHEN** `groups.length === 2` and the active pill is `"ui"`
- **THEN** the `Ungrouped` section header SHALL be rendered with its body collapsed
- **AND** dropping a dragged change on it SHALL still trigger an unassign

### Requirement: Two-line change row layout with stacked session links
Each change row SHALL render as two lines:
- **Line 1**: change name (truncated when too long) + task count + group picker (when applicable per the requirement above) + artifact-letters button + spawn-attached button.
- **Line 2** (only when ≥1 sessions are linked to the change): each linked session button rendered full-width on its own row, stacked vertically.

#### Scenario: Single linked session renders as full-width button on line 2
- **WHEN** change `"add-auth"` has exactly 1 linked session `s1`
- **THEN** line 1 SHALL render `"add-auth"` + controls
- **AND** line 2 SHALL render a single full-width button labeled with the session name

#### Scenario: Multiple linked sessions stack vertically full-width
- **WHEN** change `"add-auth"` has 3 linked sessions
- **THEN** line 2 SHALL render 3 full-width buttons stacked top-to-bottom (not inline-wrapped)

#### Scenario: No linked sessions → line 2 omitted
- **WHEN** change `"add-auth"` has zero linked sessions
- **THEN** the row SHALL render only line 1
