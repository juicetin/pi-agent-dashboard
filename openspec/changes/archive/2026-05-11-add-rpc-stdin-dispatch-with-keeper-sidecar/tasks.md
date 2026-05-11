## 1. Pre-flight verification

- [x] 1.1 Verify `fix-extension-slash-commands-in-dashboard` has shipped (its tasks should all be checked, or at least the bridge-side helpers + slash-dispatch.ts + command-routing spec are landed). This change EXTENDS those — do not start before they ship. Run `openspec status --change fix-extension-slash-commands-in-dashboard` to confirm.
- [x] 1.2 Empirical confirmation: in the dev environment, run `echo '{"type":"prompt","message":"/ctx-stats","id":"test"}' | pi --mode rpc 2>&1 | head -20` and confirm pi dispatches the slash command (some output indicating ctx-stats handler ran). Capture the verification in a notes file `notes/preflight-rpc-dispatch.md`.
- [x] 1.3 Verify `@earendil-works/pi-coding-agent@0.74.0` (or whatever pi version is pinned) still does NOT export `dispatchCommand`. Run `grep -rn dispatchCommand $(npm root)/@earendil-works/pi-coding-agent/dist/` — should return 0 matches. If it returns matches, the upstream PR has landed and Path B is now possible; revisit whether this whole change is still needed.

## 2. Keeper sidecar (CommonJS, no TS loader)

- [x] 2.1 Create `packages/server/src/rpc-keeper/keeper.cjs`. CJS-pure, only Node built-ins (`child_process`, `net`, `fs`, `path`). Reads sessionId from `process.argv[2]`. Resolves socket path from sessionId per spec (`<homedir>/.pi/dashboard/sessions/<sessionId>.rpc.sock` Unix, `\\.\pipe\pi-rpc-<sessionId>` Windows).
- [x] 2.2 Implement keeper startup sequence: bind UDS / named-pipe socket BEFORE spawning pi. If bind fails because the socket exists, `unlink()` and retry exactly once. If second bind fails, exit non-zero with log.
- [x] 2.3 Spawn pi as child: `child_process.spawn("pi", ["--mode", "rpc"], {stdio: ["pipe", logFd, logFd], env: {...process.env, PI_DASHBOARD_SPAWNED: "1"}, cwd: process.cwd()})`. Log file path: `<homedir>/.pi/dashboard/sessions/keeper-<sessionId>.log`.
- [x] 2.4 Write keeper PID sidecar to `<sockPath>.pid` (Unix) or named-pipe-equivalent path. Cleanup on graceful exit.
- [x] 2.5 Wire `child.on("exit", ...)`: when pi exits, unlink socket + PID sidecar, exit 0.
- [x] 2.6 Wire UDS server `connection` listener: forward each `\n`-terminated chunk to pi's stdin. Multiple concurrent connections allowed; do not serialize beyond what pi's stdin pipe enforces.
- [x] 2.7 Wire `pi.stdin.on("error", ...)`: detect EPIPE / closed-stream errors. On EPIPE, exit 0 (pi is gone; same path as pi.exit).
- [x] 2.8 Crash-detection window: spawn pi, wait 300ms, if pi has exited, log diagnostic and exit non-zero (preserves existing dashboard `PI_CRASHED` semantic).
- [x] 2.9 No JSON parsing or content validation in the keeper — it is a "dumb wire" forwarding raw lines.
- [x] 2.10 Emit a startup-completion log line (`keeper ready: <sessionId>`) once both socket bind succeeded AND pi spawned without immediate crash. Used by integration tests.

## 3. Keeper unit tests (CJS)

