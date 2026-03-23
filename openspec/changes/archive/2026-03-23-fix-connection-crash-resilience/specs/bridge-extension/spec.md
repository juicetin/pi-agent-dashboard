## MODIFIED Requirements

### Requirement: Extension lifecycle and server connection
The bridge extension SHALL be a global pi extension installed at `~/.pi/agent/extensions/` (via pi package). On `session_start`, it SHALL read configuration from the shared config module to determine the WebSocket port. If `PI_DASHBOARD_URL` env var is set, it SHALL use that instead. It SHALL then check whether the server is running and optionally auto-start it before connecting. On `session_shutdown`, it SHALL send `session_unregister` and close the connection.

The ConnectionManager SHALL never throw unhandled exceptions that could crash the host pi process. All WebSocket operations (construction, send, close) SHALL be wrapped in error handling that falls back to buffering and/or reconnection.

#### Scenario: Successful connection on session start
- **WHEN** pi session starts and the bridge extension loads
- **THEN** the extension SHALL read `piPort` from `~/.pi/dashboard/config.json`, connect to `ws://localhost:{piPort}`, and send a `session_register` message with session metadata

#### Scenario: PI_DASHBOARD_URL override
- **WHEN** the `PI_DASHBOARD_URL` environment variable is set
- **THEN** the extension SHALL use that URL instead of building one from the config file

#### Scenario: Dashboard server not running with autoStart enabled
- **WHEN** the bridge extension detects the server is not running (TCP probe on `piPort` fails) and `autoStart` is `true` in config
- **THEN** it SHALL spawn the dashboard server as a detached process, resolving the CLI script path relative to the extension's own location, and then connect with the normal retry loop

#### Scenario: Dashboard server not running with autoStart disabled
- **WHEN** the bridge extension detects the server is not running and `autoStart` is `false` in config
- **THEN** it SHALL NOT spawn the server and SHALL silently retry connection with exponential backoff

#### Scenario: Server auto-started successfully
- **WHEN** the extension spawns the dashboard server and it starts listening
- **THEN** the extension SHALL notify the user via `ctx.ui.notify()` with message `🌐 Dashboard started at http://localhost:{port}` using the `info` level

#### Scenario: Server already running
- **WHEN** the TCP probe on `piPort` succeeds (port is open)
- **THEN** the extension SHALL connect directly without spawning and SHALL NOT show any notification

#### Scenario: Multiple pi sessions start simultaneously
- **WHEN** multiple pi sessions start at the same time and all detect the server is not running
- **THEN** each SHALL attempt to spawn the server independently; duplicate spawn attempts SHALL fail harmlessly (EADDRINUSE), and the retry loop SHALL connect to whichever instance succeeded

#### Scenario: Session shutdown
- **WHEN** pi session shuts down
- **THEN** the extension SHALL send `session_unregister` and close the WebSocket

#### Scenario: Server dies while extension is sending
- **WHEN** the dashboard server process dies and `WebSocket.send()` throws
- **THEN** the ConnectionManager SHALL catch the exception, buffer the message, and schedule reconnection

#### Scenario: WebSocket constructor fails
- **WHEN** `new WebSocket(url)` throws during a reconnection attempt
- **THEN** the ConnectionManager SHALL catch the exception and schedule another reconnect with exponential backoff

#### Scenario: Server restart cycle
- **WHEN** the dashboard server is killed and restarted
- **THEN** the bridge extension SHALL reconnect automatically and re-sync full session state without any impact on the pi agent
