## Purpose

PID file tracking and CLI subcommands (start/stop/restart/status) for managing the dashboard server as a daemon process.

## Requirements

### Requirement: PID file tracking
The dashboard server SHALL write its process ID to `~/.pi/dashboard/server.pid` on startup and remove the file on graceful shutdown (SIGTERM, SIGINT, or `/api/shutdown`).

#### Scenario: PID file created on startup
- **WHEN** the dashboard server starts in foreground mode
- **THEN** it SHALL write the current `process.pid` to `~/.pi/dashboard/server.pid`

#### Scenario: PID file removed on graceful shutdown
- **WHEN** the server receives SIGTERM, SIGINT, or a `/api/shutdown` request
- **THEN** it SHALL remove `~/.pi/dashboard/server.pid` before exiting

#### Scenario: Stale PID file on startup
- **WHEN** the server starts and a PID file already exists but the process is not alive
- **THEN** it SHALL overwrite the PID file with the new process ID

### Requirement: Start subcommand
The `pi-dashboard start` command SHALL launch the server as a detached background daemon. It SHALL verify the server started successfully via a port probe before returning.

#### Scenario: Start when not running
- **WHEN** a user runs `pi-dashboard start`
- **THEN** the server SHALL be spawned as a detached process and the command SHALL print the server URL and exit with code 0

#### Scenario: Start when already running
- **WHEN** a user runs `pi-dashboard start` and the server is already running
- **THEN** the command SHALL print "Dashboard server is already running (pid NNN)" and exit with code 0

#### Scenario: Start with flags
- **WHEN** a user runs `pi-dashboard start --port 3000 --pi-port 3001`
- **THEN** the detached server SHALL use the specified ports

#### Scenario: Start fails
- **WHEN** a user runs `pi-dashboard start` and the server fails to start within 5 seconds
- **THEN** the command SHALL print an error message and exit with code 1

### Requirement: Stop subcommand
The `pi-dashboard stop` command SHALL gracefully stop a running dashboard server by sending SIGTERM to the process identified by the PID file.

#### Scenario: Stop when running
- **WHEN** a user runs `pi-dashboard stop` and the server is running
- **THEN** it SHALL send SIGTERM to the server process, wait for exit (up to 5 seconds), and print "Dashboard server stopped"

#### Scenario: Stop when not running
- **WHEN** a user runs `pi-dashboard stop` and no server is running
- **THEN** it SHALL print "Dashboard server is not running" and exit with code 0

#### Scenario: Stop with stale PID
- **WHEN** a user runs `pi-dashboard stop` and the PID file exists but the process is dead
- **THEN** it SHALL remove the stale PID file and print "Dashboard server is not running"

### Requirement: Restart subcommand
The `pi-dashboard restart` command SHALL stop the running server (if any) and start a new one.

#### Scenario: Restart when running
- **WHEN** a user runs `pi-dashboard restart`
- **THEN** it SHALL stop the current server and start a new one

#### Scenario: Restart when not running
- **WHEN** a user runs `pi-dashboard restart` and no server is running
- **THEN** it SHALL start a new server (equivalent to `start`)

### Requirement: Status subcommand
The `pi-dashboard status` command SHALL report whether the dashboard server is running, its PID, and port.

#### Scenario: Status when running
- **WHEN** a user runs `pi-dashboard status` and the server is running
- **THEN** it SHALL print "Dashboard server is running (pid NNN) on port PPPP" and exit with code 0

#### Scenario: Status when not running
- **WHEN** a user runs `pi-dashboard status` and no server is running
- **THEN** it SHALL print "Dashboard server is not running" and exit with code 1

### Requirement: Health endpoint
The dashboard server SHALL expose a `GET /api/health` endpoint that returns server liveness information.

#### Scenario: Health check
- **WHEN** a `GET /api/health` request is received
- **THEN** the server SHALL respond with `{ ok: true, pid: <number>, uptime: <seconds> }`

### Requirement: Backward compatible foreground mode
Running `pi-dashboard` with no subcommand SHALL continue to run the server in the foreground, as it does today.

#### Scenario: No subcommand runs foreground
- **WHEN** a user runs `pi-dashboard` (no subcommand)
- **THEN** the server SHALL start in the foreground, write the PID file, and block until terminated


### Requirement: mDNS as primary discovery for CLI status
The `pi-dashboard status` command SHALL use mDNS discovery first, falling back to PID file + health check.

#### Scenario: Status finds server via mDNS
- **WHEN** `pi-dashboard status` is run and the server is advertising on mDNS
- **THEN** it SHALL report the server as running with hostname and port from the mDNS record

#### Scenario: Status falls back to PID file
- **WHEN** `pi-dashboard status` is run and mDNS returns no results
- **THEN** it SHALL fall back to reading the PID file and probing the health endpoint
