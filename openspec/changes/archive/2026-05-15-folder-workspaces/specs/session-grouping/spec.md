## ADDED Requirements

### Requirement: Workspace container rendering
The sidebar SHALL render a workspace-container tier above the existing top-level folder list. Each workspace SHALL render as a single container whose header shows the workspace name, a collapse/expand toggle reflecting the persisted `collapsed` flag, and controls to rename, delete, and add a folder. Folders inside the container SHALL render in the order given by the workspace's `folders[]` array.

#### Scenario: Workspace renders above top-level area
- **WHEN** at least one workspace exists
- **THEN** all workspace containers SHALL render above the top-level area (which itself contains pinned-non-workspace folders followed by session-discovered groups)

#### Scenario: Expanded workspace shows folders
- **WHEN** a workspace has `collapsed: false`
- **THEN** the container SHALL display the workspace header and each folder in `folders[]` order, each folder rendered using the same group-container styling as today's top-level folder groups

#### Scenario: Collapsed workspace hides folders
- **WHEN** a workspace has `collapsed: true`
- **THEN** the container SHALL display only the workspace header; folder rows SHALL NOT be rendered

#### Scenario: Collapse toggle is independent per workspace
- **WHEN** the user toggles one workspace's collapse state
- **THEN** other workspaces' collapse state SHALL be unaffected (no accordion behavior at the workspace level)

#### Scenario: Empty workspace renders header only
- **WHEN** a workspace has zero folders in `folders[]`
- **THEN** the container SHALL still render with its header, name, and controls so the user can rename, delete, or add folders to it

### Requirement: Folder visibility for workspace-owned folders
A folder assigned to a workspace SHALL render inside that workspace's container regardless of its pin state or whether any sessions currently target it. Such a folder SHALL NOT also appear in the top-level area.

#### Scenario: Workspace folder with no sessions and not pinned
- **WHEN** a folder is in a workspace's `folders[]`, is not in `pinnedDirectories`, and has zero sessions
- **THEN** the folder SHALL render inside the workspace container and SHALL NOT render at the top level

#### Scenario: Workspace folder that is also pinned
- **WHEN** a folder is in both a workspace's `folders[]` and `pinnedDirectories`
- **THEN** the folder SHALL render only inside the workspace container and SHALL NOT appear in the top-level pinned region

#### Scenario: Workspace folder with active sessions
- **WHEN** a folder is in a workspace's `folders[]` and has one or more active sessions
- **THEN** sessions SHALL render inside the workspace container under that folder's group header, not at the top level

#### Scenario: Folder removed from workspace, still pinned
- **WHEN** a folder is removed from its workspace and remains in `pinnedDirectories`
- **THEN** the folder SHALL reappear in the top-level pinned region in its existing pin-order position

#### Scenario: Folder removed from workspace, not pinned, no sessions
- **WHEN** a folder is removed from its workspace, is not in `pinnedDirectories`, and has no active sessions
- **THEN** the folder SHALL disappear from the sidebar

### Requirement: Folder ordering inside a workspace
Folders inside a workspace SHALL render in the order stored in `workspaces[i].folders`. Pin order and recency SHALL have no effect on intra-workspace order.

#### Scenario: User-defined order wins over pin order
- **WHEN** a workspace's `folders[]` is `["/x", "/y"]` and `pinnedDirectories` is `["/y", "/x"]`
- **THEN** the workspace SHALL display folders in the order `/x` then `/y`

#### Scenario: Reorder updates display
- **WHEN** the server emits `workspaces_updated` after a `reorder_workspace_folders` mutation
- **THEN** the workspace SHALL re-render folders in the new order

### Requirement: Top-level area unchanged for non-workspace folders
The top-level area SHALL continue to apply today's pinned-first-then-session-driven rule, restricted to folders that are NOT in any workspace's `folders[]`.

#### Scenario: Non-workspace pinned folder renders at top level
- **WHEN** a folder is in `pinnedDirectories` and not in any workspace
- **THEN** the folder SHALL render in the top-level pinned region in pin-order position

#### Scenario: Non-workspace session-driven folder renders at top level
- **WHEN** a folder has active sessions and is in no workspace and not pinned
- **THEN** the folder SHALL render in the top-level area sorted by most recent session activity, exactly as it does today

#### Scenario: No workspaces exist
- **WHEN** the user has not created any workspaces
- **THEN** the sidebar SHALL render exactly as it does today, with no workspace-tier UI elements

## REMOVED Requirements

### Requirement: Workspace CRUD operations
**Reason**: This REMOVED block previously deprecated the original "workspace = folder" capability in favor of pinned directories. The new `folder-workspaces` capability reintroduces workspaces with a different shape — named containers grouping multiple folders — so the blanket removal no longer accurately reflects system behavior. The legacy `workspace-management/spec.md` requirement remains REMOVED in its own right; this block is dropped because workspaces, with the new shape, exist again.
**Migration**: None required. The legacy `workspaces.json` file and `Workspace` type from `workspace-management` are not revived. The new capability lives in `folder-workspaces/spec.md` and persists via the existing `preferences.json` file.
