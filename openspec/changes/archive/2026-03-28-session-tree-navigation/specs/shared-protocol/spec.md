## ADDED Requirements

### Requirement: Tree snapshot message types
The protocol SHALL define message types for tree snapshot communication.

Extension → Server:
- `tree_snapshot`: contains `sessionId`, `leafId` (string | null), and `nodes` (array of `TreeNodeInfo`)

`TreeNodeInfo` SHALL include:
- `id`: string (entry ID)
- `parentId`: string | null
- `type`: string (entry type: `"message"`, `"compaction"`, `"branch_summary"`)
- `role?`: string (message role: `"user"`, `"assistant"`, `"toolResult"`)
- `preview`: string (first 100 chars of message content)
- `timestamp`: string (ISO timestamp)
- `isLeaf`: boolean (whether this is the current leaf)
- `label?`: string (user-defined label, if any)
- `childCount`: number (number of direct children)

Server → Browser:
- `tree_snapshot`: same format, relayed from extension

#### Scenario: Tree snapshot relayed to browser
- **WHEN** the server receives a `tree_snapshot` from the extension
- **THEN** it SHALL relay it to all browsers subscribed to that session

### Requirement: Session snapshot message types
The protocol SHALL define message types for session snapshot communication.

Extension → Server:
- `session_snapshot`: contains `sessionId`, `reason` (`"tree_navigation"` | `"fork"`), `messages` (array of `SnapshotMessage`), and optional `forkedFrom` (string)

Server → Browser:
- `session_snapshot`: same format, relayed from extension. SHALL also be stored in the event store (after clearing previous events).

#### Scenario: Session snapshot stored and relayed
- **WHEN** the server receives a `session_snapshot` from the extension
- **THEN** it SHALL clear stored events for that session, store the snapshot as seq 1, and relay it to all browsers subscribed to that session

### Requirement: Tree operation request messages
The protocol SHALL define message types for requesting tree operations.

Browser → Server:
- `request_tree`: contains `sessionId`
- `navigate_tree`: contains `sessionId` and `targetId` (string)
- `fork_session`: contains `sessionId` and `entryId` (string)

Server → Extension:
- `request_tree`: contains `sessionId`
- `navigate_tree`: contains `sessionId` and `targetId` (string)
- `fork_session`: contains `sessionId` and `entryId` (string)

#### Scenario: Browser requests tree
- **WHEN** the browser sends `request_tree` with a sessionId
- **THEN** the server SHALL relay it to the extension for that session

#### Scenario: Browser requests navigate tree
- **WHEN** the browser sends `navigate_tree` with sessionId and targetId
- **THEN** the server SHALL relay it to the extension for that session

#### Scenario: Browser requests fork
- **WHEN** the browser sends `fork_session` with sessionId and entryId
- **THEN** the server SHALL relay it to the extension for that session

#### Scenario: Request for unknown session
- **WHEN** the browser sends a tree operation request for a session that is not connected
- **THEN** the server SHALL ignore the request (no error response needed, the client will timeout)

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
- `tree_snapshot`: session tree structure with nodes and current leaf
- `session_snapshot`: full conversation state after tree/fork operation

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
- `request_tree`: ask extension to send tree structure
- `navigate_tree`: ask extension to navigate to a tree node (sessionId, targetId)
- `fork_session`: ask extension to fork from a tree node (sessionId, entryId)

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
- `tree_snapshot`: session tree structure relayed from bridge
- `session_snapshot`: full conversation state relayed from bridge

The following message types SHALL be defined for browser → server:
- `subscribe`: subscribe to session events (sessionId, lastSeq)
- `unsubscribe`: stop receiving events for a session
- `send_prompt`: user prompt (sessionId, text, images?)
- `abort`: abort session operation (sessionId)
- `request_commands`: request command list for a session
- `fetch_content`: request full event payload for lazy loading (sessionId, seq)
- `list_files`: request file listing for autocomplete (sessionId, query)
- `request_tree`: request tree structure for a session
- `navigate_tree`: navigate to a tree node (sessionId, targetId)
- `fork_session`: fork from a tree node (sessionId, entryId)

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

#### Scenario: Tree operation round-trip
- **WHEN** browser sends `request_tree`, `navigate_tree`, or `fork_session`
- **THEN** server SHALL relay to the bridge extension and relay the response (`tree_snapshot` or `session_snapshot`) back to subscribing browsers
