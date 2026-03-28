## ADDED Requirements

### Requirement: Kebab menu button in mobile session header
The mobile session detail header SHALL display a `⋮` (vertical ellipsis) kebab menu button. The button SHALL meet the 44px minimum touch target size.

#### Scenario: Kebab button visible
- **WHEN** a session is selected on a mobile viewport
- **THEN** the session header SHALL show a `⋮` button on the right side

### Requirement: Dropdown menu with session actions
Tapping the kebab button SHALL open a dropdown menu anchored to the button. The dropdown SHALL contain the following actions where applicable: Rename, Hide/Unhide, Resume, Fork, Open in editor (one per detected editor), Attach/Detach OpenSpec change, Exit session. Each action row SHALL have a minimum height of 44px.

#### Scenario: Dropdown opens on tap
- **WHEN** user taps the `⋮` button
- **THEN** a dropdown menu SHALL appear anchored below the button

#### Scenario: Dropdown closes on outside tap
- **WHEN** the dropdown is open and user taps outside it
- **THEN** the dropdown SHALL close

#### Scenario: Dropdown closes on action
- **WHEN** user taps an action in the dropdown
- **THEN** the action SHALL execute and the dropdown SHALL close

### Requirement: Git info displayed in dropdown
The dropdown SHALL display git branch and PR information as a non-interactive info row when available.

#### Scenario: Git info shown
- **WHEN** the session has a git branch
- **THEN** the dropdown SHALL show the branch name and PR link (if available) as a non-tappable info row

#### Scenario: No git info
- **WHEN** the session has no git branch
- **THEN** no git info row SHALL appear in the dropdown

### Requirement: Conditional action visibility
Actions in the dropdown SHALL be shown or hidden based on session state: Resume and Fork appear only when a session file exists, Resume appears only for ended/hidden sessions, Exit appears only for active sessions, Editor buttons appear only when editors are detected.

#### Scenario: Ended session actions
- **WHEN** the dropdown opens for an ended session with a session file
- **THEN** Resume and Fork SHALL be visible, Exit SHALL NOT be visible

#### Scenario: Active session actions
- **WHEN** the dropdown opens for an active session
- **THEN** Exit SHALL be visible, Resume SHALL NOT be visible, Fork SHALL be visible

### Requirement: Info strip in mobile session detail
Below the mobile session header, a compact info strip SHALL display: model name, thinking level, activity indicator, and cost. A context usage bar SHALL appear below the info strip.

#### Scenario: Info strip content
- **WHEN** a session is selected on mobile
- **THEN** the info strip SHALL show model, thinking level, current activity, and cost
- **AND** a context usage bar SHALL be visible below it
