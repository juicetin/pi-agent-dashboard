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
- `openspec_update`: openspec change data for the session's project (sessionId, data: OpenSpecData)

The `openspec_update` message SHALL include:
- `data.initialized`: boolean indicating whether openspec is initialized
- `data.changes`: array of `OpenSpecChange` objects with name, status, task counts, and artifact status

#### Scenario: Extension sends openspec_update
- **WHEN** the extension polls openspec CLI
- **THEN** it sends an `openspec_update` message with the combined change data

### Requirement: Server-to-extension WebSocket message types
The system SHALL define message types sent from the dashboard server to the bridge extension.

The following message types SHALL be defined for server → extension:
- `send_prompt`: deliver user text (and optional images) to the pi session
- `abort`: cancel in-progress agent work
- `request_commands`: ask extension to re-send commands list
- `request_state_sync`: ask extension to re-send session state
- `list_files`: request file listing for a query
- `openspec_refresh`: request immediate openspec data refresh

#### Scenario: Server sends openspec_refresh
- **WHEN** the browser requests an openspec refresh
- **THEN** the server forwards `openspec_refresh` to the extension

### Requirement: Server-to-browser WebSocket message types
The system SHALL define message types sent from the dashboard server to the browser client.

The following additional message type SHALL be defined for server → browser:
- `openspec_update`: forwarded openspec change data for a session

#### Scenario: Server forwards openspec_update to browser
- **WHEN** the server receives `openspec_update` from an extension
- **THEN** it broadcasts it to all subscribed browser clients

### Requirement: Browser-to-server WebSocket message types
The system SHALL define message types sent from the browser client to the dashboard server.

The following additional message type SHALL be defined for browser → server:
- `openspec_refresh`: request openspec data refresh for a session

#### Scenario: Browser sends openspec_refresh
- **WHEN** the user clicks the refresh button in the OpenSpec section
- **THEN** the browser sends `openspec_refresh` with the sessionId
