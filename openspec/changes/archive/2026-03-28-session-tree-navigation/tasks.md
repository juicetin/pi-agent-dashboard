## 1. Shared Types & Protocol

- [ ] 1.1 Add `TreeNodeInfo` and `SnapshotMessage` types to `src/shared/types.ts`
- [ ] 1.2 Add `tree_snapshot` and `session_snapshot` extension→server message types to `src/shared/protocol.ts`
- [ ] 1.3 Add `request_tree`, `navigate_tree`, `fork_session` server→extension message types to `src/shared/protocol.ts`
- [ ] 1.4 Add `tree_snapshot` and `session_snapshot` server→browser message types to `src/shared/browser-protocol.ts`
- [ ] 1.5 Add `request_tree`, `navigate_tree`, `fork_session` browser→server message types to `src/shared/browser-protocol.ts`
- [ ] 1.6 Write protocol tests for new message types (serialization round-trip)

## 2. Bridge Extension — Command & Event Forwarding

- [ ] 2.1 Register `__dashboard` command in `bridge.ts` with `ExtensionCommandContext` dispatch
- [ ] 2.2 Add `session_tree` and `session_fork` to the forwarded event types list in `bridge.ts`
- [ ] 2.3 Filter `__` prefixed commands from `commands_list` messages in `bridge.ts`
- [ ] 2.4 Write tests for command filtering logic

## 3. Bridge Extension — Snapshot Logic

- [ ] 3.1 Implement `convertEntriesToSnapshot()` helper: convert `SessionEntry[]` from `getBranch()` to `SnapshotMessage[]` (in a new `src/extension/snapshot-builder.ts`)
- [ ] 3.2 Write tests for `convertEntriesToSnapshot()` covering user, assistant, toolResult, compaction, branchSummary, and skipped entry types
- [ ] 3.3 Send `session_snapshot` with `reason: "tree_navigation"` in the `session_tree` event handler
- [ ] 3.4 Send `session_snapshot` with `reason: "fork"` and `forkedFrom` in the `session_fork` event handler
- [ ] 3.5 Implement `get_tree` action in `__dashboard` command: read `getTree()`, flatten to `TreeNodeInfo[]`, send `tree_snapshot`
- [ ] 3.6 Write tests for tree-to-flat-nodes conversion

## 4. Bridge Extension — Server Request Handling

- [ ] 4.1 Handle `request_tree`, `navigate_tree`, `fork_session` messages in `command-handler.ts` by dispatching to `__dashboard` command
- [ ] 4.2 Add idle check guard: reject navigate_tree/fork_session when `ctx.isIdle()` returns false
- [ ] 4.3 Write tests for new command handler message types

## 5. Server — Relay & Event Store

- [ ] 5.1 Add `deleteEventsForSession(sessionId)` method to `EventStore` in `src/server/event-store.ts`
- [ ] 5.2 Write tests for `deleteEventsForSession`
- [ ] 5.3 Handle `tree_snapshot` in pi-gateway callback: relay to subscribing browsers via `browser-gateway`
- [ ] 5.4 Handle `session_snapshot` in pi-gateway callback: clear events, store snapshot as seq 1, relay to browsers
- [ ] 5.5 Handle `request_tree`, `navigate_tree`, `fork_session` in browser-gateway: relay to extension via `pi-gateway`
- [ ] 5.6 Write integration tests for snapshot relay and event store clearing

## 6. Client — Event Reducer & Snapshot Handling

- [ ] 6.1 Add `session_snapshot` case to `reduceEvent()` in `src/client/lib/event-reducer.ts`: clear messages, rebuild from snapshot, preserve stats
- [ ] 6.2 Write tests for snapshot reduction (clear, rebuild, preserve stats, handle compaction role)
- [ ] 6.3 Add `session_snapshot` and `tree_snapshot` handling to `useWebSocket` hook (or App.tsx message handler)

## 7. Client — Tree Panel Component

- [ ] 7.1 Create `TreePanel.tsx` component with slide-out panel layout
- [ ] 7.2 Implement tree structure rendering: connector lines, indentation, branch indicators (├─ └─)
- [ ] 7.3 Implement node display: role-based styling, preview text, active leaf marker, labels
- [ ] 7.4 Add rollback (↩) button on each node with hover reveal, disabled states (current leaf, streaming)
- [ ] 7.5 Add fork (🔀) button on each node with hover reveal, disabled while streaming
- [ ] 7.6 Implement on-demand loading: send `request_tree` on open, show spinner, handle timeout with retry
- [ ] 7.7 Implement refresh after rollback/fork: re-request tree when `session_snapshot` arrives
- [ ] 7.8 Write tests for TreePanel (rendering, button states, loading states)

## 8. Client — Chat View & Sidebar Integration

- [ ] 8.1 Add tree toggle button (🌳) to `SessionHeader.tsx` (visible only for live sessions)
- [ ] 8.2 Wire tree panel toggle state in `ChatView.tsx` or `App.tsx`
- [ ] 8.3 Show toast notification on snapshot: "↩ Navigated to branch" or "🔀 Session forked"
- [ ] 8.4 Add fork badge ("🔀 forked") to `SessionCard.tsx` when session has `forkedFrom` metadata
- [ ] 8.5 Store `forkedFrom` on session state when `session_snapshot` with `reason: "fork"` is received
- [ ] 8.6 Write tests for tree button visibility, toast triggers, and fork badge rendering
