## MODIFIED Requirements

### Requirement: Headless child process tracking
The server SHALL track all headless child processes with both their PID and spawning cwd. When a pi session connects via the bridge extension, the server SHALL link the session ID to the tracked PID by matching cwd (FIFO order when multiple spawns share the same cwd). When a child process exits, it SHALL be removed from tracking. On server shutdown (SIGTERM/SIGINT), the server SHALL send SIGTERM to all tracked headless child processes.

#### Scenario: Child process registered at spawn time
- **WHEN** a headless pi session is spawned in `/projects/my-app`
- **THEN** the server SHALL store the PID, cwd, and ChildProcess reference in the registry

#### Scenario: Session ID linked on bridge connect
- **WHEN** a bridge extension connects with session cwd `/projects/my-app` and a tracked headless PID exists for that cwd
- **THEN** the server SHALL link the session ID to that PID (oldest unlinked entry first)

#### Scenario: Child process exits normally
- **WHEN** a headless pi process exits
- **THEN** the server SHALL remove it from the tracked processes map and clear any session ID linkage

#### Scenario: Server shutdown with active headless sessions
- **WHEN** the server receives SIGTERM or SIGINT and there are tracked headless processes
- **THEN** the server SHALL send SIGTERM to each tracked process before exiting

## ADDED Requirements

### Requirement: Shutdown fallback for headless sessions
When a browser sends a `shutdown` message for a session and the extension bridge cannot deliver the message (disconnected or unresponsive), the server SHALL fall back to sending SIGTERM to the headless process if a PID is linked to that session ID.

#### Scenario: Extension connected — normal shutdown
- **WHEN** the browser sends `shutdown` for session `s1` and `piGateway.sendToSession("s1", ...)` returns `true`
- **THEN** the server SHALL NOT attempt a fallback kill (extension handles shutdown)

#### Scenario: Extension disconnected — fallback kill
- **WHEN** the browser sends `shutdown` for session `s1` and `piGateway.sendToSession("s1", ...)` returns `false` and a headless PID is linked to `s1`
- **THEN** the server SHALL send SIGTERM to the linked PID

#### Scenario: No PID linked — no fallback
- **WHEN** the browser sends `shutdown` for session `s1` and `piGateway.sendToSession("s1", ...)` returns `false` and no headless PID is linked to `s1`
- **THEN** the server SHALL take no further action (tmux or already-exited session)
