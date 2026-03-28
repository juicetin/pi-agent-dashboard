## Context

The pi agent stores sessions as trees (JSONL files with `id`/`parentId` linking). The `/tree` command navigates in-place (moves the leaf pointer), while `/fork` extracts a branch to a new session file. Both are only accessible from the TUI today.

The dashboard bridge extension currently forwards streaming events (`message_start`, `message_end`, `tool_execution_*`, etc.) and the client builds chat state incrementally through an event reducer. The bridge has access to `ExtensionAPI` (top-level) but not `ExtensionCommandContext` which provides `ctx.fork()` and `ctx.navigateTree()`.

Key constraint: `fork()` and `navigateTree()` are only available on `ExtensionCommandContext`, which is only provided to registered command handlers.

## Goals / Non-Goals

**Goals:**
- Remote tree visualization: see the session's branch structure from the dashboard
- Remote rollback: navigate to any point in the session tree from the dashboard
- Remote fork: create a new session branch from any point
- Chat view continuity: after tree/fork, rebuild the chat view for the new branch
- Fork linking: show when a session was forked and link to the fork point

**Non-Goals:**
- Inline rollback/fork buttons on individual chat messages (requires entry ID tracking through streaming events — save for later)
- Branch summarization UI (the summarize prompt during `/tree` is interactive TUI-only; we skip summarization for remote operations)
- Reading/parsing session JSONL files from the server (all data flows through the bridge extension)
- Tree visualization for ended/disconnected sessions (requires session file access)

## Decisions

### D1: Internal command for tree/fork access

**Decision:** Register a hidden `__dashboard` command via `pi.registerCommand()` in the bridge. The command handler receives `ExtensionCommandContext` with `ctx.fork()`, `ctx.navigateTree()`, and `ctx.sessionManager`.

**Rationale:** This is the only way to access `fork()` and `navigateTree()` from an extension. The `__` prefix convention signals it's internal. The bridge filters it from the commands list sent to the dashboard so it won't appear in autocomplete.

**Alternative considered:** Using `pi.sendUserMessage("/tree ...")` to invoke the built-in command — rejected because `/tree` launches an interactive TUI selector that doesn't work remotely.

**Alternative considered:** Exposing fork/navigateTree on `ExtensionAPI` directly — not possible, these are pi SDK design decisions we can't change.

### D2: On-demand tree snapshots

**Decision:** Tree snapshots are fetched on-demand when the user opens the tree panel, not pushed continuously.

**Flow:**
1. Browser sends `request_tree` → server relays to extension
2. Extension's `__dashboard` command reads `ctx.sessionManager.getTree()` and `ctx.sessionManager.getLeafId()`
3. Extension sends `tree_snapshot` back through the connection
4. Server relays to subscribing browsers

**Snapshot format:** Flattened array of tree nodes (not nested), each with:
```typescript
interface TreeNodeInfo {
  id: string;
  parentId: string | null;
  type: string;              // "message", "compaction", "branch_summary", etc.
  role?: string;             // "user", "assistant", "toolResult", etc.
  preview: string;           // First ~100 chars of message content
  timestamp: string;
  isLeaf: boolean;           // Whether this is the current leaf
  label?: string;            // User-defined label
  childCount: number;        // Number of direct children (for branch indicators)
}
```

**Rationale:** Flat array is simpler to serialize and the client can reconstruct the tree structure from `id`/`parentId`. On-demand avoids unnecessary traffic — most dashboard users won't use the tree panel frequently.

### D3: Session snapshot for conversation reset

**Decision:** After tree navigation or fork, the bridge sends a `session_snapshot` containing the full conversation for the new branch. The client replaces its chat state entirely.

**Flow:**
1. Tree/fork operation completes (bridge hears `session_tree` or `session_fork` event)
2. Bridge reads `ctx.sessionManager.getBranch()` — returns all entries from root to current leaf in order
3. Bridge converts entries to a snapshot format (simplified messages array)
4. Bridge sends `session_snapshot` through the connection
5. Server clears stored events for this session and stores the snapshot as a special reset event
6. Browser clears its `SessionState` and rebuilds from snapshot messages

