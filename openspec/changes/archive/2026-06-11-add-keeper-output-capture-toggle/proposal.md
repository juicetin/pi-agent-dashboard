## Why

Every headless pi session's keeper redirects pi's stdout+stderr straight into `keeper-<sessionId>.log` via `stdio: ["pipe", logFd, logFd]`. Pi emits full model API frames (request/response JSON, `thinkingSignature` blobs, base64, token usage) to that stream, so a single long session can write multiple GB, and the directory is never rotated or capped — one machine accumulated 22 GB across 514 logs and hit 95% disk. These logs are purely diagnostic (the keeper never reads pi stdout; RPC flows back over the bridge WebSocket), so 99% of sessions pay GB of disk cost for forensics nobody reads.

## What Changes

- Add an opt-in flag (default OFF) that gates capture of pi's stdout/stderr into the keeper log.
- When capture is OFF (default): keeper spawns pi with `stdio: ["pipe", "ignore", "ignore"]` — pi's verbose output is discarded.
- When capture is ON: keeper spawns pi with `stdio: ["pipe", logFd, logFd]` (today's behavior).
- The keeper's own lifecycle breadcrumbs (`keeper starting`, `spawning pi`, `pi exited code=…`) are written by the keeper's `log()` and are retained in `keeper-<sessionId>.log` regardless of the flag — crash diagnosis keeps working at minimal cost.
- Plumb the flag from server config through `KeeperManager` to the keeper via a new env var (same mechanism as `PI_KEEPER_PI_ARGS` / `PI_KEEPER_PI_CMD`).
- Surface a toggle in **Settings ▸ General**, alongside the existing diagnostic tools (`DiagnosticsSection` / `ToolsSection` / `SpawnFailuresSection`).

## Capabilities

### New Capabilities
<!-- none — all behavior already specced; this gates existing requirements -->

### Modified Capabilities
- `rpc-keeper-sidecar`: the keeper's pi-spawn stdio requirement changes from unconditional `stdio: ["pipe", logFd, logFd]` to flag-gated — `["pipe", "ignore", "ignore"]` when capture is OFF (default), `["pipe", logFd, logFd]` when ON; keeper lifecycle log lines are written either way.
- `shared-config`: add a `keeperLog` config block with `capturePiOutput: boolean` (default `false`), parsed and defaulted like the existing `OpenSpecPollConfig`.
- `settings-panel`: add a "Capture pi session output (debug)" toggle in the General tab next to the diagnostics sections, bound to `keeperLog.capturePiOutput` and included in the save diff.

## Impact

- `packages/shared/src/config.ts` — new `KeeperLogConfig` type, `DEFAULT_KEEPER_LOG`, parse + default in `loadConfig`.
- `packages/server/src/rpc-keeper/keeper-manager.ts` — read `config.keeperLog.capturePiOutput`, pass `PI_KEEPER_CAPTURE_PI_OUTPUT` env to the keeper.
- `packages/server/src/rpc-keeper/keeper.cjs` — read the env var, branch the pi child's stdout/stderr sink in `spawnPi()`.
- `packages/client/src/components/SettingsPanel.tsx` — new `ToggleField` in the General tab.
- Tests: keeper stdio-branch test, config parse/default test.
- No migration needed; absent config field defaults to `false` (capture OFF). Existing oversized logs are unaffected by this change (separate cleanup concern).
