## MODIFIED Requirements

### Requirement: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, source badge, and relative time; second line with model name; third line with activity indicator (current tool or state label) and token/cost stats; fourth line with editor buttons for each detected editor (only when accessed on localhost)

#### Scenario: Session card layout
- **WHEN** a session card is rendered
- **THEN** it SHALL display: first line with status dot, project name, source badge, and relative time; second line with model name; third line with activity indicator (current tool or state label) and token/cost stats

#### Scenario: Editor buttons shown on localhost
- **WHEN** the dashboard is accessed via localhost and editors are detected for the session's cwd
- **THEN** the session card SHALL display small clickable editor buttons (one per detected editor)

#### Scenario: Editor buttons hidden on remote
- **WHEN** the dashboard is accessed via a non-localhost URL
- **THEN** no editor buttons SHALL be displayed

#### Scenario: Click editor button
- **WHEN** a user clicks an editor button on a session card
- **THEN** the client SHALL call `POST /api/open-editor` with the session's cwd and the editor ID
- **AND** the click SHALL NOT trigger session selection

#### Scenario: Editor button on grouped sessions
- **WHEN** multiple sessions share the same cwd and are displayed under a group header
- **THEN** editor buttons SHALL appear on the group header, not on each individual session card
