## ADDED Requirements

### Requirement: Dual WebSocket server
The dashboard server SHALL run two WebSocket servers:
- **Pi Gateway** on a configurable port (default `:9999`) for pi extension connections
- **Browser Gateway** on the same port as HTTP (default `:8000`) for browser client connections

Both SHALL handle connection lifecycle (connect, disconnect, error) gracefully.

#### Scenario: Extension connects to Pi Gateway
- **WHEN** a bridge extension connects to the Pi Gateway
- **THEN** the server SHALL accept the connection and wait for a `session_register` message

#### Scenario: Browser connects to Browser Gateway
- **WHEN** a browser client connects to the Browser Gateway
- **THEN** the server SHALL accept the connection and wait for `subscribe` messages

#### Scenario: Pi Gateway port in use
- **WHEN** the configured Pi Gateway port is already in use
- **THEN** the server SHALL exit with a clear error message indicating the port conflict

### Requirement: HTTP server for static files and REST API
The dashboard server SHALL serve the bundled web client as static files on the HTTP port (default `:8000`). It SHALL also serve the REST API endpoints defined in the shared-protocol spec.

#### Scenario: Serve web client
- **WHEN** a browser requests `/` on the HTTP port
- **THEN** the server SHALL serve the web client's `index.html`

#### Scenario: Serve REST API
- **WHEN** a browser requests `/api/workspaces`
- **THEN** the server SHALL return the workspace list as JSON

#### Scenario: CORS for local development
- **WHEN** the web client is served from a different port during development
- **THEN** the server SHALL include appropriate CORS headers

### Requirement: Session registry
The dashboard server SHALL maintain an in-memory registry of all connected pi sessions, indexed by piSessionId. The registry SHALL be backed by SQLite for persistence across server restarts.

#### Scenario: Session registration
- **WHEN** an extension sends `session_register`
- **THEN** the server SHALL add the session to the registry, match it to a workspace by cwd prefix, persist to SQLite, and broadcast `session_added` to subscribed browsers

#### Scenario: Session unregistration
- **WHEN** an extension sends `session_unregister` or disconnects
- **THEN** the server SHALL update the session status to `ended`, persist to SQLite, and broadcast `session_removed` to subscribed browsers

#### Scenario: Server restart with existing sessions
- **WHEN** the dashboard server restarts while pi sessions are still running
- **THEN** extensions SHALL reconnect and re-register, and the server SHALL update existing session records rather than creating duplicates

### Requirement: Event routing
The dashboard server SHALL route events from pi extensions to subscribed browser clients. Each event SHALL be assigned a per-session sequence number before storage and broadcast.

#### Scenario: Event from extension to browsers
- **WHEN** the server receives an `event_forward` from an extension
- **THEN** it SHALL assign a sequence number, store in SQLite, and broadcast to all browsers subscribed to that session

#### Scenario: Multiple browsers watching same session
- **WHEN** two browser clients are subscribed to the same session
- **THEN** both SHALL receive the same events with the same sequence numbers

#### Scenario: No browsers subscribed
- **WHEN** an event arrives but no browsers are subscribed to that session
- **THEN** the server SHALL still store the event in SQLite (for later replay) but skip broadcasting

### Requirement: Command routing
The dashboard server SHALL route commands from browser clients to the correct pi extension based on sessionId.

#### Scenario: Browser sends prompt
- **WHEN** a browser sends `send_prompt` with a sessionId
- **THEN** the server SHALL forward it to the extension connection associated with that sessionId

#### Scenario: Target session not connected
- **WHEN** a browser sends a command for a session that is no longer connected
- **THEN** the server SHALL respond with an error message indicating the session is disconnected

### Requirement: Session-to-workspace matching
The dashboard server SHALL automatically match sessions to workspaces based on the session's `cwd` field. Matching SHALL use longest-prefix match against workspace paths.

#### Scenario: Exact path match
- **WHEN** a session registers with cwd `/home/user/project/api` and a workspace exists with path `/home/user/project/api`
- **THEN** the session SHALL be matched to that workspace

#### Scenario: Prefix match (monorepo)
- **WHEN** a session registers with cwd `/home/user/project/packages/core` and workspaces exist for `/home/user/project` and `/home/user`
- **THEN** the session SHALL be matched to `/home/user/project` (longest prefix)

#### Scenario: No matching workspace
- **WHEN** a session registers with a cwd that doesn't match any workspace
- **THEN** the session SHALL have `workspaceId: null` and appear in an "Unassigned" group in the UI

### Requirement: Stats aggregation
The dashboard server SHALL maintain accumulated stats per session (token usage, cost) and update them when `stats_update` messages arrive from extensions or when `turn_end` events contain usage data.

#### Scenario: Stats update from extension
- **WHEN** a `stats_update` message arrives with new token counts
- **THEN** the server SHALL update the session record in both memory and SQLite, and broadcast `session_updated` to subscribed browsers

### Requirement: Server configuration
The dashboard server SHALL accept configuration via CLI flags, environment variables, and a config file at `~/.pi/dashboard/config.json`.

Configurable options:
- `httpPort` (default: 8000, env: `PI_DASHBOARD_PORT`)
- `piGatewayPort` (default: 9999, env: `PI_DASHBOARD_PI_PORT`)
- `dbPath` (default: `~/.pi/dashboard/dashboard.db`)
- `retentionDays` (default: 30)

CLI flags SHALL override environment variables, which SHALL override config file values.

#### Scenario: Custom ports via CLI
- **WHEN** the server starts with `--port 3000 --pi-port 3001`
- **THEN** it SHALL listen on port 3000 for HTTP/browser-WS and port 3001 for pi-extension-WS

#### Scenario: Default configuration
- **WHEN** the server starts with no configuration
- **THEN** it SHALL use default ports 8000 and 9999, and create the database at `~/.pi/dashboard/dashboard.db`