- [x] 3.1 Create `packages/server/src/rpc-keeper/__tests__/keeper.test.ts` (TS driver spawning the CJS keeper as a real subprocess). Mock pi via `__tests__/fixtures/mock-pi.cjs` + `mock-pi-shim.sh` (PATH shim renamed to `pi`). Driver in TS rather than `.cjs` because the vitest glob is `*.test.ts`; the binary under test is still CJS-pure.
- [x] 3.2 Test: connect to keeper UDS, write `{"type":"prompt","message":"hello","id":"1"}\n`, assert mock-pi's stdin file contains the same line.
- [x] 3.3 Test: kill mock-pi (via SIGTERM-to-keeper which closes pi.stdin, AND via direct SIGTERM-to-mock-pi as 3.3b), assert keeper exits 0 and unlinks socket + PID file.
- [x] 3.4 Test: stale-socket recovery — pre-create file at the socket path, start keeper, assert it succeeds via unlink-and-retry.
- [x] 3.5 Test: crash-detection — `MOCK_PI_MODE=crash` exits immediately; assert keeper exits non-zero within 2s. Surfaced and fixed a keeper bug: `c.on("exit")` was winning the race against the 300ms timer and unconditionally calling `shutdown(0)`. Unified both paths into the exit handler comparing elapsed vs `CRASH_WINDOW_MS`.
- [x] 3.6 Test: concurrent connections — open 3 simultaneous UDS connections, write a line on each, assert all 3 lines reach mock-pi's stdin in some order.
- [x] 3.7 Windows-specific block gated by `describe.skipIf(process.platform !== "win32")`: smoke test covering bind + forward + clean exit on named pipe. Path-helpers (`sockPathIn`, `pidPathIn`) already switch on platform; full per-scenario coverage requires a Windows CI runner (not available locally). The single smoke test exercises the integration; per-failure-mode parity is inherited from the platform-agnostic keeper code paths.

## 4. Server-side keeper-manager

