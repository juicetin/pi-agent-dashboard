## Why

The pi agent supports session branching via `/tree` (in-place navigation) and `/fork` (extract to new session). These are powerful features for exploring alternatives and rolling back mistakes, but they're only accessible from the TUI. Dashboard users monitoring sessions remotely have no visibility into the session's branch structure and no way to trigger rollback or fork operations. Adding tree navigation to the dashboard enables remote session control and makes the branching history visible.

## What Changes

- Bridge extension registers an internal command (`__dashboard`) to gain access to `ExtensionCommandContext` which provides `ctx.fork()`, `ctx.navigateTree()`, and `ctx.sessionManager.getTree()`
- Bridge forwards `session_tree` and `session_fork` events to the server
- Bridge sends on-demand tree snapshots (full tree structure with entry IDs) when requested by the browser
- Bridge sends session snapshots (full conversation state) after tree navigation or fork, so the client can rebuild the chat view for the new branch
- Bridge filters the `__dashboard` command from the commands list sent to the dashboard
- New protocol messages for tree/fork operations flow browser → server → extension
- New protocol messages for tree snapshots and session snapshots flow extension → server → browser
- Server relays the new message types between browser and extension WebSocket gateways
- Server clears stored events for a session when a session snapshot arrives (conversation reset)
- Client adds a tree panel component showing the session's branch structure with rollback and fork buttons on each node
- Client handles session snapshots by clearing chat state and rebuilding from the snapshot messages
- Client shows a "forked" indicator when a fork occurs, linking to the original session

## Capabilities

### New Capabilities
- `session-tree-panel`: Interactive tree visualizer component showing session branch structure with rollback (navigate_tree) and fork buttons on each node, loaded on-demand
- `session-snapshot`: Mechanism for the bridge to send a full conversation state snapshot after tree/fork operations, and for the client to reset and rebuild chat state from it

### Modified Capabilities
- `bridge-extension`: Register internal `__dashboard` command for tree/fork access, forward `session_tree`/`session_fork` events, send tree and session snapshots on request, filter internal command from commands list
- `shared-protocol`: Add protocol messages for tree operations (request_tree, navigate_tree, fork_session) and responses (tree_snapshot, session_snapshot)
- `chat-view`: Handle session snapshot events by clearing and rebuilding chat state; show "forked from" and "branch navigated" indicators
- `session-sidebar`: Show fork relationship indicator when a session was forked from another

## Impact

- **Bridge extension** (`src/extension/`): New command registration, new event forwarding, new snapshot logic in bridge.ts and command-handler.ts
- **Shared protocol** (`src/shared/`): New message types in protocol.ts and browser-protocol.ts, new snapshot types in types.ts
- **Server** (`src/server/`): Relay new message types in pi-gateway.ts and browser-gateway.ts, clear event store on snapshot in event-store.ts
- **Client event reducer** (`src/client/lib/event-reducer.ts`): Handle session_snapshot to reset state
- **Client components** (`src/client/components/`): New TreePanel component, updates to ChatView and SessionSidebar
- **Dependencies**: No new dependencies — uses existing pi extension APIs (`ctx.fork()`, `ctx.navigateTree()`, `ctx.sessionManager.getTree()`)