**Snapshot message format:**
```typescript
interface SessionSnapshotMessage {
  type: "session_snapshot";
  sessionId: string;
  reason: "tree_navigation" | "fork";
  messages: SnapshotMessage[];     // Ordered root-to-leaf
  forkedFrom?: string;             // Previous session file (fork only)
}

interface SnapshotMessage {
  entryId: string;
  role: string;
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
  images?: Array<{ data: string; mimeType: string }>;
}
```

**Rationale:** The snapshot approach avoids changing the event reducer model. Normal streaming continues to work through events. Snapshot is a one-shot state replacement triggered only by tree/fork operations.

**Alternative considered:** Re-emitting synthetic `message_start`/`message_end` events for the new branch — rejected because it's fragile (tool execution events, streaming state, etc. would need careful simulation) and the reducer would need to handle a "clear first" signal anyway.

**Alternative considered:** Converting the reducer to be fully entry-based — rejected as too invasive. The event-based reducer works well for streaming; we only need the entry-based view for post-navigation reset.

### D4: Event store clearing on snapshot

**Decision:** When the server receives a `session_snapshot`, it deletes all stored events for that session and stores the snapshot as a single event with `eventType: "session_snapshot"`. New streaming events continue with the next sequence number.

**Rationale:** After tree/fork, the old events are stale (they describe a different branch). Keeping them would cause confusion if a browser reconnects and replays from the old sequence. The snapshot becomes the new baseline.

**Implementation:** Add a `deleteEventsForSession(sessionId)` method to `EventStore`. On receiving a session_snapshot in the pi-gateway callback, clear events and insert the snapshot event.

### D5: Tree panel component placement

**Decision:** The tree panel is a slide-out panel toggled by a button in the chat view header. It overlays the chat content on the right side, similar to how the session sidebar works.

**Rationale:** The tree panel is used infrequently and shouldn't take permanent space. A toggle button keeps it accessible without cluttering the chat view.

### D6: Fork handling — same sessionId, new conversation

**Decision:** When a fork occurs, the bridge's `sessionId` (our UUID) stays the same because it's the same pi process. The dashboard sees the same session but with a completely different conversation (via session_snapshot). The session card shows a "forked" badge with the fork reason.

**Rationale:** From pi's perspective, fork replaces the session file but the process continues. Creating a new dashboard sessionId would break the subscription model. Instead, we treat it as a conversation reset with metadata about the fork origin.

### D7: No summarization for remote tree navigation

**Decision:** Remote tree navigation via the dashboard always uses `summarize: false`. No summarization prompt is shown.

**Rationale:** The summarization flow in pi is interactive (3-option prompt: no summary / summarize / custom prompt). Implementing this UI remotely adds significant complexity for marginal value. Users who want branch summaries can use the TUI directly.

## Risks / Trade-offs

**[Risk] Command registration timing** — The `__dashboard` command is registered at extension load time but `ctx` is only available when the command is invoked. If the command is invoked during streaming, `ctx.fork()` or `ctx.navigateTree()` may behave unexpectedly.
→ Mitigation: Check `ctx.isIdle()` before executing. If streaming, return an error message to the browser. The tree panel can disable buttons while the session is streaming.

**[Risk] Large tree snapshots** — Long-running sessions with many branches could produce large tree snapshots.
→ Mitigation: Truncate `preview` to 100 chars. Exclude `custom` and `label` entry types from the snapshot (matching pi's default tree filter). For very large trees, consider pagination later.

**[Risk] Race condition between snapshot and new events** — After tree navigation, the bridge sends a snapshot, but new streaming events might arrive before the browser processes the snapshot.
→ Mitigation: The snapshot event gets a sequence number in the event store. The browser processes events in order. When it sees a `session_snapshot` event, it resets state regardless of what came before.

**[Risk] `__dashboard` command visible in pi TUI** — Users could discover and invoke it from the TUI.
→ Mitigation: The command handler validates the JSON args format and silently returns on invalid input. The `__` prefix convention discourages manual use. We filter it from the commands list we send to the dashboard.

**[Trade-off] No offline tree viewing** — Tree visualization requires a live bridge connection. Ended sessions can't show their tree.
→ Acceptable for v1. Future work could read session files from the server side.
