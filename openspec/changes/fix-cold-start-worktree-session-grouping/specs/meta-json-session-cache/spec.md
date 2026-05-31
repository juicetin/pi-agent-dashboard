## ADDED Requirements

### Requirement: Worktree and workspace parentage persisted
The system SHALL persist a session's worktree and jj-workspace parentage to `.meta.json` so cold-start session grouping reproduces the grouping a live bridge produces. When the in-memory session carries `gitWorktree`, the system SHALL persist `gitWorktree.mainPath` and `gitWorktree.name`. When it carries `jjState`, the system SHALL persist `jjState.workspaceRoot` and `jjState.workspaceName`. All four fields SHALL remain optional and SHALL be backward-compatible with existing sidecar files that omit them.

#### Scenario: Worktree parentage written
- **WHEN** a session has `gitWorktree = { mainPath: "/repo", name: "feat-x" }`
- **THEN** its `.meta.json` SHALL contain `gitWorktree.mainPath = "/repo"` and `gitWorktree.name = "feat-x"`

#### Scenario: jj workspace parentage written
- **WHEN** a session has `jjState = { workspaceRoot: "/repo", workspaceName: "feat-x", ... }`
- **THEN** its `.meta.json` SHALL contain `jjState.workspaceRoot = "/repo"` and `jjState.workspaceName = "feat-x"`

#### Scenario: Plain checkout omits parentage
- **WHEN** a session has neither `gitWorktree` nor `jjState`
- **THEN** its `.meta.json` SHALL omit all four parentage fields and remain valid

#### Scenario: Legacy meta without parentage stays valid
- **WHEN** a `.meta.json` predates this change and omits the parentage fields
- **THEN** the system SHALL read it without error and treat the session as having no persisted parentage
