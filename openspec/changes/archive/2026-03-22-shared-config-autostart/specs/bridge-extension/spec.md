## MODIFIED Requirements

### Requirement: Extension lifecycle and server connection
The bridge extension SHALL be a global pi extension installed at `~/.pi/agent/extensions/` (via pi package). On `session_start`, it SHALL read configuration from the shared config module to determine the WebSocket port. If `PI_DASHBOARD_URL` env var is set, it SHALL use that instead. It SHALL then check whether the server is running and optionally auto-start it before connecting. On `session_shutdown`, it SHALL send `session_unregister` and close the connection.

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

## ADDED Requirements

### Requirement: TCP port probe
The bridge extension SHALL probe `localhost:{piPort}` via a TCP connection attempt to detect whether the dashboard server is running. The probe SHALL have a timeout of 1 second.

#### Scenario: Server is running
- **WHEN** a TCP connection to `localhost:{piPort}` succeeds within 1 second
- **THEN** the probe SHALL return `true` and the connection SHALL be immediately closed

#### Scenario: Server is not running
- **WHEN** a TCP connection to `localhost:{piPort}` is refused or times out
- **THEN** the probe SHALL return `false`

### Requirement: Server process spawning
The bridge extension SHALL spawn the dashboard server using `child_process.spawn()` with `detached: true` and `stdio: 'ignore'`, followed by `unref()`. The server CLI path SHALL be resolved relative to the extension's own file location. The spawn command SHALL pass `--port {port} --pi-port {piPort}` from the loaded config.

#### Scenario: Spawn with configured ports
- **WHEN** config has `port: 3000` and `piPort: 4000`
- **THEN** the extension SHALL spawn the server with `--port 3000 --pi-port 4000`

#### Scenario: Spawned process outlives pi session
- **WHEN** the pi session exits after spawning the server
- **THEN** the dashboard server process SHALL continue running independently

#### Scenario: Spawn failure detection
- **WHEN** the spawned server process exits within 2 seconds of being spawned
- **THEN** the extension SHALL show a warning via `ctx.ui.notify()` with message `Dashboard server failed to start` at `warning` level
