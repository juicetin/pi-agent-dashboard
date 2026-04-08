## Context

The dashboard supports forking sessions but only from the latest entry. Pi's `SessionManager` has `createBranchedSession(leafId)` which creates a new session file containing only the root→target path. However, `pi-coding-agent` is an optional peer dependency not installed in `node_modules`, so the server cannot import `SessionManager` directly.

Currently, chat messages in the client carry synthetic IDs (`msg-{index}`) with no link back to pi's session entry IDs. The server spawns forks via `pi --fork <sessionFile>` which always forks from the last entry.

## Goals / Non-Goals

**Goals:**
- Users can fork a session from any user or assistant message in ChatView
- Entry IDs flow from session entries through events to client chat messages (both replayed and live)
- Server creates a pruned session file when forking from a specific entry
- Forked sessions have clean OpenSpec state (no stale phase/change from parent)

**Non-Goals:**
- Full tree picker UI (pi's TUI-style tree selector with branches)
- Branch visualization across sessions
- Forking from tool calls, model changes, or thinking blocks

## Decisions

### 1. Entry ID propagation via event data

Attach `entryId` to the `data` payload of `message_start` and `message_end` events in `state-replay.ts` (for replayed events) and in `bridge.ts` via `ctx.sessionManager.getLeafId()` (for live events).

**Why**: Minimal change — just add one field to existing event payloads. No protocol schema changes needed since `data` is `Record<string, unknown>`.

**Alternative**: Separate API endpoint to fetch entry-to-message mapping. Rejected — adds complexity and a round-trip.

### 2. Standalone JSONL surgery for branched session creation

When `resume_session` includes an `entryId`, the server uses `createBranchedSessionFile()` in `session-file-reader.ts` to read the session JSONL, walk the tree from target entry to root, and write a pruned file. Then spawn `pi --fork <prunedFile>`.

**Why**: `pi-coding-agent` is an optional peer dependency not installed in `node_modules` — the server cannot import `SessionManager`. The session file format is simple JSONL with `id`/`parentId` tree structure, making standalone parsing straightforward.

**Alternative**: Import `SessionManager` from pi SDK. Rejected — package is not available at runtime on the server.

### 3. Fork button in message toolbar

Show a fork icon button in the `MessageBubble` toolbar alongside the existing copy buttons. The toolbar is at reduced opacity and becomes fully visible on hover.

**Why**: Consistent placement with existing actions (copy as markdown, copy as plain text). More discoverable than a separate floating button.

### 4. entryId tracks the message entry (user or assistant)

For each user message, store the `entryId` from `message_start`. For each assistant message, store the `entryId` from `message_end`. The fork button uses this `entryId`.

**Why**: The entry ID from `message_end` represents the complete turn — the last entry before the next user input. This is the natural branching point.

### 5. Skip OpenSpec detection during replay

OpenSpec activity detection (`detectOpenSpecActivity`) is skipped for events during replay. On `replay_complete`, `openspecPhase` and `openspecChange` are explicitly cleared.

**Why**: Replayed events from a forked session contain the parent's tool calls (reading skill files, change files), which would falsely set stale OpenSpec state on the new session.

### 6. Fork donor uses actual parent session

When inheriting `attachedProposal` for a forked session, use the specific parent session from `pendingForkRegistry` instead of searching for any ended session in the same cwd.

**Why**: The previous approach could pick up an unrelated ended session's proposal. Using the actual parent is correct.

### 7. Forked sessions prepend to top of list

Forked sessions are inserted at the top of the session list, consistent with how new sessions behave.

**Why**: Forked sessions are new work — placing them at the top makes them immediately visible.

## Risks / Trade-offs

- **JSONL format divergence** — `createBranchedSessionFile` duplicates tree-walking logic from pi's `SessionManager`. If the session file format changes, this code must be updated to match.
- **Entry ID missing on live events** — Live events are enriched via `ctx.sessionManager.getLeafId()`. If pi changes when the leaf advances relative to event emission, the ID could be off. Fallback: fork button only appears on replayed messages.
- **Stale session file** — If the session file was modified after events were replayed, the entry ID might not match. `createBranchedSessionFile` throws if ID not found — handled gracefully with error message.
