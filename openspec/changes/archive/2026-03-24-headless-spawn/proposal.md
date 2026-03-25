## Why

Users want to spawn and drive pi sessions entirely from the dashboard web UI without requiring tmux or a physical terminal. The current spawn mechanism only supports tmux, which means users must have tmux installed and switch to a terminal to interact with spawned sessions. A headless mode using `pi --mode rpc` enables fully browser-driven sessions.

## What Changes

- Add a `spawnStrategy` config field (`"tmux"` | `"headless"`, default `"tmux"`) to `~/.pi/dashboard/config.json`
- Add a headless spawn path in `process-manager.ts` that runs `pi --mode rpc` as a detached child process
- Add a `spawn_session` browser→server protocol message and `spawn_result` response
- Add a "New Session" (`+`) button on folder card group headers in the sidebar
- Server tracks headless child processes for cleanup on shutdown

## Capabilities

### New Capabilities
- `headless-spawn`: Configurable spawn strategy supporting headless (`pi --mode rpc`) child processes alongside existing tmux spawn, with a folder-card UI trigger

### Modified Capabilities
- `shared-config`: Add `spawnStrategy` field to `DashboardConfig`
- `process-manager`: Add headless spawn strategy using `pi --mode rpc`

## Impact

- `src/shared/config.ts` — New config field
- `src/shared/browser-protocol.ts` — New message types
- `src/server/process-manager.ts` — Headless spawn logic, child process tracking
- `src/server/browser-gateway.ts` — Handle `spawn_session` message
- `src/client/components/SessionList.tsx` — New session button on folder card header
- Bridge extension communication unchanged (Option A: bridge WS handles all session events/prompts)
