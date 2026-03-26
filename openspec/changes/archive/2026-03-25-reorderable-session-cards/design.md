## Context

Sessions within a folder group currently render in Map iteration order — effectively insertion order with no user control. The server already persists per-session state (hidden flag) in `state-store.ts` using a debounced JSON file. The resume/fork flow spawns pi processes via `spawnPiSession()` but doesn't track parent↔child relationships for ordering purposes.

Key concurrency concern: multiple bridge extensions can register sessions simultaneously (e.g., server restart causes all active bridges to reconnect at once), so order mutations must be safe against races.

## Goals / Non-Goals

**Goals:**
- Persist per-cwd session order on the server
- Auto-place new sessions at the top, forked sessions after their parent, continued sessions in-place
- Allow drag-and-drop reordering from the browser client
- Broadcast order changes to all connected browsers
- Handle concurrent session registrations safely

**Non-Goals:**
- Cross-folder drag-and-drop (moving sessions between groups)
- Folder/group reordering (already sorted by most recent activity)
- Undo/redo for reorder operations

## Decisions

### 1. Extend state-store with session order

Store order as a map of `cwd → sessionId[]` in the existing state JSON file:

```json
{
  "hiddenSessions": ["abc"],
  "sessionOrder": {
    "/Users/rob/project": ["sess-3", "sess-1", "sess-2"]
  }
}
```

**Rationale:** Reuses the existing debounced JSON pattern. A separate store would add complexity for minimal benefit. The order data is small and closely related to other UI state.

**Alternative considered:** Separate `session-order-store.ts` — rejected because it duplicates the same JSON+debounce pattern and the data logically belongs with other UI preferences.

### 2. Server-side order manager with synchronous mutation

Create a `SessionOrderManager` class that:
- Holds the in-memory order map (cwd → string[])
- Exposes `insert(cwd, sessionId, afterSessionId?)`, `reorder(cwd, sessionIds[])`, `remove(cwd, sessionId)`, `getOrder(cwd)`
- All mutations are synchronous (single-threaded Node.js event loop = no data races within a single tick)
- Persists via the existing state-store debounced write

**Concurrency safety:** Node.js is single-threaded, so synchronous mutations within one event loop tick are atomic. The key insight is that `session_register` handling in `pi-gateway.ts` and `server.ts` is synchronous — the order insertion happens in the same tick as session registration. Multiple bridges connecting concurrently still process their messages sequentially in the event loop.

**Alternative considered:** Mutex/lock-based approach — rejected because Node.js's event loop already serializes synchronous operations. Adding locks would be unnecessary complexity.

### 3. Fork parent tracking via pending fork registry

When the browser sends `resume_session` with `mode: "fork"`, the server records a pending fork entry: `{ cwd, parentSessionId }`. When the next new session registers in that cwd (within a timeout), it's placed after the parent. The entry is consumed on match or expires after 30 seconds.

**Rationale:** The fork spawn is async (pi process starts, bridge connects later). We can't know the child's session ID at fork time. A simple pending registry bridges this gap.

**Alternative considered:** Using `parentSessionPath` from `PiSessionInfo` — rejected because that field is only available in session listing, not in the `session_register` message from the bridge.

### 4. Client drag-and-drop with @dnd-kit

Use `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop within folder groups.

**Rationale:** Lightweight, React-friendly, accessible, handles touch. The `SortableContext` + `useSortable` pattern maps directly to our session card list.

**Alternative considered:** Native HTML5 drag — poor mobile support and requires more boilerplate.

### 5. Protocol additions

Browser → Server:
```typescript
interface ReorderSessionsBrowserMessage {
  type: "reorder_sessions";
  cwd: string;
  sessionIds: string[];
}
```

Server → Browser (broadcast):
```typescript
interface SessionsReorderedMessage {
  type: "sessions_reordered";
  cwd: string;
  sessionIds: string[];
}
```

The server broadcasts `sessions_reordered` after any order change (drag-and-drop, new session insert, fork insert). This keeps all browser tabs in sync.

### 6. Client applies server order, falls back to startedAt

The client receives `sessions_reordered` and stores order per-cwd in the event reducer state. When rendering sessions within a group, sessions are sorted by their position in the order array. Sessions not in the order array are appended, sorted by `startedAt` descending (newest first).

## Risks / Trade-offs

- **[Stale order entries]** → Prune session IDs from order arrays when sessions are removed. The `getOrder()` method filters out IDs not present in the session manager.
- **[Fork race window]** → If no session registers within 30s after fork, the pending entry expires and the session falls to default (prepend) position. Acceptable degradation.
- **[Large order arrays]** → In theory a cwd could accumulate many session IDs. Mitigated by pruning on read and the fact that hidden/ended sessions eventually get cleaned up.
- **[New dependency]** → `@dnd-kit` adds ~15KB gzipped. Acceptable for the UX improvement.
