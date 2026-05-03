## MODIFIED Requirements

### Requirement: Collapsible folder groups
Each folder group header SHALL include a chevron toggle icon (▸ collapsed, ▾ expanded). Clicking the **chevron icon region only** SHALL toggle the folder's membership in the `collapsedGroups` set. The header body (everything outside the chevron region) SHALL NOT toggle collapse — it SHALL focus the folder per the `folder-focus` capability.

The chevron click handler SHALL call `event.stopPropagation()` to prevent the header-body focus listener from also firing on the same click.

The `collapsedGroups` toggle SHALL govern visibility of session cards ONLY when the folder's render mode is `expandedFull` or `expandedToggleHidden` (see `folder-focus` spec). When the folder is in `compactWithAttention` or `compactEmpty` mode (i.e., unfocused and not in `userExpanded`), the `collapsedGroups` membership SHALL be ignored for rendering purposes — the attention filter governs the body region instead.

#### Scenario: Chevron click toggles collapse on focused folder
- **WHEN** a user clicks the chevron icon of a focused, expanded folder group
- **THEN** the folder SHALL be added to `collapsedGroups`
- **AND** the session cards SHALL animate closed
- **AND** the chevron SHALL change to ▸

#### Scenario: Chevron click expands a focused, collapsed folder
- **WHEN** a user clicks the chevron icon of a focused, collapsed folder group
- **THEN** the folder SHALL be removed from `collapsedGroups`
- **AND** the session cards SHALL animate open
- **AND** the chevron SHALL change to ▾

#### Scenario: Header-body click does not toggle collapse
- **WHEN** a user clicks the folder name text or any non-chevron, non-button area of the header
- **THEN** `collapsedGroups` membership SHALL NOT change
- **AND** the chevron icon SHALL NOT change

#### Scenario: Default state
- **WHEN** a folder group is rendered for the first time with no persisted state
- **THEN** it SHALL NOT be in `collapsedGroups` and SHALL NOT be in `userExpanded`

#### Scenario: Collapse toggle ignored on unfocused folder
- **WHEN** a folder is unfocused and not in `userExpanded`, with `cwd` present in `collapsedGroups`
- **THEN** the folder body SHALL render per the `compactWithAttention` or `compactEmpty` rules from the `session-filtering` spec
- **AND** the `collapsedGroups` membership SHALL NOT prevent attention cards from rendering

### Requirement: Collapse animation
The collapse/expand transition SHALL use a smooth CSS animation (max-height transition with overflow hidden) lasting approximately 200-300ms. The transition SHALL apply only when the folder is in `expandedFull` or `expandedToggleHidden` mode — i.e., when the chevron toggle is the active control. Transitions between unfocused render modes (`compactWithAttention` ↔ `compactEmpty`) SHALL NOT be animated; they swap render branches synchronously.

#### Scenario: Smooth expand on focused folder
- **WHEN** a focused, collapsed group is expanded via chevron click
- **THEN** the session cards SHALL smoothly animate from zero height to full height over ~200-300ms

#### Scenario: Smooth collapse on focused folder
- **WHEN** a focused, expanded group is collapsed via chevron click
- **THEN** the session cards SHALL smoothly animate from full height to zero height over ~200-300ms

#### Scenario: Mode change on focus loss is not animated
- **WHEN** a folder loses focus (`activeCwd` changes to a different cwd) and transitions from `expandedFull` to `compactWithAttention`
- **THEN** the render swap SHALL occur on the next render without a height transition
