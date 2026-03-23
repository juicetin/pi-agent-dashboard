## 1. Config

- [x] 1.1 Add `autoShutdown` (boolean, default `true`) and `shutdownIdleSeconds` (number, default `300`) to `DashboardConfig` interface, defaults, `loadConfig()`, and `ensureConfig()` in `src/shared/config.ts`
- [x] 1.2 Update config tests to cover new fields

## 2. Pi Gateway connection callbacks

- [x] 2.1 Add `onEmpty` and `onConnection` optional callbacks to `PiGateway` interface
- [x] 2.2 Emit `onEmpty` when `connections.size` hits 0 (on `session_unregister` delete and heartbeat timeout delete)
- [x] 2.3 Emit `onConnection` when a new `session_register` adds to connections
- [x] 2.4 Write tests for connection callbacks

## 3. Server idle shutdown

- [x] 3.1 Add `autoShutdown` and `shutdownIdleSeconds` to `ServerConfig` interface
- [x] 3.2 Wire `piGateway.onEmpty` / `piGateway.onConnection` to start/cancel an idle timer in `createServer`
- [x] 3.3 On timer expiry, call `server.stop()` and `process.exit(0)`
- [x] 3.4 Start idle timer immediately on server start (handles case where no sessions ever connect)
- [x] 3.5 Write tests for idle shutdown logic

## 4. Browser connection status

- [x] 4.1 Change `ConnectionStatus` type from `"connected" | "reconnecting" | "disconnected"` to `"connected" | "connecting" | "offline"` in `useWebSocket.ts`
- [x] 4.2 Transition to `"offline"` after 3 consecutive connection failures, keep retrying in background
- [x] 4.3 Update status banner in `App.tsx`: `"connecting"` → yellow "Connecting...", `"offline"` → gray/red "Server offline"
