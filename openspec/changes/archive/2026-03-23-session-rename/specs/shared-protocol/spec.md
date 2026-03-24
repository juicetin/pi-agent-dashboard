## MODIFIED Requirements

### Requirement: Extension-to-server WebSocket message types
The system SHALL define TypeScript types for all messages sent between the bridge extension and the dashboard server over WebSocket. Messages SHALL be JSON-serializable and include a `type` discriminator field.

The following message types SHALL be defined for extension → server:
- `session_register`: session metadata on connect (piSessionId, cwd, source, model, thinkingLevel, sessionName, entries for state sync)
- `session_unregister`: session disconnect
- `session_heartbeat`: periodic liveness signal
- `event_forward`: forwarded pi event (wraps any pi event type with sessionId)
- `commands_list`: available slash commands for autocomplete
- `extension_ui_event`: extension UI interaction (method, title, status, result)
- `stats_update`: accumulated token/cost stats, per-turn usage breakdown, and context window usage
- `files_list`: response to a file listing request (sessionId, query, files)
- `session_name_update`: session display name change (sessionId, name)

The `session_register` message SHALL include an optional `name` field for the initial session display name.

The `stats_update` message SHALL include:
- `stats.tokensIn`: accumulated input tokens (number)
- `stats.tokensOut`: accumulated output tokens (number)
- `stats.cost`: accumulated cost (number)
- `stats.turnUsage?`: per-turn breakdown `{ input, output, cacheRead, cacheWrite }` (optional, present when usage data is available on the turn)
- `stats.contextUsage?`: current context window state `{ tokens: number | null, contextWindow: number }` (optional, present when `ctx.getContextUsage()` returns data)

The following message types SHALL be defined for server → extension:
- `send_prompt`: user prompt from dashboard (text, images?)
- `abort`: abort current operation
- `request_commands`: ask extension to send updated commands list
- `request_state_sync`: ask extension to resend full state
- `list_files`: request file listing for autocomplete (sessionId, query)
- `rename_session`: rename session display name (sessionId, name)

#### Scenario: Message serialization round-trip
- **WHEN** any protocol message is created and serialized to JSON
- **THEN** it SHALL deserialize back to the same typed object with all fields intact

#### Scenario: Unknown message type
- **WHEN** a message with an unrecognized `type` field is received
- **THEN** the receiver SHALL log a warning and ignore the message without crashing

### Requirement: Server-to-browser WebSocket message types
The system SHALL define TypeScript types for all messages sent between the dashboard server and browser clients over WebSocket. Messages SHALL include a `type` discriminator field.

The following message types SHALL be defined for server → browser:
- `session_added`: new session connected (full DashboardSession object including optional name)
- `session_updated`: session metadata changed (partial update including name changes)
- `session_removed`: session disconnected/ended
- `event`: single forwarded event with sequence number
- `event_replay`: batch of events for replay on subscribe
- `commands_list`: available commands for a session
- `extension_ui_event`: forwarded extension UI interaction
- `workspace_updated`: workspace list changed
- `files_list`: file listing response
- `openspec_update`: openspec data for a session

The following message types SHALL be defined for browser → server:
- `subscribe`: subscribe to events for a session (with optional lastSeq)
- `unsubscribe`: unsubscribe from session events
- `send_prompt`: send prompt to a session
- `abort`: abort operation in a session
- `request_commands`: request commands list refresh
- `fetch_content`: request full content for a specific event
- `list_files`: request file listing
- `openspec_refresh`: request openspec data refresh
- `rename_session`: rename a session (sessionId, name)

#### Scenario: Session name included in session_added
- **WHEN** a new session is broadcast to browsers
- **THEN** the `session_added` message SHALL include the `name` field if set

#### Scenario: Rename from browser forwarded to extension
- **WHEN** a browser sends a `rename_session` message
- **THEN** the server SHALL forward a `rename_session` message to the target extension
