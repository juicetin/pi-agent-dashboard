## ADDED Requirements

### Requirement: Workspace CRUD operations
The system SHALL support creating, reading, updating, and deleting workspaces via the REST API. Each workspace represents a project folder on the host machine.

A workspace SHALL have: id (uuid), name (display name), path (absolute folder path), sortOrder (integer), createdAt (timestamp).

#### Scenario: Create workspace
- **WHEN** a user submits a new workspace with name "api-server" and path "/home/user/projects/api-server"
- **THEN** the system SHALL create a workspace record, validate the path exists on disk, and return the created workspace

#### Scenario: Create workspace with non-existent path
- **WHEN** a user submits a workspace with a path that does not exist on disk
- **THEN** the system SHALL return an error indicating the path is invalid

#### Scenario: Create workspace with duplicate path
- **WHEN** a user submits a workspace with a path that matches an existing workspace
- **THEN** the system SHALL return an error indicating a workspace already exists for that path

#### Scenario: Delete workspace
- **WHEN** a user deletes a workspace
- **THEN** the system SHALL remove the workspace record but SHALL NOT delete any session records or pi session files — sessions become unassigned

#### Scenario: Update workspace name
- **WHEN** a user renames a workspace from "api" to "API Server"
- **THEN** the system SHALL update the name and broadcast `workspace_updated` to connected browsers

#### Scenario: Reorder workspaces
- **WHEN** a user changes workspace sort order
- **THEN** the system SHALL update sortOrder values and the workspace bar SHALL reflect the new order

### Requirement: Workspace bar UI
The web client SHALL display a workspace bar at the top of the interface showing all workspaces as selectable tabs/pills. The currently selected workspace SHALL be visually highlighted.

#### Scenario: Switch workspace
- **WHEN** a user clicks a workspace tab
- **THEN** the session sidebar SHALL update to show only sessions belonging to that workspace

#### Scenario: All workspaces view
- **WHEN** a user has not selected a specific workspace (or selects "All")
- **THEN** the session sidebar SHALL show sessions from all workspaces, grouped by workspace

#### Scenario: Workspace with active session count
- **WHEN** workspaces are displayed
- **THEN** each workspace tab SHALL show the count of active sessions as a badge

### Requirement: Add workspace dialog
The web client SHALL provide an "Add Workspace" dialog accessible from the workspace bar via a "+" button.

The dialog SHALL include:
- Path input field (text input for the absolute path)
- Name input field (auto-populated from the folder basename, editable)
- Cancel and Add buttons

#### Scenario: Add workspace with auto-name
- **WHEN** a user enters path "/home/user/projects/my-app" in the add dialog
- **THEN** the name field SHALL auto-populate with "my-app" and the user can accept or edit it

#### Scenario: Add workspace from dialog
- **WHEN** a user fills in the dialog and clicks Add
- **THEN** the workspace SHALL be created via the REST API and appear in the workspace bar

### Requirement: Workspace auto-discovery
The system SHALL provide an optional auto-discovery feature that scans common project locations for folders containing `.git/` or `.pi/` directories and suggests them as workspaces.

#### Scenario: Discover projects
- **WHEN** a user triggers auto-discovery (button in Add Workspace dialog)
- **THEN** the system SHALL scan configurable base directories (default: `~/Projects`, `~/project`, `~/dev`, home directory) one level deep and return folders containing `.git/` or `.pi/`

#### Scenario: Filter already-added workspaces
- **WHEN** auto-discovery finds folders that are already registered as workspaces
- **THEN** those folders SHALL be excluded from the suggestions
