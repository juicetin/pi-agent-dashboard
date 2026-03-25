## ADDED Requirements

### Requirement: Spawn session from folder card
The dashboard UI SHALL display a "New Session" button (`+` icon) on each folder card group header in the session sidebar. Clicking it SHALL send a `spawn_session` message to the server with the group's `cwd`.

#### Scenario: User clicks new session button
- **WHEN** the user clicks the `+` button on a folder card group header for `/projects/my-app`
- **THEN** the browser SHALL send `{ type: "spawn_session", cwd: "/projects/my-app" }` to the server

#### Scenario: Spawn succeeds
- **WHEN** the server returns `spawn_result` with `success: true`
- **THEN** the UI SHALL show a success toast with the result message

#### Scenario: Spawn fails
- **WHEN** the server returns `spawn_result` with `success: false`
- **THEN** the UI SHALL show an error toast with the failure message

### Requirement: Spawn session protocol messages
The browser→server protocol SHALL include a `spawn_session` message type with field `cwd: string`. The server→browser protocol SHALL include a `spawn_result` message type with fields `cwd: string`, `success: boolean`, and `message: string`.

#### Scenario: spawn_session message
- **WHEN** the browser sends `{ type: "spawn_session", cwd: "/projects/my-app" }`
- **THEN** the server SHALL spawn a pi session in that directory using the configured strategy

#### Scenario: spawn_result response
- **WHEN** the server completes a spawn attempt
- **THEN** it SHALL send `{ type: "spawn_result", cwd: "...", success: boolean, message: "..." }` to the requesting browser

### Requirement: Headless spawn via RPC mode
When `spawnStrategy` is `"headless"`, the server SHALL spawn pi as a detached child process using `pi --mode rpc` with the working directory set to the requested `cwd`. The environment SHALL include `PI_DASHBOARD_SPAWNED=1`.

#### Scenario: Headless spawn
- **WHEN** `spawnStrategy` is `"headless"` and a spawn is requested for `/projects/my-app`
- **THEN** the server SHALL spawn: `pi --mode rpc` with `cwd: "/projects/my-app"` and `env: { PI_DASHBOARD_SPAWNED: "1" }`
- **AND** stdin/stdout SHALL be piped to `"ignore"` (no direct I/O from server)

#### Scenario: Headless spawn with session file (continue)
- **WHEN** `spawnStrategy` is `"headless"` and spawn options include `sessionFile` with `mode: "continue"`
- **THEN** the server SHALL spawn: `pi --mode rpc --session <sessionFile>`

#### Scenario: Headless spawn with session file (fork)
- **WHEN** `spawnStrategy` is `"headless"` and spawn options include `sessionFile` with `mode: "fork"`
- **THEN** the server SHALL spawn: `pi --mode rpc --fork <sessionFile>`

### Requirement: Headless child process tracking
The server SHALL track all headless child processes. When a child process exits, it SHALL be removed from tracking. On server shutdown (SIGTERM/SIGINT), the server SHALL send SIGTERM to all tracked headless child processes.

#### Scenario: Child process exits normally
- **WHEN** a headless pi process exits
- **THEN** the server SHALL remove it from the tracked processes map

#### Scenario: Server shutdown with active headless sessions
- **WHEN** the server receives SIGTERM or SIGINT and there are tracked headless processes
- **THEN** the server SHALL send SIGTERM to each tracked process before exiting

### Requirement: Tmux spawn remains default
When `spawnStrategy` is `"tmux"` (or unset), the existing tmux spawn behavior SHALL be used unchanged. This is the default.

#### Scenario: Default strategy
- **WHEN** `spawnStrategy` is not set in config
- **THEN** the server SHALL use tmux spawn strategy (existing behavior)
