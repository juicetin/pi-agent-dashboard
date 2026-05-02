## MODIFIED Requirements

### Requirement: jj-aware bridge probe is gated by `.jj/` existence

The bridge's per-session 30 s cwd probe SHALL:

- Run a single `fs.access` check for `<cwd>/.jj/` before invoking any `jj` subprocess.
- Skip all jj probes if `.jj/` is absent (no subprocess spawn).
- Run `jj st --no-pager` and `jj workspace list --no-pager` in parallel only when `.jj/` exists.
- Update `Session.jjState` and broadcast via the existing `session_updated` message.

The probe SHALL populate `JjState.workspaceRoot` with the **parent repo root** — the directory shared by every workspace of the repo (which equals the working-copy directory for the default workspace and is the parent of `.shadow/<name>/` for any `jj workspace add`-created workspace). The probe SHALL derive this value via the `jj root` primitive (or equivalent repo-root command), NOT via `jj workspace root` (which returns the current workspace's own working-copy directory and would defeat the workspace-aware grouping rule documented in the "Workspace sessions group under their parent repo" requirement).

If the repo-root primitive fails for any reason, the probe SHALL fall back to the workspace-root value and record the error in `JjState.lastError`. The probe SHALL NOT return `undefined` for `workspaceRoot` solely because the repo-root command is unavailable, since a non-empty `workspaceRoot` gates the badge and workspace-list UI.

#### Scenario: Non-jj cwd incurs no jj subprocess cost

- **GIVEN** a session cwd of `/home/user/plain-folder` with no `.jj/`
- **WHEN** the bridge probe tick fires
- **THEN** zero `jj` subprocesses SHALL be spawned
- **AND** `Session.jjState` SHALL remain undefined or `{ isJjRepo: false }`

#### Scenario: Default-workspace probe sets workspaceRoot to the repo root (== cwd)

- **GIVEN** a colocated repo at `/repo` (i.e. `/repo/.git/` and `/repo/.jj/` both exist) and no additional `jj workspace add`-created workspaces
- **AND** a session cwd of `/repo`
- **WHEN** the bridge probe tick fires
- **THEN** `Session.jjState.workspaceRoot` SHALL equal `/repo`
- **AND** `Session.jjState.workspaceName` SHALL equal `"default"`

#### Scenario: Non-default-workspace probe sets workspaceRoot to the parent repo root

- **GIVEN** a colocated repo at `/repo` with an added workspace at `/repo/.shadow/np-tp/` (`jj workspace add /repo/.shadow/np-tp`)
- **AND** a session cwd of `/repo/.shadow/np-tp/`
- **WHEN** the bridge probe tick fires
- **THEN** `Session.jjState.workspaceRoot` SHALL equal `/repo` (the parent repo root, NOT the workspace's own cwd)
- **AND** `Session.jjState.workspaceName` SHALL equal `"np-tp"`

#### Scenario: Repo-root probe failure falls back gracefully

- **GIVEN** a jj repo where the `jj root` invocation fails (timeout, exit code, or unavailable)
- **WHEN** the bridge probe tick fires
- **THEN** `Session.jjState.workspaceRoot` SHALL still be populated (falling back to the workspace-root value)
- **AND** `Session.jjState.lastError` SHALL describe the underlying failure
- **AND** the badge / workspace-list UI SHALL continue to render
