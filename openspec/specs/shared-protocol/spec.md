## ADDED Requirements

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

### Requirement: REST API types
The system SHALL define TypeScript types for the REST API used by the browser for non-real-time operations.

Endpoints SHALL include:
- `GET /api/workspaces`: list all workspaces
- `POST /api/workspaces`: create workspace (name, path)
- `PUT /api/workspaces/:id`: update workspace (name, sort_order)
- `DELETE /api/workspaces/:id`: remove workspace
- `GET /api/sessions`: list sessions (filter by workspaceId, status, date range)
- `GET /api/sessions/:id`: get session details
- `GET /api/events/:sessionId/:seq`: get full event payload (for lazy loading)
- `POST /api/sessions/new`: spawn new pi session in workspace
- `GET /api/stats`: aggregate stats across sessions

#### Scenario: REST response format
- **WHEN** any REST endpoint is called
- **THEN** it SHALL return JSON with a consistent envelope: `{ success: boolean, data?: T, error?: string }`

### Requirement: Shared data model types
The system SHALL define TypeScript types for the core data models shared across all components.

Types SHALL include:
- `Workspace`: id, name, path, sortOrder, createdAt
- `DashboardSession`: id, workspaceId, piSessionId, piSessionFile, cwd, source (tui|zed|tmux|unknown), displayName, status (active|idle|streaming|ended), model info, thinking level, token stats, cost, currentTool, timestamps
- `DashboardEvent`: id, sessionId, seq, eventType, payload, createdAt
- `SessionSource`: enum of tui, zed, tmux, unknown
- `SessionStatus`: enum of active, idle, streaming, ended
- `CommandInfo`: name, description, source, location, path

#### Scenario: Session status transitions
- **WHEN** a session status changes
- **THEN** it SHALL only transition through valid states: active → streaming → idle (cycling) or active/streaming/idle → ended (terminal)

#### Scenario: Idle status represents waiting for input
- **WHEN** a session's agent turn completes (`agent_end`)
- **THEN** the session status SHALL be `"idle"`, indicating it is waiting for user input

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

### Requirement: Git info update message
The protocol SHALL define a `git_info_update` message type for extension → server communication. The message SHALL include:
- `type`: `"git_info_update"`
- `sessionId`: string
- `gitBranch`: string
- `gitBranchUrl`: optional string
- `gitPrNumber`: optional number
- `gitPrUrl`: optional string

#### Scenario: Extension sends git info
- **WHEN** the extension detects git info for a session
- **THEN** it SHALL send a `git_info_update` message with all available fields

#### Scenario: Server receives git info
- **WHEN** the server receives a `git_info_update` message
- **THEN** it SHALL update the session record and broadcast `session_updated` to browser clients with the git fields
