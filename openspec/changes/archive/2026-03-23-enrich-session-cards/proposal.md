## Why

Session cards in the sidebar currently only show the project folder name and model. Users have no visibility into what a session is doing (streaming, waiting for input, executing a tool), what tool is running, or how many tokens/cost have been consumed — all without clicking into the session. This makes it hard to monitor multiple sessions at a glance.

## What Changes

- Server parses `event_forward` messages for `agent_start`, `agent_end`, `tool_execution_start`, and `tool_execution_end` events, updates `DashboardSession` fields, and broadcasts `session_updated` to all browser clients.
- `DashboardSession.status` gains an `"idle"` state (waiting for user input) distinct from `"active"` (connected but not yet streaming). Status transitions: `active → streaming → idle` (cycling), `* → ended`.
- Session cards in the sidebar display: activity state indicator, current tool name, token counts (in/out), cost, source badge, and relative time since session started.

## Capabilities

### New Capabilities

_None — this enriches existing capabilities._

### Modified Capabilities

- `session-sidebar`: Add detailed session info rendering (activity state, current tool, tokens, cost, source badge, relative time)
- `dashboard-server`: Server-side parsing of forwarded events to update session status and currentTool, broadcasting changes to browsers
- `shared-protocol`: `DashboardSession.status` adds `"idle"` value; ensure `currentTool` updates flow via `session_updated`

## Impact

- **Types** (`src/shared/types.ts`): `SessionStatus` adds `"idle"` value
- **Server** (`src/server/server.ts`): Event parsing logic in `piGateway.onEvent` handler
- **Session manager** (`src/server/session-manager.ts`): Status update propagation
- **Client** (`src/client/components/SessionList.tsx`): Enriched card rendering
- **Event reducer** (`src/client/lib/event-reducer.ts`): Minor — status mapping alignment
- **No new dependencies**
