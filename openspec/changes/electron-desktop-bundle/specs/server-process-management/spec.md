## MODIFIED Requirements

### Requirement: Server identity verification via health check
The server detection logic SHALL verify server identity via `GET /api/health` instead of relying on bare TCP port probes. A new `isDashboardRunning(port)` function SHALL replace `isPortOpen(port)` for all server detection use cases.

#### Scenario: Dashboard server on port
- **WHEN** `isDashboardRunning(port)` is called and the dashboard server is running on that port
- **THEN** it SHALL return `{ running: true, pid: <number> }`

#### Scenario: Other service on port
- **WHEN** `isDashboardRunning(port)` is called and a non-dashboard service is running on that port
- **THEN** it SHALL return `{ running: false, portConflict: true }`

#### Scenario: Nothing on port
- **WHEN** `isDashboardRunning(port)` is called and the port is closed
- **THEN** it SHALL return `{ running: false }`

#### Scenario: Health check timeout
- **WHEN** the health check does not respond within 2 seconds
- **THEN** it SHALL return `{ running: false }`

### Requirement: Start subcommand uses identity check
The `pi-dashboard start` command SHALL use `isDashboardRunning()` instead of `isServerRunning()` with port probe to detect an existing server.

#### Scenario: Start when port occupied by other service
- **WHEN** a user runs `pi-dashboard start` and port 8000 is occupied by a non-dashboard service
- **THEN** the command SHALL print "Port 8000 is in use by another service" and exit with code 1

#### Scenario: Start when dashboard already running
- **WHEN** a user runs `pi-dashboard start` and the dashboard is already running on the configured port
- **THEN** the command SHALL print "Dashboard server is already running (pid NNN)" and exit with code 0

### Requirement: mDNS as primary discovery for server management
The `pi-dashboard status` command SHALL use mDNS discovery first, falling back to PID file + health check.

#### Scenario: Status finds server via mDNS
- **WHEN** `pi-dashboard status` is run and the server is advertising on mDNS
- **THEN** it SHALL report the server as running with hostname and port from the mDNS record

#### Scenario: Status falls back to PID file
- **WHEN** `pi-dashboard status` is run and mDNS returns no results
- **THEN** it SHALL fall back to reading the PID file and probing the health endpoint
