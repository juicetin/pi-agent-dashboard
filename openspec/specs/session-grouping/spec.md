## ADDED Requirements

### Requirement: Group sessions by directory
The session list SHALL group sessions by their `cwd` value. Sessions with the same `cwd` SHALL appear together under a group header. ALL groups — including single-session groups — SHALL display a folder header. Sessions within each group SHALL be rendered in the order provided by the server's session order for that cwd.

#### Scenario: Multiple sessions in same directory
- **WHEN** two or more sessions share the same `cwd`
- **THEN** they SHALL be displayed under a group header showing the directory name

#### Scenario: Single session in a directory
- **WHEN** only one session exists for a given `cwd`
- **THEN** the session SHALL be displayed under a group header showing the directory name (same as multi-session groups), with git info on the group header

#### Scenario: Sessions across different directories
- **WHEN** sessions exist in multiple different directories
- **THEN** each directory SHALL be its own group, ordered by most recent session activity

#### Scenario: Sessions ordered within group
- **WHEN** the server provides an order for a cwd
- **THEN** sessions within that group SHALL be rendered in the server-provided order, with unordered sessions appended by startedAt descending

### Requirement: Group header display
Group headers SHALL display the directory name and git context information.

#### Scenario: Group with git branch and PR
- **WHEN** a group's sessions have git branch and PR information
- **THEN** the group header SHALL show the directory name, branch name as a clickable link, and PR number as a clickable link

#### Scenario: Group with branch only
- **WHEN** a group's sessions have git branch but no PR
- **THEN** the group header SHALL show the directory name and branch name (as link if URL available, otherwise plain text)

#### Scenario: Group without git info
- **WHEN** a group's sessions have no git information
- **THEN** the group header SHALL show only the directory name

### Requirement: Inline git info for single sessions
When a directory has only one session, git info SHALL be displayed inline beneath the session card rather than in a separate group header.

#### Scenario: Single session with git info
- **WHEN** a single session has git branch and PR information
- **THEN** the branch and PR SHALL be shown as a secondary line beneath the session card

#### Scenario: Single session without git info
- **WHEN** a single session has no git information
- **THEN** the session card SHALL display as it does currently with no additional line
