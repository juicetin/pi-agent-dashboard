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
- `stats_update`: accumulated token/cost stats
- `files_list`: response to a file listing request (sessionId, query, files)

The following message types SHALL be defined for server → extension:
- `send_prompt`: user prompt from dashboard (text, images?)
- `abort`: abort current operation
- `request_commands`: ask extension to send updated commands list
- `request_state_sync`: ask extension to resend full state
- `list_files`: request file listing for autocomplete (sessionId, query)

#### Scenario: Message serialization round-trip
- **WHEN** any protocol message is created and serialized to JSON
- **THEN** it SHALL deserialize back to the same typed object with all fields intact

#### Scenario: Unknown message type
- **WHEN** a message with an unrecognized `type` field is received
- **THEN** the receiver SHALL log a warning and ignore the message without crashing

### Requirement: Server-to-browser WebSocket message types
The system SHALL define TypeScript types for all messages sent between the dashboard server and browser clients over WebSocket. Messages SHALL include a `type` discriminator field.

The following message types SHALL be defined for server → browser:
- `session_added`: new session registered (full session metadata)
- `session_updated`: session metadata changed (status, model, stats)
- `session_removed`: session disconnected
- `event`: forwarded pi event with session context and sequence number
- `event_replay`: batch of events for catch-up (array of sequenced events)
- `commands_list`: available commands for a session
- `extension_ui_event`: extension UI interaction for display
- `workspace_updated`: workspace added/removed/modified
- `files_list`: file listing response forwarded from bridge (sessionId, query, files)

The following message types SHALL be defined for browser → server:
- `subscribe`: subscribe to session events (sessionId, lastSeq)
- `unsubscribe`: stop receiving events for a session
- `send_prompt`: user prompt (sessionId, text, images?)
- `abort`: abort session operation (sessionId)
- `request_commands`: request command list for a session
- `fetch_content`: request full event payload for lazy loading (sessionId, seq)
- `list_files`: request file listing for autocomplete (sessionId, query)

#### Scenario: Browser subscribes to session with sequence
- **WHEN** browser sends `subscribe` with `lastSeq: 100`
- **THEN** server SHALL respond with `event_replay` containing all events with seq > 100

#### Scenario: Fetch lazy-loaded content
- **WHEN** browser sends `fetch_content` with sessionId and seq number
- **THEN** server SHALL respond with the full event payload for that sequence number

#### Scenario: Send prompt with images
- **WHEN** browser sends `send_prompt` with text and images array
- **THEN** server SHALL forward both text and images to the bridge extension

#### Scenario: File listing round-trip
- **WHEN** browser sends `list_files` with sessionId and query
- **THEN** server SHALL forward to the bridge, and forward the bridge's `files_list` response back to the browser

## ADDED Requirements

### Requirement: ImageContent type
The system SHALL define an `ImageContent` type compatible with the pi SDK format: `{ type: "image", data: string, mimeType: string }` where `data` is base64-encoded image content.

#### Scenario: ImageContent in send_prompt
- **WHEN** a `send_prompt` message includes an `images` field
- **THEN** each entry SHALL conform to `ImageContent` with type "image", base64 data, and a valid MIME type

### Requirement: FileEntry type
The system SHALL define a `FileEntry` type for file listing responses: `{ path: string, isDirectory: boolean }` where `path` is relative to the session's working directory.

#### Scenario: FileEntry for file
- **WHEN** a file listing includes a regular file
- **THEN** the entry SHALL have `isDirectory: false` and `path` as relative path (e.g., `src/server/db.ts`)

#### Scenario: FileEntry for directory
- **WHEN** a file listing includes a directory
- **THEN** the entry SHALL have `isDirectory: true` and `path` with trailing `/` (e.g., `src/server/`)
