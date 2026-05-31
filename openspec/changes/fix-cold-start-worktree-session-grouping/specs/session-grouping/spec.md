## ADDED Requirements

### Requirement: Cold-start grouping parity for worktree/workspace sessions
A session restored from `.meta.json` at server startup, before any bridge has reattached, SHALL group under the same parent path that a live bridge would produce. The startup scanner SHALL reconstruct `session.gitWorktree` from persisted `mainPath`/`name` and `session.jjState` from persisted `workspaceRoot`/`workspaceName`, so `resolveSessionGroupPath` collapses the restored session under its parent repo / workspace root. Because the parent path is pinned or workspace-owned, its group SHALL render regardless of how many of its sessions are alive — restored ended worktree sessions SHALL therefore remain visible.

#### Scenario: Cold-start worktree session collapses under pinned parent
- **WHEN** the server restarts and restores an ended session with persisted `gitWorktree.mainPath = "/repo"` and `cwd = "/repo/.worktrees/feat-x"`
- **AND** `/repo` is pinned and `/repo/.worktrees/feat-x` is not pinned
- **AND** no bridge has reattached
- **THEN** the session SHALL render inside the `/repo` group, not in a separate `/repo/.worktrees/feat-x` group

#### Scenario: Cold-start jj workspace session collapses under parent
- **WHEN** the server restarts and restores an ended session with persisted `jjState.workspaceRoot = "/repo"` and `cwd = "/repo/.shadow/feat-x"`
- **AND** `/repo` is pinned and no bridge has reattached
- **THEN** the session SHALL render inside the `/repo` group, not in a separate `.shadow/feat-x` group

#### Scenario: Cold-start worktree session links to its OpenSpec change row
- **WHEN** a restored worktree session has persisted `gitWorktree.mainPath = "/repo"` and `attachedProposal = "add-foo"`
- **AND** the change `add-foo` exists in `/repo`'s OpenSpec data and no bridge has reattached
- **THEN** the session SHALL appear in `/repo`'s group session list
- **AND** the `add-foo` change row in the folder's OpenSpec section SHALL list the session as a linked session

#### Scenario: Legacy session without persisted parentage
- **WHEN** the server restores an ended worktree session whose `.meta.json` lacks persisted parentage
- **THEN** the session SHALL group under its own `cwd` (status quo) until a bridge attaches once and re-stamps the meta
