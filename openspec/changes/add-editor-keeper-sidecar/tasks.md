## 1. Keeper sidecar (`packages/server/src/editor-keeper/keeper.cjs`)

- [ ] 1.1 Scaffold `keeper.cjs` (CJS-pure, no TS loader); mirror layout of `packages/server/src/rpc-keeper/keeper.cjs`.
- [ ] 1.2 Parse argv: `<editorId> <cwd> <port> <binary> <dataDir>`; validate all five present; exit 2 with stderr message otherwise.
- [ ] 1.3 Open log file at `~/.pi/dashboard/editors/keeper-<editorId>.log`.
- [ ] 1.4 Compute socket path (`<editorId>.sock` POSIX, `\\.\pipe\pi-editor-<editorId>` Windows) and PID-sidecar path.
- [ ] 1.5 Unlink stale POSIX socket if present; retry bind once; exit non-zero on second failure.
- [ ] 1.6 Bind socket / pipe BEFORE spawning child.
- [ ] 1.7 Spawn code-server with `["--auth","none","--bind-addr",`127.0.0.1:${port}`,"--disable-telemetry","--disable-update-check","--user-data-dir",dataDir,cwd]`, `stdio: ["ignore", logFd, logFd]`, `detached: true`.
- [ ] 1.8 Write PID sidecar JSON after spawn returns a pid.
- [ ] 1.9 Implement JSON-line command handler: `heartbeat` → `ack`; `getStatus` → `status` with childPid/port/uptimeMs; `stop` → SIGTERM child, 5 s timer, SIGKILL pgroup, exit 0.
- [ ] 1.10 Handle child `exit` event: broadcast `{"event":"child_exit","code":N,"signal":S}` to all connected sockets, unlink socket+sidecar, exit 0.
- [ ] 1.11 Handle uncaught errors: log + cleanup + exit non-zero.

## 2. Keeper manager (`packages/server/src/editor-keeper/keeper-manager.ts`)

- [ ] 2.1 `spawnKeeperFor({cwd, port, binary, dataDir}) → Promise<{editorId}>` using `spawnDetached` from `src/shared/platform/detached-spawn.ts`.
- [ ] 2.2 `probe(editorId) → Promise<{alive: boolean, childPid?, port?, dataDir?, cwd?}>` — reads sidecar, verifies PIDs, opens socket, sends `getStatus`, 500 ms timeout.
- [ ] 2.3 `writeCommand(editorId, cmd: object) → Promise<void>` — opens socket, writes JSON line, closes.
- [ ] 2.4 `onChildExit(editorId, handler)` — opens persistent socket connection, parses `child_exit` events, invokes handler.
- [ ] 2.5 `killKeeper(editorId) → Promise<void>` — sends `stop`, waits 1 s for sidecar removal, otherwise SIGTERMs `keeperPid` directly.
- [ ] 2.6 `discoverExistingKeepers() → Promise<AdoptedEditor[]>` — scans sidecars, applies the 4-way adoption table from spec.

## 3. EditorManager integration (`packages/server/src/editor-manager.ts`)

- [ ] 3.1 Replace `generateId()` with `editorIdFromCwd(cwd) = sha256(cwd).slice(0,12)`.
- [ ] 3.2 Refactor `start(cwd, theme?)` to 3-way: in-memory → keeper-manager.probe → keeper-manager.spawnKeeperFor.
- [ ] 3.3 Remove direct `spawn(detection.binary, args, …)` block; replaced by `spawnKeeperFor`.
- [ ] 3.4 Refactor `stop(id)` to `keeperManager.writeCommand(id, {cmd: "stop"})` + 6 s fallback timer.
- [ ] 3.5 Subscribe to `child_exit` per registered instance to drive `setStatus("stopped")` + `cleanup`.
- [ ] 3.6 Make `stopAll()` config-gated: if `editor.stopOnDashboardExit` is `false` (default) it is a no-op against keepers; if `true` it writes `{"cmd":"stop"}` to every keeper in parallel and waits up to 6 s each. Add separate `forceStopAll()` for tests that bypasses the flag.
- [ ] 3.7 Wire `setTheme(cwd, theme)` — unchanged; still file-based via `settings.json` in the keeper's `dataDir`.

## 4. PID registry flip (`packages/server/src/editor-pid-registry.ts`)

- [ ] 4.1 Add `adoptOrphans()` that consumes `keeperManager.discoverExistingKeepers()` and registers adopted editors in `editor-manager`.
- [ ] 4.2 Reorder boot: `adoptOrphans()` first, then existing `cleanupOrphans()` cmdline sweep (scoped to non-sidecar code-server processes).
- [ ] 4.3 Remove `register()` / aggregate `editor-pids.json` writes — keepers own per-editor sidecars now. Keep file format readable for one release for migration logs.

