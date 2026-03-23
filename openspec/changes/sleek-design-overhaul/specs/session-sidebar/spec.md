## MODIFIED Requirements

### Requirement: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, and relative time; second line with model name and thinking level in parentheses; third line with activity indicator (current tool or state label) and token/cost stats; fourth line with git info (if applicable); then a thin horizontal divider; then an action row with editor buttons, source badge, and hide/unhide button. The source badge SHALL NOT appear on the first line.

#### Scenario: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, and relative time; second line with model name and thinking level; third line with activity and token stats; thin divider; action row with editors, source badge, and hide button

#### Scenario: Editor buttons shown on localhost
- **WHEN** the dashboard is accessed via localhost and editors are detected for the session's cwd
- **THEN** the session card SHALL display editor buttons in the action row below the thin divider

#### Scenario: Editor button on grouped sessions
- **WHEN** multiple sessions share the same cwd and are displayed under a group header
- **THEN** editor buttons SHALL appear on the group header, not on each individual session card
