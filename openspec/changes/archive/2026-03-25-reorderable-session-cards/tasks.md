## 1. Protocol & Types

- [x] 1.1 Add `ReorderSessionsBrowserMessage` and `SessionsReorderedMessage` to `browser-protocol.ts` and update union types
- [x] 1.2 Add `sessionOrder` field to `StateData` interface in `state-store.ts`

## 2. Session Order Manager

- [x] 2.1 Create `session-order-manager.ts` with `SessionOrderManager` interface: `insert(cwd, sessionId, afterSessionId?)`, `reorder(cwd, sessionIds)`, `remove(cwd, sessionId)`, `getOrder(cwd, validIds)` — backed by state-store
- [x] 2.2 Write tests for `SessionOrderManager`: prepend on insert, insert-after-parent, reorder, remove, prune stale IDs, getOrder with filtering
- [x] 2.3 Create `PendingForkRegistry` (in same file or separate): `recordFork(cwd, parentSessionId)`, `consumeFork(cwd)` with 30s expiry timeout
- [x] 2.4 Write tests for `PendingForkRegistry`: record/consume, expiry, consume clears entry

## 3. Server Integration

- [x] 3.1 Wire `SessionOrderManager` into server startup (create from state-store)
- [x] 3.2 On `session_register` in `server.ts`: call `orderManager.insert()` — check pending fork registry for after-parent placement, otherwise prepend. Broadcast `sessions_reordered`.
- [x] 3.3 On `resume_session` with `mode: "fork"` in `browser-gateway.ts`: record pending fork entry before spawning
- [x] 3.4 On `resume_session` with `mode: "continue"` in `browser-gateway.ts`: no order change (session ID stays in place)
- [x] 3.5 Handle `reorder_sessions` browser message in `browser-gateway.ts`: update order and broadcast `sessions_reordered`
- [x] 3.6 Include session order in initial browser connection (send `sessions_reordered` for all cwds with orders on connect)
- [x] 3.7 Write integration test: new session prepends, fork inserts after parent, reorder updates, continue preserves position

## 4. Client State

- [x] 4.1 Add `sessionOrderMap` (Map<cwd, sessionId[]>) to event-reducer state and handle `sessions_reordered` messages
- [x] 4.2 Update `groupSessionsByDirectory` to accept order map and sort sessions within each group by server order (fallback: startedAt descending)
- [x] 4.3 Write tests for ordered grouping logic

## 5. Client Drag-and-Drop

- [x] 5.1 Install `@dnd-kit/core` and `@dnd-kit/sortable` dependencies
- [x] 5.2 Wrap session cards in `SortableContext` per folder group in `SessionList.tsx`
- [x] 5.3 Add `useSortable` hook to `SessionCard` with drag handle
- [x] 5.4 On drag end: optimistically update local order, send `reorder_sessions` message via WebSocket
- [x] 5.5 Write test: drag reorder sends correct message and updates UI
