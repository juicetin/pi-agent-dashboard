## ADDED Requirements

### Requirement: Shutdown REST endpoint
The dashboard server SHALL expose a `POST /api/shutdown` endpoint that gracefully stops the server process. When called, it SHALL invoke the server's `stop()` method and then exit the process with code 0.

#### Scenario: Shutdown request
- **WHEN** a `POST /api/shutdown` request is received
- **THEN** the server SHALL respond with `{ ok: true }`, call `server.stop()`, and exit with `process.exit(0)`

#### Scenario: Shutdown during active sessions
- **WHEN** `POST /api/shutdown` is received while pi sessions are connected
- **THEN** the server SHALL still shut down gracefully — connected extensions will reconnect when a new server starts

### Requirement: Health endpoint
The dashboard server SHALL expose a `GET /api/health` endpoint that returns server liveness information including process ID and uptime.

#### Scenario: Health check response
- **WHEN** a `GET /api/health` request is received
- **THEN** the server SHALL respond with `{ ok: true, pid: <number>, uptime: <seconds> }`

#### Scenario: Health check from localhost
- **WHEN** a `GET /api/health` request is received from any origin
- **THEN** the server SHALL respond successfully (no localhost guard on health endpoint)
