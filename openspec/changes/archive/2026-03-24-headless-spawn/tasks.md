## 1. Config: Add spawnStrategy field

- [x] 1.1 Add `spawnStrategy: "tmux" | "headless"` to `DashboardConfig` interface in `src/shared/config.ts` with default `"tmux"`
- [x] 1.2 Update `loadConfig()` to read `spawnStrategy` with validation (invalid values fall back to `"tmux"`)
- [x] 1.3 Update `ensureConfig()` defaults to include `spawnStrategy`
- [x] 1.4 Add tests for new config field (valid, missing, invalid values)

## 2. Protocol: Add spawn_session messages

- [x] 2.1 Add `SpawnSessionBrowserMessage` type (`{ type: "spawn_session", cwd: string }`) to `src/shared/browser-protocol.ts`
- [x] 2.2 Add `SpawnResultBrowserMessage` type (`{ type: "spawn_result", cwd: string, success: boolean, message: string }`) to `src/shared/browser-protocol.ts`
- [x] 2.3 Add both to `BrowserToServerMessage` and `ServerToBrowserMessage` unions

## 3. Process Manager: Headless spawn strategy

- [x] 3.1 Add optional `strategy?: "tmux" | "headless"` to `SessionOptions` interface
- [x] 3.2 Add optional `pid?: number` to `SpawnResult` interface
- [x] 3.3 Implement headless spawn path in `spawnPiSession`: spawn `pi --mode rpc` with `cwd` and `PI_DASHBOARD_SPAWNED=1` env, stdin/stdout/stderr to `"ignore"`, detached, return pid in result
- [x] 3.4 Support `--session` and `--fork` flags in headless mode
- [x] 3.5 Add tests for headless spawn (build command, strategy routing)

## 4. Server: Handle spawn_session and child process tracking

- [x] 4.1 Add child process tracking map in `browser-gateway.ts` or a new `headless-tracker.ts`
- [x] 4.2 Handle `spawn_session` message in `browser-gateway.ts`: read config, call `spawnPiSession` with strategy, track pid if headless, send `spawn_result` to requesting browser
- [x] 4.3 Remove tracked process on child exit
- [x] 4.4 Add cleanup on server shutdown (SIGTERM/SIGINT): send SIGTERM to all tracked headless processes
- [x] 4.5 Add tests for spawn_session handling and process tracking

## 5. UI: Spawn button on folder card

- [x] 5.1 Add `onSpawnSession?: (cwd: string) => void` prop to `SessionList`
- [x] 5.2 Add `+` icon button on folder card group header (next to editor buttons)
- [x] 5.3 Wire button click to send `spawn_session` WebSocket message in `App.tsx`
- [x] 5.4 Handle `spawn_result` message in `App.tsx` — show success/error toast
- [x] 5.5 Add test for spawn button rendering and click behavior
