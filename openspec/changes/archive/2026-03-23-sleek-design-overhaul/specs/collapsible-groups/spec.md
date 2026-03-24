## ADDED Requirements

### Requirement: Collapsible folder groups
Each folder group header SHALL include a chevron toggle icon (▸ collapsed, ▾ expanded). Clicking the chevron or the group header SHALL toggle the collapsed/expanded state of that group's session cards.

#### Scenario: Collapse a group
- **WHEN** a user clicks an expanded folder group header
- **THEN** the session cards within that group SHALL animate closed (smooth height transition) and the chevron SHALL change to ▸

#### Scenario: Expand a collapsed group
- **WHEN** a user clicks a collapsed folder group header
- **THEN** the session cards within that group SHALL animate open (smooth height transition) and the chevron SHALL change to ▾

#### Scenario: Default state
- **WHEN** a folder group is rendered for the first time with no persisted state
- **THEN** it SHALL be expanded by default

### Requirement: Collapse state persistence
The collapsed/expanded state of folder groups SHALL be persisted to localStorage, keyed by directory path (`cwd`).

#### Scenario: Persist collapse
- **WHEN** a user collapses a folder group
- **THEN** the collapsed state SHALL be saved to localStorage and restored on page reload

#### Scenario: Expand after reload
- **WHEN** a user reloads the page with a previously collapsed group
- **THEN** the group SHALL render in collapsed state

#### Scenario: Prune stale collapsed entries
- **WHEN** session data loads and some persisted cwd keys no longer match any active sessions
- **THEN** the stale keys SHALL be removed from localStorage

### Requirement: Collapse animation
The collapse/expand transition SHALL use a smooth CSS animation (max-height transition with overflow hidden) lasting approximately 200-300ms.

#### Scenario: Smooth expand
- **WHEN** a collapsed group is expanded
- **THEN** the session cards SHALL smoothly animate from zero height to full height over ~200-300ms

#### Scenario: Smooth collapse
- **WHEN** an expanded group is collapsed
- **THEN** the session cards SHALL smoothly animate from full height to zero height over ~200-300ms
