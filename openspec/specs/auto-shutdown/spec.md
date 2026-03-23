## ADDED Requirements

### Requirement: Idle shutdown when no pi sessions connected
The server SHALL automatically shut down after a configurable idle period when no pi extension WebSocket connections exist. The check SHALL be based on actual WebSocket connection count in the Pi Gateway, not session manager state.

#### Scenario: Last pi session disconnects cleanly
- **WHEN** the last pi extension sends `session_unregister` and no connections remain
- **THEN** the server SHALL start an idle countdown of `shutdownIdleSeconds` seconds

#### Scenario: Last pi session disconnects dirty (crash/network)
- **WHEN** the last pi extension WebSocket closes without `session_unregister`
- **THEN** the server SHALL start the idle countdown after the heartbeat timeout clears the connection

#### Scenario: Idle countdown expires
- **WHEN** the idle countdown reaches zero with no new pi connections
- **THEN** the server SHALL gracefully stop (close DB, close WebSockets) and exit the process

#### Scenario: New pi session connects during countdown
- **WHEN** a new pi extension connects while the idle countdown is running
- **THEN** the server SHALL cancel the idle countdown

#### Scenario: Server starts with no sessions
- **WHEN** the server starts and no pi sessions connect
- **THEN** the server SHALL start the idle countdown immediately

#### Scenario: Browser connections do not prevent shutdown
- **WHEN** browser clients are connected but no pi sessions exist
- **THEN** the server SHALL still shut down after the idle period

### Requirement: Auto-shutdown is configurable
The auto-shutdown feature SHALL be controlled by two config fields: `autoShutdown` (boolean, default `true`) and `shutdownIdleSeconds` (number, default `300`).

#### Scenario: Auto-shutdown disabled
- **WHEN** `autoShutdown` is `false` in the config
- **THEN** the server SHALL never auto-shutdown regardless of connection state

#### Scenario: Custom idle timeout
- **WHEN** `shutdownIdleSeconds` is set to `60` in the config
- **THEN** the server SHALL shut down 60 seconds after the last pi connection drops
