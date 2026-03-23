## MODIFIED Requirements

### Requirement: Add workspace dialog
The web client SHALL provide an "Add Workspace" dialog accessible from the workspace bar or sidebar via a "+" button.

The dialog SHALL use the FilesystemBrowser component for path selection instead of a plain text input. After a directory is selected, the dialog SHALL show:
- Selected path (read-only, from browser selection)
- Name input field (auto-populated from the folder basename, editable)
- Cancel and Add buttons

#### Scenario: Add workspace with browser
- **WHEN** a user clicks "+" to add a workspace
- **THEN** the FilesystemBrowser SHALL open for directory selection

#### Scenario: Path selected from browser
- **WHEN** a user selects a path from the FilesystemBrowser
- **THEN** the dialog SHALL show the selected path and auto-populate the name field with the folder basename

#### Scenario: Add workspace with auto-name
- **WHEN** a user selects path "/home/user/projects/my-app" in the browser
- **THEN** the name field SHALL auto-populate with "my-app" and the user can accept or edit it

#### Scenario: Add workspace from dialog
- **WHEN** a user fills in the dialog and clicks Add
- **THEN** the workspace SHALL be created via the REST API and appear in the sidebar

### Requirement: Sidebar workspace merge
The session sidebar SHALL merge two sources of workspace groups:
1. Session-derived groups (grouped by `session.cwd`)
2. DB-persisted workspaces (from `GET /api/workspaces`)

When a DB workspace path matches a session group CWD, they SHALL merge into one group. DB workspaces with no matching sessions SHALL appear as empty groups (0 sessions). Session groups with no matching DB workspace SHALL appear as auto-discovered groups (current behavior).

#### Scenario: DB workspace with active sessions
- **WHEN** a DB workspace has path "/home/user/project" and sessions exist with that CWD
- **THEN** the sidebar SHALL show one merged group with the workspace name and session cards

#### Scenario: DB workspace with no sessions
- **WHEN** a DB workspace has path "/home/user/empty-project" and no sessions have that CWD
- **THEN** the sidebar SHALL show the workspace as an empty group with its name, action buttons, and 0 session count

#### Scenario: Session group without DB workspace
- **WHEN** sessions exist with CWD "/home/user/auto-project" but no DB workspace matches
- **THEN** the sidebar SHALL show the auto-derived group as before (folder name from CWD)

#### Scenario: Remove workspace from sidebar
- **WHEN** a user clicks the "remove" button on a group header backed by a DB workspace
- **THEN** the client SHALL call `DELETE /api/workspaces/:id` and the group SHALL disappear (unless it still has sessions, in which case it reverts to auto-derived)

### Requirement: Remove workspace button
Each group header backed by a DB workspace SHALL display a "✕ remove" button that deletes the workspace from the database. Removing a workspace SHALL NOT affect running sessions or files on disk.

#### Scenario: Remove workspace with sessions
- **WHEN** a user removes a workspace that has active sessions
- **THEN** the workspace SHALL be deleted from DB but the group SHALL remain as a session-derived group

#### Scenario: Remove workspace without sessions
- **WHEN** a user removes a workspace that has no active sessions
- **THEN** the group SHALL disappear from the sidebar entirely
