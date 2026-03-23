## ADDED Requirements

### Requirement: Extension lifecycle and server connection
The bridge extension SHALL be a global pi extension installed at `~/.pi/agent/extensions/` (via pi package). On `session_start`, it SHALL connect to the dashboard server via WebSocket at a configurable URL (default `ws://localhost:9999`). On `session_shutdown`, it SHALL send `session_unregister` and close the connection.

#### Scenario: Successful connection on session start
- **WHEN** pi session starts and the bridge extension loads
- **THEN** the extension SHALL connect to the dashboard server and send a `session_register` message with session metadata

#### Scenario: Dashboard server not running
- **WHEN** the bridge extension cannot connect to the dashboard server
- **THEN** it SHALL log a debug message, NOT show errors to the user, and retry connection with exponential backoff (1s, 2s, 4s, 8s, max 30s)

#### Scenario: Session shutdown
- **WHEN** pi session shuts down
- **THEN** the extension SHALL send `session_unregister` and close the WebSocket

### Requirement: Session source detection
The bridge extension SHALL detect the source environment where pi is running and include it in the `session_register` message.

Detection logic:
- If `PI_DASHBOARD_SPAWNED` env var is set → `tmux`
- If `ZED_TERM` env var is set → `zed`
- If `TMUX` env var is set → `tmux`
- Otherwise → `tui`

#### Scenario: Pi running in Zed editor
- **WHEN** pi starts with `ZED_TERM` environment variable set
- **THEN** the extension SHALL report source as `zed`

#### Scenario: Pi spawned by dashboard
- **WHEN** pi starts with `PI_DASHBOARD_SPAWNED` environment variable set
- **THEN** the extension SHALL report source as `tmux`

#### Scenario: Pi running in plain terminal
- **WHEN** pi starts without any recognized environment variables
- **THEN** the extension SHALL report source as `tui`

### Requirement: Event forwarding
The bridge extension SHALL subscribe to all pi events and forward them to the dashboard server. Every forwarded event SHALL include the `piSessionId` from `ctx.sessionManager`.

Events to forward:
- `message_start`, `message_update`, `message_end`
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- `agent_start`, `agent_end`
- `turn_start`, `turn_end`
- `model_select`
- `session_compact`
- `auto_retry_start`, `auto_retry_end`
- `tool_call` (only when blocked, to capture extension UI interactions)

#### Scenario: Assistant streaming text
- **WHEN** pi fires a `message_update` event with `text_delta`
- **THEN** the extension SHALL forward it to the dashboard server within the same event loop tick

#### Scenario: Tool execution lifecycle
- **WHEN** pi fires `tool_execution_start`, `tool_execution_update`, and `tool_execution_end` for a tool call
- **THEN** the extension SHALL forward all three events in order with the same `toolCallId`

#### Scenario: WebSocket disconnected during event
- **WHEN** an event fires while the WebSocket is disconnected
- **THEN** the extension SHALL buffer events (up to 1000) and flush them on reconnect

### Requirement: State sync on connect and reconnect
On initial connection or reconnection to the dashboard server, the bridge extension SHALL send the full session state so the dashboard can reconstruct the conversation.

State sync SHALL include:
- Session metadata (cwd, source, model, thinkingLevel, sessionName)
- All entries from `ctx.sessionManager.getBranch()` converted to protocol events
- Current accumulated token/cost stats from session entries
- Available commands from `pi.getCommands()`

#### Scenario: Reconnection after server restart
- **WHEN** the dashboard server restarts and the extension reconnects
- **THEN** the extension SHALL send a full `session_register` with all branch entries so the server can rebuild the session

#### Scenario: Large session state sync
- **WHEN** the session has more than 500 entries
- **THEN** the extension SHALL send state sync in chunks (100 entries per message) to avoid WebSocket frame size limits

### Requirement: Command relay from dashboard
The bridge extension SHALL listen for commands from the dashboard server and execute them in the pi session.

Supported commands:
- `send_prompt`: call `pi.sendUserMessage(text)` — if agent is streaming, use `{ deliverAs: "followUp" }`
- `abort`: call `ctx.abort()`
- `request_commands`: send updated `commands_list` response
- `request_state_sync`: re-send full session state

#### Scenario: User sends prompt from dashboard while agent is idle
- **WHEN** the extension receives `send_prompt` and `ctx.isIdle()` returns true
- **THEN** the extension SHALL call `pi.sendUserMessage(text)` without deliverAs option

#### Scenario: User sends prompt from dashboard while agent is streaming
- **WHEN** the extension receives `send_prompt` and agent is streaming
- **THEN** the extension SHALL call `pi.sendUserMessage(text, { deliverAs: "followUp" })`

#### Scenario: User aborts from dashboard
- **WHEN** the extension receives `abort`
- **THEN** the extension SHALL call `ctx.abort()` to stop the current agent operation

### Requirement: Command list for autocomplete
The bridge extension SHALL send the list of available commands to the dashboard server on connect and whenever commands change (e.g., after `/reload`).

The command list SHALL be obtained from `pi.getCommands()` and include name, description, source, and path.

#### Scenario: Commands sent on connect
- **WHEN** the extension connects to the dashboard server
- **THEN** it SHALL send a `commands_list` message with all available commands

#### Scenario: Commands updated after reload
- **WHEN** the pi session is reloaded (extension receives `session_start` again after reload)
- **THEN** the extension SHALL send an updated `commands_list` message

### Requirement: Stats tracking
The bridge extension SHALL accumulate token usage and cost from `turn_end` events and periodically send `stats_update` messages to the dashboard server.

Stats SHALL include: tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, total_cost.

#### Scenario: Stats update after turn
- **WHEN** a `turn_end` event fires with usage information
- **THEN** the extension SHALL accumulate the stats and send a `stats_update` to the dashboard server

### Requirement: Heartbeat
The bridge extension SHALL send a `session_heartbeat` message every 15 seconds to indicate liveness. The dashboard server SHALL mark sessions as disconnected if no heartbeat is received for 45 seconds.

#### Scenario: Heartbeat during idle session
- **WHEN** the pi session is idle with no events for 30 seconds
- **THEN** the extension SHALL still send heartbeats every 15 seconds

#### Scenario: Server detects disconnection
- **WHEN** no heartbeat is received from an extension for 45 seconds
- **THEN** the dashboard server SHALL mark the session status as `ended`
