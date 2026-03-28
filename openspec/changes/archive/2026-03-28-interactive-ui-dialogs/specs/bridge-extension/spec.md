## ADDED Requirements

### Requirement: UI proxy activation on session start
The bridge extension SHALL activate the UI proxy in the `session_start` handler. The proxy SHALL wrap `ctx.ui.confirm`, `ctx.ui.select`, `ctx.ui.input`, `ctx.ui.editor`, and `ctx.ui.notify` with dashboard-forwarding versions. The proxy SHALL receive the WebSocket connection, session ID getter, and `ctx.hasUI` flag.

#### Scenario: Proxy activated on session start
- **WHEN** the bridge's `session_start` handler fires
- **THEN** the UI proxy SHALL be applied to `ctx.ui`, replacing dialog and notify methods

#### Scenario: Proxy receives response messages
- **WHEN** the bridge's `onMessage` handler receives an `extension_ui_response` message
- **THEN** it SHALL forward the message to the UI proxy for promise resolution

### Requirement: UI proxy handles reconnection
When the bridge reconnects to the dashboard server, the UI proxy's pending requests are NOT replayed (they are tied to the original dialog call which may have already resolved or timed out). The proxy SHALL continue to work with the new connection for future dialog calls.

#### Scenario: Reconnection does not replay pending requests
- **WHEN** the bridge reconnects to the dashboard server
- **THEN** existing pending requests in the UI proxy SHALL remain in their current state (resolved by TUI or timed out)
