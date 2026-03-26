## Why

Session cards within a folder have no user-controllable order — they appear in arbitrary Map iteration order. Users need to organize sessions by priority/relevance, and new/forked sessions should appear in predictable positions relative to their context.

## What Changes

- Session cards within each folder group become drag-and-drop reorderable
- Server persists per-cwd session order in the JSON state store
- New sessions are prepended (position 0) in their folder's order
- Forked sessions are inserted immediately after their parent session
- Resumed (continue) sessions keep their existing position
- Order changes are broadcast to all connected browser clients
- Client uses `@dnd-kit/sortable` for drag-and-drop interaction
- Concurrency safety: server serializes order mutations to avoid races when multiple bridges register simultaneously

## Capabilities

### New Capabilities
- `session-ordering`: Server-side per-cwd session order persistence with auto-placement rules (new → prepend, fork → after parent, continue → same position) and drag-and-drop reorder protocol

### Modified Capabilities
- `session-grouping`: Sessions within a group are rendered in server-provided order instead of arbitrary iteration order
- `session-resume`: Fork operations track parent session ID for insertion positioning

## Impact

- **Server**: `state-store.ts` extended with `sessionOrder` map; `browser-gateway.ts` gains `reorder_sessions` message handler; `memory-session-manager.ts` updated to insert at correct position on register
- **Protocol**: New `reorder_sessions` (browser→server) and `sessions_reordered` (server→browser) messages in `browser-protocol.ts`
- **Client**: `SessionList.tsx` wraps session cards in `@dnd-kit/sortable` containers; new dependency on `@dnd-kit/core` + `@dnd-kit/sortable`
- **Concurrency**: Order mutations must be serialized on the server since multiple bridge connections can register sessions near-simultaneously