## 5. Server boot wiring (`packages/server/src/server.ts`)

- [ ] 5.1 Call `adoptOrphans()` before any `editorManager.start()` and before `cleanupOrphans()`.
- [ ] 5.2 Log adopted editors at startup with cwd + port.

## 6. Cross-platform

- [ ] 6.1 Verify Windows named-pipe paths (`\\.\pipe\pi-editor-<id>`).
- [ ] 6.2 Use `spawnDetached` for Windows `DETACHED_PROCESS` + POSIX `setsid()`.
- [ ] 6.3 Skip POSIX socket-file unlink on Windows in keeper.cjs.

## 6b. Config + Settings UI

- [ ] 6b.1 `packages/shared/src/config.ts`: add `stopOnDashboardExit: boolean` to `EditorConfig`; default `false` in `DEFAULT_EDITOR_CONFIG`; extend `parseEditorConfig` to read the field.
- [ ] 6b.2 `packages/client/src/components/SettingsPanel.tsx`: add a labelled switch “Stop editors when dashboard exits” under the editor section, default `false`, with helper text “Leave off to let tabs and dirty buffers survive a dashboard restart.”
- [ ] 6b.3 Wire the field through `config-api.ts` read/write (covered by existing partial-merge path — verify with a unit test that the field round-trips).

## 7. Tests

- [ ] 7.1 Unit: `editorIdFromCwd(cwd)` is deterministic + 12 hex chars.
- [ ] 7.2 Unit: `keeper-manager.probe` returns `alive:false` on missing sidecar, dead keeperPid, dead childPid, socket timeout, port not bound.
- [ ] 7.3 Unit: `keeper-manager.discoverExistingKeepers()` returns adopted list and unlinks stale sidecars (4-way table coverage).
- [ ] 7.4 Unit: `editor-manager.start()` 3-way resolution — mock probe to test reattach path.
- [ ] 7.5 Unit: `editor-manager.stop()` writes `{"cmd":"stop"}` and removes entry on `child_exit`.
- [ ] 7.6 Unit: `stopAll()` with `stopOnDashboardExit=false` does NOT signal keepers; with `stopOnDashboardExit=true` writes `{"cmd":"stop"}` to every keeper and resolves after each `child_exit` or 6 s timeout.
- [ ] 7.6b Unit: `EditorConfig.stopOnDashboardExit` round-trips through `parseEditorConfig` and through the `/api/config` write path.
- [ ] 7.7 Integration (POSIX, gated by `process.platform`): spawn real keeper.cjs with a dummy child script (echo loop), verify socket probe + stop + sidecar cleanup.
- [ ] 7.8 Repo-lint test: keeper.cjs imports only Node built-ins (regex-grep of `require(...)`).

## 8. Documentation

- [ ] 8.1 Delegate to subagent: add rows to `docs/file-index-server.md` for `editor-keeper/keeper.cjs` + `editor-keeper/keeper-manager.ts` (caveman style).
- [ ] 8.2 Delegate to subagent: update `editor-manager.ts` and `editor-pid-registry.ts` rows in `docs/file-index-server.md` with "See change: add-editor-keeper-sidecar" annotations.
- [ ] 8.3 Delegate to subagent: extend `docs/architecture.md` with a short "Editor keeper sidecar" subsection pointing at the new spec (or create `docs/editor-keeper.md` if separate doc warranted).
- [ ] 8.4 Add backbone rows in `AGENTS.md` (≤200 char) for `editor-keeper/keeper.cjs` + `editor-keeper/keeper-manager.ts`.

## 9. Verification

- [ ] 9.1 Manual: open editor for folder A, run `pi-dashboard restart`, refresh browser → editor reappears at same `/editor/<id>/` URL with same tabs (combined with `fix-editor-settings-persistence`).
- [ ] 9.2 Manual: with default config, open editor, `pi-dashboard stop`, `pi-dashboard start` → editor adopted on boot; logs show "adopted N editors".
- [ ] 9.2b Manual: toggle “Stop editors when dashboard exits” ON in Settings, save, `pi-dashboard stop` → all editors terminate; next start shows zero adoptions.
- [ ] 9.3 Manual: kill keeper PID externally → next dashboard restart cleans up orphan child and logs upgrade-cleanup notice.
- [ ] 9.4 Manual: run on Windows + macOS + Linux to verify socket / pipe handling.
- [ ] 9.5 `npm test 2>&1 | tee /tmp/pi-test.log` clean.
- [ ] 9.6 `openspec validate add-editor-keeper-sidecar` passes.
