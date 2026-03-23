## Why

The dashboard server runs as a detached background process, auto-launched by the bridge extension. When all pi sessions disconnect, the server keeps running indefinitely consuming resources. It should automatically shut down after an idle period when no pi sessions are connected, since the bridge will auto-start it again when needed.

## What Changes

- Add `autoShutdown` (boolean, default `true`) and `shutdownIdleSeconds` (number, default `300`) to the shared config
- Pi Gateway emits callbacks when WebSocket connection count reaches zero and when a new connection arrives
- Server listens for these callbacks and manages an idle shutdown timer — when it expires, the server gracefully stops and the process exits
- Browser client connection status changes from `"connected" | "reconnecting" | "disconnected"` to `"connected" | "connecting" | "offline"` with distinct UI for each state

## Capabilities

### New Capabilities
- `auto-shutdown`: Server auto-shutdown when no pi sessions are connected, with configurable idle timeout

### Modified Capabilities
- `shared-config`: Add `autoShutdown` and `shutdownIdleSeconds` config fields
- `bridge-extension`: No spec-level change (auto-start already handles restart)

## Impact

- **Config**: `~/.pi/dashboard/config.json` gets two new fields
- **Server**: `src/server/pi-gateway.ts` — new connection count callbacks; `src/server/server.ts` — idle timer + graceful shutdown
- **Client**: `src/client/hooks/useWebSocket.ts` — new connection states; `src/client/App.tsx` — updated status banner UI
- **No breaking changes**: Default behavior changes (server now shuts down), but opt-out via `autoShutdown: false`