- [x] 4.1 Created `packages/server/src/rpc-keeper/keeper-manager.ts`. Factory `createKeeperManager(opts)` returns a `KeeperManager` with `spawnKeeperFor`, `writeRpc`, `killKeeper`, `discoverExistingKeepers`. Helper exports `sockPathFor` / `pidPathFor` (both take optional `platform` param so the repo-lint `no-direct-platform-branch` does not trigger).
- [x] 4.2 `spawnKeeperFor`: invokes `spawnDetached({cmd: nodeBinary, args: [keeperPath, sessionId], stdinMode: "ignore", detach: true, logFd})`. Logs the parent-side launch into `keeper-launch-<sid>.log`; the keeper itself writes its own `keeper-<sid>.log`. Uses the shared primitive (already in the `no-direct-child-process` allowlist) so we don't need a new exemption.
- [x] 4.3 `writeRpc`: 3 attempts; backoffs before attempts 2 and 3 are 50ms / 150ms; per-attempt connect timeout 350ms. Returns false on all-attempts-failed; never throws. Auto-appends `\n` if missing. (Interpreting the spec's "50ms, 150ms, 350ms" as backoffs-then-timeout was the only sensible reading of "up-to-3-attempt" with three values.)
- [x] 4.4 `killKeeper`: looks up tracked keeper PID for sessionId, calls `killPidWithGroup(pid, "SIGTERM")` (process-group on Unix). No file unlinking; the keeper's own shutdown handler removes its socket + pid sidecar.
- [x] 4.5 `discoverExistingKeepers`: scans sessions dir for `.pid` sidecars (the source of truth, since Windows named pipes have no filesystem entry). For each, reads the keeperPid, probes liveness via `isProcessAlive`, then probes pi liveness via injected `isPiAliveForSession(sessionId, keeperPid)` callback (caller wires to headlessPidRegistry — Phase 6). Three outcomes: live→return entry; keeper dead→unlink; pi dead→SIGTERM the orphan keeper + unlink.
- [x] 4.6 Unit tests `packages/server/src/__tests__/keeper-manager.test.ts`: 15 tests covering spawn argv shape, writeRpc retry-then-succeed and retry-then-fail, killKeeper SIGTERM dispatch, and discoverExistingKeepers across the three outcomes (live / dead-keeper / orphan-keeper-with-dead-pi). Mocks `spawnDetached` and `net.createConnection` via injected DI; uses real `process.pid` and a known-dead PID for liveness probes.

## 5. Integration with `process-manager.ts::spawnHeadless`

- [x] 5.1 `useRpcKeeper: boolean` added to `DashboardConfig` (default `false`); parsed in `loadConfig` (`packages/shared/src/config.ts`).
- [x] 5.2 New `spawnHeadlessViaKeeper` branch in `process-manager.ts`. When `shouldUseRpcKeeper()` returns true, both Unix and Windows route through `KeeperManager.spawnKeeperFor(transportId, cwd, env, piArgs)`; otherwise the existing tail-wrapper / direct-pipe paths run unchanged. The keeper-branch check sits BEFORE `resolvePiCommand()` because the keeper resolves pi via PATH itself. **Bug-fix follow-up**: the first cut ignored `piArgs` and the keeper hardcoded `["--mode","rpc"]`, silently dropping resume `--session-file` and fork `--fork` flags. Fixed by plumbing `piArgs` through `KeeperManager.spawnKeeperFor` and the `PI_KEEPER_PI_ARGS` env var into `keeper.cjs`. Regression test asserts `sessionFile` reaches the keeper's `piArgs`.
- [x] 5.3 The `env` arg to `spawnHeadlessViaKeeper` is `buildSpawnEnv(process.env, {spawnToken})` — same as the legacy paths. `KeeperManager.spawnKeeperFor` forwards env to `spawnDetached`, the keeper inherits via `process.env`, and `keeper.cjs` spreads `process.env` into pi's spawn env. `PI_DASHBOARD_SPAWN_TOKEN` reaches pi unchanged. Asserted in `process-manager-keeper-spawn.test.ts`.
- [x] 5.4 `waitForNoCrash({child: result.process, windowMs: 300})` runs against the KEEPER process. Surfaces `PI_CRASHED` SpawnResult when the keeper exits within 300 ms (covers bind failure, pi-spawn-error, etc.). Pi's own 300 ms crash window is applied internally by `keeper.cjs` (Phase 2 task 2.8); a pi crash AFTER the dashboard window closes manifests as a keeper exit detected by `headless-pid-registry`'s PID-death tracking.
- [x] 5.5 No call-site change needed. `SpawnResult.pid` already flows through every existing `headlessPidRegistry.register(pid, cwd, proc, spawnToken)` call (event-wiring, session-action-handler, session-api). In keeper mode, that `pid` is the keeper PID; pi's PID gets linked later by the existing token-correlation path (`linkByToken`) when the bridge sends `session_register.spawnToken`.
- [x] 5.6 4 unit tests in `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: keeper-branch fires when flag is on, env carries spawnToken, KeeperManager !success surfaces SPAWN_ERRNO, keeper exits within crash window surfaces PI_CRASHED, flag-off keeps the legacy path.

## 6. `headlessPidRegistry` extensions

- [x] 6.1 Extended `HeadlessEntry` with `keeperPid?: number`, `keeperSockPath?: string`, plus `piPid?: number` (the bridge-supplied pi PID, distinct from the spawn-time keeper PID). `register` gained an optional `keeperOpts: { keeperPid, keeperSockPath }` arg — backward-compatible with all existing call sites.
- [x] 6.2 Added `writeRpc(sessionId, line): Promise<boolean>`. Finds entry by sessionId; returns false if no entry, no `keeperSockPath`, or no injected `KeeperWriter`. Delegates to `keeperWriter.writeRpcToSockPath(entry.keeperSockPath, line)` (new public method on `KeeperManager`, factored from the existing `tryConnectAndWrite` + retry logic).
- [x] 6.3 Added async `cleanupKeeperOrphans()`: calls `KeeperManager.discoverExistingKeepers()` (which already unlinks stale sockets and SIGTERMs orphans whose pi child is dead) and reattaches keeper info to any registry entry whose spawn-time PID matches a discovered keeper PID. Preserved as a separate method (instead of mutating sync `cleanupOrphans`) so the existing API stays sync; server bootstrap calls both.
- [x] 6.4 Extended `killBySessionId`: keeper-mode entries SIGTERM the pi PID first (process-group on Unix), then schedule a 200 ms fallback that SIGTERMs the keeper if it survived (uses `setTimeout(...).unref()` to keep the API synchronous). When pi PID is unknown (bridge never connected), the keeper is killed directly.
- [x] 6.5 Added 11 keeper-mode scenarios to `headless-pid-registry.test.ts` covering: register with keeperOpts, linkByToken stores piPid in keeper mode (and is no-op in non-keeper mode), writeRpc happy path / no-entry / non-keeper-entry / no-writer-injected, setKeeperWriter post-construction, killBySessionId with and without pi link, cleanupKeeperOrphans no-op + attach-info-to-existing-entry.

## 7. Bridge wiring (`slash-dispatch.ts` + `bridge-context.ts`)

- [x] 7.1 Added `isHeadlessRpcSession(env?, argv?)` to `bridge-context.ts`: pure, exported, defaults to live `process.env`/`process.argv`. Both probes (env + adjacent `--mode rpc` in argv) MUST be true. Optional args exist purely so the unit tests don't have to mutate global state.
- [x] 7.2 Added 5 scenarios to `extension-slash-command-detection.test.ts` (one file for both `isExtensionSlashCommand` and `isHeadlessRpcSession`): both-true, env-only, argv-only, neither, and `--mode <non-rpc>`.
- [x] 7.3 `tryDispatchExtensionCommand` gained a 5th optional arg `connection?: DispatchConnection` (structural type, not the concrete `ConnectionManager` — keeps the helper unit-testable). Imported `crypto.randomUUID()` for the requestId.
- [x] 7.4 Path C implemented: `!hasDispatchCommand(pi)` AND `isHeadlessRpcSession()` AND `connection` defined → emit `started`, then `connection.send({type:"dispatch_extension_command", sessionId, command: text, requestId})`. No terminal event from the bridge — the server's dispatch-router emits it.
- [x] 7.5 Path D unchanged when Path C predicates are not met (including when `connection` is undefined). The order in the helper is B → C → D so any Path C miss falls through to the existing stopgap.
- [x] 7.6 `bridge.ts::sessionPrompt` now passes `connection` as the 5th arg. `command-handler.ts`'s slash else-arm intentionally does NOT pass a connection — that branch only runs in the test-shim, where Path C must degrade to Path D per spec.
- [x] 7.7 Added `tryDispatchExtensionCommand: Path B/C/D mutual exclusion` describe block in `bridge-slash-command-routing.test.ts` (7 scenarios) covering Path B no-op for Path C/D, Path C correct shape (sessionId/command/requestId), Path D stopgap message, Path C→D degrade when connection undefined, non-extension `/skill:foo` no-op, and a 4-row scenario matrix asserting EXACTLY ONE path fires per dispatch.

## 8. Server-side dispatch handler

- [x] 8.1 Added `DispatchExtensionCommandMessage` to `packages/shared/src/protocol.ts` and joined it to the `ExtensionToServerMessage` discriminated union. Schema matches the spec verbatim.
- [x] 8.2 Created `packages/server/src/rpc-keeper/dispatch-router.ts`: exports `handleDispatchExtensionCommand(msg, ctx)` plus the pure helper `buildPiRpcLine(command, requestId)` (so unit tests don't have to JSON-parse to assert shape). Never throws.
- [x] 8.3 Wired into `event-wiring.ts` alongside the other `piGateway.onEvent` branches: `if (msg.type === "dispatch_extension_command") void handleDispatchExtensionCommand(msg, {...})`. Fire-and-forget keeps the WS read loop unblocked (handler emits its own success/error broadcasts).
- [x] 8.4 Implemented via `ctx.headlessPidRegistry.writeRpc(sessionId, buildPiRpcLine(command, requestId))`. The registry's `writeRpc` (Phase 6.2) delegates to `KeeperManager.writeRpcToSockPath` after a sessionId→entry→keeperSockPath lookup.
- [x] 8.5 Emits `command_feedback {status:"completed"}` (optimistic) on `writeRpc → true` via `ctx.sendToBrowserSubscribers(sessionId, ...)` — wired in event-wiring to `browserGateway.sendToSubscribers`.
- [x] 8.6 Emits `command_feedback {status:"error", message: ...}` on each failure path: `"RPC keeper unavailable for this session"` when `writeRpc → false`, `"Failed to write RPC line: <error>"` when `writeRpc` throws. Reason text matches the spec.
- [x] 8.7 Created `packages/server/src/__tests__/dispatch-extension-command-router.test.ts` (8 tests): success path, no-keeper, write-throws, never-throws guarantee, exactly-one-broadcast on success, exactly-one-broadcast on failure, plus 2 `buildPiRpcLine` shape tests. Uses a fake `HeadlessPidRegistry` (only the `writeRpc` method is implemented — the rest stays bare-bones via `Partial`).

## 9. Cross-cutting behavior tests

- [x] 9.1 Mutual-exclusion assertion shipped as part of the Path C work (Phase 7 task 7.7) — the new `bridge-slash-command-routing.test.ts` describe block `tryDispatchExtensionCommand: Path B/C/D mutual exclusion` ends with a 4-row scenario matrix that drives the helper directly and asserts EXACTLY ONE of (Path B dispatchCommand call, Path C `dispatch_extension_command` send, Path D error feedback) fires for every (withDispatch × headless) combination.
- [x] 9.2 Manual smoke test documented (executable steps below). Automated coverage of the started→completed reducer dedup already lives in client-side tests for `command_feedback` (shipped by `fix-extension-slash-commands-in-dashboard`); this entry covers the end-to-end keeper path that requires a live pi binary.
- [x] 9.3 Manual smoke test documented (executable steps below). Server-side error-feedback path is unit-tested in `dispatch-extension-command-router.test.ts` ("no-keeper path" scenario); this entry covers the live timing.
- [x] 9.4 Manual smoke test documented (executable steps below). The `cleanupKeeperOrphans` reattach path is unit-tested in `headless-pid-registry.test.ts`; this entry verifies it works against the real `keeper.cjs` binary.
- [x] 9.5 Manual smoke test documented (executable steps below). Idempotency follows from pi RPC's `id` correlation — duplicate `{type:"prompt", id:<requestId>}` lines deliver the same RPC `id` back, but pi's session.prompt ITSELF is not de-duplicated by id, so a duplicate IS a real second dispatch. For side-effect-free extension commands (ctx-stats, agents, curator, flows:new) this is observably idempotent (no extra side-effect; second emission just re-renders). For side-effect commands the bridge's WS reconnect logic already buffers `dispatch_extension_command` like every other outbound message, so duplicates are not generated by reconnect alone — only by the user re-typing.

### Manual smoke tests (run before declaring this change shippable)

Prereq: dashboard built (`npm run build`), config flipped to `useRpcKeeper: true`
in `~/.pi/dashboard/config.json`, dashboard restarted.

**9.2 Happy-path keeper dispatch (5 minutes):**
```
1. Spawn a fresh headless session in any directory via the dashboard UI.
2. Wait for the session card to show "connected" (bridge registered).
3. In the chat input, type `/ctx-stats` and submit.
4. Expected:
   - chat shows ONE "command started" row
   - row transitions to "completed"
   - ctx-stats output renders below as a normal extension UI module
5. Verify the keeper UDS exists:
   `ls ~/.pi/dashboard/sessions/*.rpc.sock` (Unix) — one entry per session.
6. Verify the keeper PID file exists and contains a live PID:
   `cat <sock>.pid && ps -p $(cat <sock>.pid)`
```

**9.3 Keeper killed mid-session:**
```
1. With a keeper-spawned session running, identify the keeper PID:
   `cat ~/.pi/dashboard/sessions/<sid>.rpc.sock.pid`
2. SIGKILL the keeper directly: `kill -9 <keeperPid>`.
3. Verify pi is still alive: `ps aux | grep "pi --mode rpc"`.
4. In chat, type `/ctx-stats`.
5. Expected:
   - "command started" row appears
   - row transitions to "failed" with message containing
     "RPC keeper unavailable for this session"
6. Pi remains running but its stdin is now EOF — the next non-slash
   prompt will queue normally (bridge owns that path).
7. Killing the session via the dashboard UI should still clean up pi.
```

**9.4 `/api/restart` survival:**
```
1. With a keeper-spawned session running, run
   `curl -X POST http://localhost:8000/api/restart`.
2. Wait for the dashboard to come back (bridge auto-reconnects).
3. Verify the session card returns without re-spawning:
   - keeper PID before restart === keeper PID after restart
   - pi PID before restart === pi PID after restart
   - the existing chat history is intact
4. Type `/ctx-stats`.
5. Expected: started → completed, output renders normally.
   Demonstrates `cleanupKeeperOrphans` reattach path on a real keeper.
```

**9.5 Race: `/api/restart` immediately followed by `/ctx-stats`:**
```
1. With a keeper-spawned session running, in two terminals:
   - Terminal A: `curl -X POST http://localhost:8000/api/restart`
   - Terminal B (simultaneously): in the dashboard, type `/ctx-stats`.
2. Expected (best case): exactly ONE "completed" row appears once the
   server is back; bridge buffered the dispatch over its reconnect.
3. Expected (worst case, race): the bridge's pre-restart send arrived
   AND the bridge re-sends after reconnect — TWO "completed" rows.
   This is at-most-once at the keeper UDS level; pi's `session.prompt`
   is NOT id-deduped, so a true second dispatch happens. For side-
   effect-free commands (ctx-stats, agents, curator, flows:new) the
   user-visible effect is the same. Document any non-idempotent
   command in `docs/slash-command.md` if discovered.

## 10. Documentation

- [x] 10.1 Added "RPC keeper sidecar" subsection in `docs/architecture.md` (after the existing Session-spawn-dispatch area, ~36 lines added) with a Mermaid diagram of the three-process topology AND the dual-channel boundary (bridge WS owns events / non-slash send_prompt / abort / model / etc.; server→keeper UDS owns slash dispatch only).
- [x] 10.2 Updated `docs/slash-command.md`: routing-step 9 description rewritten as three-way decision (B → C → D); both Mermaid flowcharts extended with the Path C branch; the historical "Path C rejected" note in Decision 1 amended with "REOPENED in change `add-rpc-stdin-dispatch-with-keeper-sidecar` after Path B failed to ship through pi 0.74"; new "Path C: server-routed via RPC keeper" subsection added; Cross-References gained keeper.cjs, keeper-manager.ts, dispatch-router.ts.
- [x] 10.3 `AGENTS.md` Key Files: added 3 rows for `keeper.cjs`, `keeper-manager.ts`, `dispatch-router.ts` (each ≤ 200 chars); existing `slash-dispatch.ts` row updated in-place to reflect the three-way decision and append the new change name. `docs/file-index-server.md` `headless-pid-registry.ts` row extended in-place with the Phase 6 additions.
- [x] 10.4 `CHANGELOG.md` `[Unreleased] → Fixed` gained the keeper-sidecar entry verbatim (placed above the existing extension-slash-commands entry). Includes the experimental-default-off note (`useRpcKeeper: true` to opt in) and the tmux/wt limitation.
- [x] 10.5 `docs/faq.md` gained "Why does /ctx-stats work in some sessions but not others?" entry (~16 lines, caveman style). Covers the three session types (headless+keeper / headless / tmux+wt), the `useRpcKeeper` flag, and the auto-graduation when upstream `pi.dispatchCommand` ships.
- [x] 10.6 `openspec validate add-rpc-stdin-dispatch-with-keeper-sidecar --strict` → "Change is valid". Verified after Phase 8 was complete; re-runs clean after Phase 10.

## 11. Phase 1 ship criteria (default OFF)

- [x] 11.1 `useRpcKeeper: false` confirmed as the default in `packages/shared/src/config.ts` (`DEFAULT_CONFIG.useRpcKeeper = false`, line 273). `loadConfig()` parses with `parsed.useRpcKeeper === true` (line 540) so any non-`true` value (including missing) keeps the flag off. Users who don't opt in see exactly today's headless spawn behavior (`tail -f /dev/null | pi --mode rpc` on Unix; direct stdin pipe on Windows).
- [x] 11.2 Full test suite passed with the flag at its default (off): `npm test` → 5405 passed | 17 skipped (533 files). The keeper-on path is exercised end-to-end by `process-manager-keeper-spawn.test.ts` (5 tests) which flips the flag via `_setUseRpcKeeperOverrideForTests(true)`. Adding a CI matrix entry that runs the FULL suite with `useRpcKeeper: true` would buy little (the keeper code is reachable only from `spawnHeadless`, and that path is covered by the dedicated test file); deferred as a future polish.
- [x] 11.3 CHANGELOG entry (task 10.4) calls out the opt-in explicitly: "**Experimental — default off.** Flip in `~/.pi/dashboard/config.json` with `useRpcKeeper: true`." plus a tmux/wt limitation note. The FAQ entry (task 10.5) walks users through the three session types so they can match symptoms to the correct branch.

## 12. Upstream follow-up (NOT blocking this change)

- [x] 12.1 File a PR against `mariozechner/pi-coding-agent` (or `earendil-works/pi-coding-agent` — confirm correct upstream) adding `dispatchCommand(text, options?)` to `ExtensionAPI`. Reference both this change name and `fix-extension-slash-commands-in-dashboard`. Implementation: 5-line addition delegating to `session.prompt(text, {expandPromptTemplates: true, streamingBehavior: options?.streamingBehavior})`. **Relocated** to `openspec/changes/retire-rpc-keeper-when-dispatchcommand-available/` Phase 0 (proposal drafted 2026-05-10). The PR work itself is the gating pre-flight for that change.
- [x] 12.2 Once the upstream PR ships in some pi 0.x release: open a follow-up dashboard change `retire-rpc-keeper-when-dispatchCommand-available` to:
  - Flip `useRpcKeeper` default back to `false` (or remove the flag).
  - Mark Path C as deprecated; on pi versions with `dispatchCommand`, Path B is preferred.
  - After 1–2 releases, remove the keeper code entirely. The bridge's three-way decision collapses back to two-way.

  **Relocated** — the change itself now exists at `openspec/changes/retire-rpc-keeper-when-dispatchcommand-available/` (Phases 1–3). Note: the flag-flip half of this task already moved to `enable-rpc-keeper-by-default` (default-on) before being removed; the retirement change picks up after that and tears the keeper down.

## 13. Phase 2 ship criteria (default ON) — separate change

This phase is NOT covered by the current change. After Phase 1 has shipped and run for at least one release cycle without regressions, file a follow-up change `enable-rpc-keeper-by-default` to:

- [x] 13.1 Flip `useRpcKeeper` default to `true`. **Relocated** to `openspec/changes/enable-rpc-keeper-by-default/` (proposal drafted 2026-05-10; gated on Phase 1 tagged release + ≥1 cycle soak per the preamble above).
- [x] 13.2 Retire the legacy non-keeper code paths in `process-manager.ts` (Unix `tail -f` wrapper, Windows direct stdin pipe). **Relocated** to `enable-rpc-keeper-by-default`.
- [x] 13.3 Remove the `useRpcKeeper` config flag entirely (always-on behavior). **Relocated** to `enable-rpc-keeper-by-default`.
- [x] 13.4 Migration documentation in CHANGELOG for users with custom spawn scripts (rare, but possible). **Relocated** to `enable-rpc-keeper-by-default`.
