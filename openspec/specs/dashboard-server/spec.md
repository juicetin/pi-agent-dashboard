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

On initialization, the session manager SHALL load all existing session records from SQLite into the in-memory Map. Any session with status `active` or `streaming` SHALL be updated to status `ended` with `endedAt` set to the current timestamp, both in memory and in SQLite.

The sessions table SHALL include columns for: `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. These SHALL be added via migration if the table already exists.

When `update()` is called with session field changes, the session manager SHALL persist the following fields to SQLite if present in the updates: `status`, `ended_at`, `tokens_in`, `tokens_out`, `cost`, `model`, `thinking_level`, `cache_read`, `cache_write`, `git_branch`, `git_branch_url`, `git_pr_number`, `git_pr_url`. Transient fields like `currentTool` SHALL only be updated in memory.

#### Scenario: Session registration
- **WHEN** an extension sends `session_register`
- **THEN** the server SHALL add the session to the registry, match it to a workspace by cwd prefix, persist to SQLite, and broadcast `session_added` to subscribed browsers

#### Scenario: Session unregistration
- **WHEN** an extension sends `session_unregister` or disconnects
- **THEN** the server SHALL update the session status to `ended`, persist to SQLite, and broadcast `session_removed` to subscribed browsers

#### Scenario: Server restart with existing sessions
- **WHEN** the dashboard server restarts while pi sessions are still running
- **THEN** extensions SHALL reconnect and re-register, and the server SHALL update existing session records rather than creating duplicates

#### Scenario: Session hydration on startup
- **WHEN** the server starts and the SQLite database contains previous session records
- **THEN** the session manager SHALL load all sessions into memory and they SHALL be visible via `listAll()`

#### Scenario: Stale active sessions marked as ended on startup
- **WHEN** the server starts and SQLite contains sessions with status `active` or `streaming`
- **THEN** those sessions SHALL be updated to status `ended` with `endedAt` set to the current timestamp

#### Scenario: Reconnecting session revives ended record
- **WHEN** a pi session reconnects after server restart and sends `session_register` with the same id
- **THEN** the server SHALL replace the ended session record with a new active one via `INSERT OR REPLACE`

#### Scenario: Stats persisted on update
- **WHEN** `update()` is called with `tokensIn`, `tokensOut`, or `cost` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Git info persisted on update
- **WHEN** `update()` is called with `gitBranch`, `gitBranchUrl`, `gitPrNumber`, or `gitPrUrl` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Cache stats persisted on update
- **WHEN** `update()` is called with `cacheRead` or `cacheWrite` values
- **THEN** the corresponding SQLite row SHALL be updated with those values

#### Scenario: Transient fields not persisted
- **WHEN** `update()` is called with only `currentTool` changes
- **THEN** no SQL UPDATE SHALL be executed

#### Scenario: Git and cache fields hydrated on startup
- **WHEN** the server starts and SQLite contains sessions with git and cache data
- **THEN** the hydrated session objects SHALL include those fields

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
The dashboard server SHALL accumulate token usage and cost per session when `stats_update` messages arrive from extensions. It SHALL add the per-turn values to the session's running totals in both memory (session manager) and SQLite, then broadcast the accumulated totals via `session_updated` to subscribed browsers.

#### Scenario: Stats update from extension
- **WHEN** a `stats_update` message arrives with `tokensIn: 1500`, `tokensOut: 300`, `cost: 0.004` for a session that already has `tokensIn: 3000`, `tokensOut: 600`, `cost: 0.008`
- **THEN** the server SHALL update the session to `tokensIn: 4500`, `tokensOut: 900`, `cost: 0.012` in the session manager, and broadcast `session_updated` with those accumulated totals

#### Scenario: First stats update for a session
- **WHEN** a `stats_update` message arrives for a session with `tokensIn: 0`, `tokensOut: 0`, `cost: 0`
- **THEN** the server SHALL set the session totals to the received values and broadcast them

#### Scenario: Stats persisted in event store
- **WHEN** a `stats_update` message arrives
- **THEN** the server SHALL store the per-turn values (not accumulated totals) as a `stats_update` event in the event store, so the client-side reducer can independently accumulate them during replay

### Requirement: Server configuration
The dashboard server SHALL accept configuration via CLI flags, environment variables, and the shared config module which reads `~/.pi/dashboard/config.json`. The server CLI SHALL import `loadConfig()` from `src/shared/config.ts` instead of implementing its own config loading.

Configurable options:
- `port` (default: 8000, env: `PI_DASHBOARD_PORT`)
- `piPort` (default: 9999, env: `PI_DASHBOARD_PI_PORT`)
- `dbPath` (default: `~/.pi/dashboard/dashboard.db`)
- `retentionDays` (default: 30)
- `autoStart` (default: true) — read by the bridge extension, not used by the server itself
- `autoShutdown` (default: true) — auto-shutdown when no sessions connected
- `shutdownIdleSeconds` (default: 300) — idle timeout before auto-shutdown
- `tunnel.enabled` (default: true) — create zrok public tunnel on startup

CLI flags SHALL override environment variables, which SHALL override config file values.

On startup, the server SHALL call `ensureConfig()` from the shared config module to create the default config file if it does not exist.

#### Scenario: Custom ports via CLI
- **WHEN** the server starts with `--port 3000 --pi-port 3001`
- **THEN** it SHALL listen on port 3000 for HTTP/browser-WS and port 3001 for pi-extension-WS

#### Scenario: Disable tunnel via CLI
- **WHEN** the server starts with `--no-tunnel`
- **THEN** it SHALL skip zrok tunnel creation regardless of config file setting

#### Scenario: Default configuration
- **WHEN** the server starts with no configuration
- **THEN** it SHALL use default ports 8000 and 9999, create the database at `~/.pi/dashboard/dashboard.db`, and attempt to create a zrok tunnel if enrolled

#### Scenario: First-time server start creates config
- **WHEN** the server starts and `~/.pi/dashboard/config.json` does not exist
- **THEN** it SHALL create the config file with default values before proceeding

### Requirement: Server-side session status extraction from forwarded events
The dashboard server SHALL inspect `event_forward` messages and update session metadata when activity-relevant events are detected. The server SHALL broadcast `session_updated` to all browser clients for each status change.

The following event types SHALL trigger session updates:
- `agent_start`: set session status to `"streaming"`, clear `currentTool`
- `agent_end`: set session status to `"idle"`, clear `currentTool`
- `tool_execution_start`: set `currentTool` to the tool name from the event data
- `tool_execution_end`: clear `currentTool`

#### Scenario: Agent starts streaming
- **WHEN** the server receives an `event_forward` with `eventType: "agent_start"`
- **THEN** it SHALL update the session's status to `"streaming"` and broadcast `session_updated` with `{ status: "streaming" }` to all browser clients

#### Scenario: Agent finishes and waits for input
- **WHEN** the server receives an `event_forward` with `eventType: "agent_end"`
- **THEN** it SHALL update the session's status to `"idle"` and clear `currentTool`, broadcasting `session_updated` with `{ status: "idle", currentTool: undefined }` to all browser clients

#### Scenario: Tool execution begins
- **WHEN** the server receives an `event_forward` with `eventType: "tool_execution_start"` and the event data contains `toolName: "Read"`
- **THEN** it SHALL update the session's `currentTool` to `"Read"` and broadcast `session_updated` with `{ currentTool: "Read" }`

#### Scenario: Tool execution ends
- **WHEN** the server receives an `event_forward` with `eventType: "tool_execution_end"`
- **THEN** it SHALL clear the session's `currentTool` and broadcast `session_updated` with `{ currentTool: undefined }`

#### Scenario: Rapid tool calls
- **WHEN** multiple `tool_execution_start` and `tool_execution_end` events arrive in quick succession
- **THEN** the server SHALL update and broadcast for each event individually without debouncing
