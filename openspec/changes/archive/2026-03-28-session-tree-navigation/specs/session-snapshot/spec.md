## ADDED Requirements

### Requirement: Snapshot message format
The system SHALL define a `SessionSnapshotMessage` type for transmitting complete conversation state after tree navigation or fork operations. The message SHALL include:
- `type`: `"session_snapshot"`
- `sessionId`: string
- `reason`: `"tree_navigation"` | `"fork"`
- `messages`: array of `SnapshotMessage` objects ordered from root to leaf
- `forkedFrom?`: optional string (previous session file path, present only for fork)

Each `SnapshotMessage` SHALL include:
- `entryId`: string (the session entry ID)
- `role`: string (`"user"` | `"assistant"` | `"toolResult"` | `"compaction"` | `"branchSummary"`)
- `content`: string (message text content)
- `timestamp`: number (Unix ms)
- `toolName?`: optional string (for toolResult entries)
- `toolCallId?`: optional string (for toolResult entries)
- `images?`: optional array of `{ data: string; mimeType: string }`

#### Scenario: Snapshot after tree navigation
- **WHEN** a tree navigation completes
- **THEN** the bridge SHALL send a `session_snapshot` with `reason: "tree_navigation"` and all messages on the new branch path

#### Scenario: Snapshot after fork
- **WHEN** a fork completes
- **THEN** the bridge SHALL send a `session_snapshot` with `reason: "fork"`, the messages on the forked branch, and `forkedFrom` set to the previous session file path

#### Scenario: Snapshot message ordering
- **WHEN** a snapshot is created from `getBranch()`
- **THEN** the messages array SHALL be ordered from root (first message) to leaf (most recent message)

### Requirement: Snapshot entry conversion
The bridge SHALL convert `SessionEntry` objects from `ctx.sessionManager.getBranch()` into `SnapshotMessage` objects. Only message-bearing entries SHALL be included.

Conversion rules:
- `SessionMessageEntry` with `message.role === "user"`: extract text content from `message.content` (string or content blocks), extract images if present
- `SessionMessageEntry` with `message.role === "assistant"`: extract text from content blocks (skip thinking blocks)
- `SessionMessageEntry` with `message.role === "toolResult"`: extract text content, include `toolName` and `toolCallId`
- `CompactionEntry`: convert to role `"compaction"` with `summary` as content
- `BranchSummaryEntry`: convert to role `"branchSummary"` with `summary` as content
- `ModelChangeEntry`, `ThinkingLevelChangeEntry`, `CustomEntry`, `LabelEntry`, `SessionInfoEntry`: skip (not included in snapshot)

#### Scenario: User message with text content
- **WHEN** a `SessionMessageEntry` has `message.role === "user"` and `message.content === "Hello"`
- **THEN** the snapshot message SHALL have `role: "user"`, `content: "Hello"`

#### Scenario: User message with content blocks
- **WHEN** a `SessionMessageEntry` has `message.role === "user"` and `message.content` is an array with text and image blocks
- **THEN** the snapshot message SHALL have text content joined from text blocks and images extracted from image blocks

#### Scenario: Assistant message with thinking
- **WHEN** a `SessionMessageEntry` has `message.role === "assistant"` with content blocks including `thinking` and `text` types
- **THEN** the snapshot message SHALL include only text content (thinking blocks excluded)

#### Scenario: Tool result entry
- **WHEN** a `SessionMessageEntry` has `message.role === "toolResult"` with `toolName: "bash"` and `toolCallId: "call_123"`
- **THEN** the snapshot message SHALL have `role: "toolResult"`, `toolName: "bash"`, `toolCallId: "call_123"`

#### Scenario: Compaction entry in branch
- **WHEN** a `CompactionEntry` appears in the branch path
- **THEN** the snapshot SHALL include a message with `role: "compaction"` and the compaction summary as content

#### Scenario: Non-message entries skipped
- **WHEN** `getBranch()` returns `ModelChangeEntry` or `LabelEntry` entries
- **THEN** those entries SHALL NOT appear in the snapshot messages array

### Requirement: Client snapshot handling
When the client receives a `session_snapshot` event, it SHALL clear the current `SessionState` and rebuild it from the snapshot messages.

The rebuild process SHALL:
1. Reset all state fields to initial values (empty messages, zero counters, idle status)
2. Convert each `SnapshotMessage` to a `ChatMessage` in the event reducer format
3. Set the messages array to the converted messages
4. Preserve the session's accumulated stats (tokensIn, tokensOut, cost) — these are NOT reset

#### Scenario: Snapshot clears streaming state
- **WHEN** a `session_snapshot` arrives while the client has `isStreaming: true`
- **THEN** the state SHALL be reset to `isStreaming: false`, `streamingText: ""`, `status: "idle"`

#### Scenario: Snapshot rebuilds messages
- **WHEN** a `session_snapshot` arrives with 5 messages
- **THEN** the client's `messages` array SHALL contain exactly 5 `ChatMessage` objects in the same order

#### Scenario: Snapshot preserves stats
- **WHEN** a `session_snapshot` arrives and the client has `tokensIn: 5000`, `cost: 0.12`
- **THEN** the stats SHALL remain `tokensIn: 5000`, `cost: 0.12` after the snapshot is processed

#### Scenario: Compaction in snapshot
- **WHEN** a snapshot includes a message with `role: "compaction"`
- **THEN** the client SHALL render it as a compaction divider (same as `session_compact` event rendering)

### Requirement: Event store reset on snapshot
When the server receives a `session_snapshot` from the bridge, it SHALL clear all stored events for that session and insert the snapshot as a single event. This ensures browsers that reconnect or subscribe later receive the correct conversation state.

#### Scenario: Events cleared on snapshot
- **WHEN** the server receives a `session_snapshot` for a session that has 200 stored events
- **THEN** all 200 events SHALL be deleted and the snapshot SHALL be stored as seq 1

#### Scenario: New events after snapshot
- **WHEN** new streaming events arrive after a snapshot was stored
- **THEN** they SHALL be assigned sequence numbers starting from 2 (after the snapshot at seq 1)

#### Scenario: Browser subscribes after snapshot
- **WHEN** a browser subscribes to a session that had a snapshot reset
- **THEN** the replay SHALL include the snapshot event followed by any subsequent streaming events
