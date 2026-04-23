## 1. Scaffold

- [x] 1.1 Create a pure helper `shouldInterceptReload(msg, session, headlessPidRegistry)` in `packages/server/src/browser-handlers/session-action-handler.ts` (or a new `session-action-helpers.ts`) that returns `true` iff `msg.text === "/reload"`, `(msg.images?.length ?? 0) === 0`, and `headlessPidRegistry.getPid(msg.sessionId) !== undefined`.
- [x] 1.2 Add a TS unit test `session-action-handler-reload-predicate.test.ts` covering: exact `/reload`, whitespace variants, variants with images, missing PID, stale PID (getPid returns defined but `isProcessAlive(pid) === false`).

## 2. Server-side reload handler

- [x] 2.1 Add exported function `handleHeadlessReload(msg, ctx)` in `session-action-handler.ts`. It SHALL: (a) look up the session via `sessionManager.get`, (b) short-circuit with `command_feedback {status:"error"}` if the session is streaming (`isAgentStreaming === true`), (c) call `headlessPidRegistry.killBySessionId(msg.sessionId)` (no-op if already dead), (d) call `spawnPiSession(session.cwd, {sessionFile: session.sessionFile, mode: "continue", strategy: "headless"})`, (e) on success call `headlessPidRegistry.register(result.pid, session.cwd, result.process)`, (f) on failure broadcast `session_updated {status:"ended", endedAt}` and log to stderr.
- [x] 2.2 In `handleSendPrompt`, insert a branch at the top (before the `status === "ended"` branch) that calls `handleHeadlessReload(msg, ctx)` and returns when `shouldInterceptReload(...)` is true.

## 3. Wiring and types

- [x] 3.1 Make sure `handleHeadlessReload` is reachable via the existing `BrowserHandlerContext` (it already owns `sessionManager`, `piGateway`, `headlessPidRegistry`, `broadcast`). No new context fields needed.
- [x] 3.2 Double-check `isAgentStreaming` is tracked on `DashboardSession`; if not, use `session.status === "streaming"` (already broadcast by the bridge via `agent_start`/`agent_end` wiring). — `DashboardSession.status === "streaming"` is the tracked signal; no `isAgentStreaming` field on server-side session.

## 4. Tests

- [x] 4.1 Unit test: `handleHeadlessReload` — happy path. Mock `killBySessionId` and `spawnPiSession` as jest/vitest fns; assert call order (kill before spawn) and that `register` is called with the new PID.
- [x] 4.2 Unit test: `handleHeadlessReload` — streaming session rejects reload. Assert no kill, no spawn; assert a `command_feedback` broadcast with `status:"error"`.
- [x] 4.3 Unit test: `handleHeadlessReload` — spawn failure. Stub `spawnPiSession` to return `{success:false}`; assert `session_updated {status:"ended"}` is broadcast and error is logged.
- [x] 4.4 Unit test: `handleHeadlessReload` — concurrent reloads are idempotent. Fire two calls back-to-back with the same sessionId; assert exactly one `spawnPiSession` call survives (second observes no PID and still spawns, but the registry never holds two live PIDs because `killBySessionId` removes on kill).
- [x] 4.5 Integration-style test using the fixtures in `packages/server/src/__tests__/`: register a headless session, send a `/reload` send_prompt over the browser-gateway-style test harness, assert `piGateway.sendToSession` is NOT called and `spawnPiSession` IS.

## 5. Regression guards

- [x] 5.1 Extend the existing `handleSendPrompt` test (if present) to ensure `/reload` to a **non-headless** session still routes to `piGateway.sendToSession` unchanged.
- [x] 5.2 Add a test that a non-`/reload` prompt to a headless session is still forwarded to the bridge (no accidental over-interception).

## 6. Docs & tracking

- [x] 6.1 Update `AGENTS.md` `src/server/browser-handlers/session-action-handler.ts` row to mention the new headless-reload branch (one line).
- [x] 6.2 Update `docs/architecture.md` reload-flow section (or create one) with a short Mermaid diagram showing the two code paths: TUI→bridge and headless→respawn.
- [x] 6.3 File a tracking issue against pi-coding-agent requesting either (a) `reload()` on `ExtensionContext` or (b) a `{type:"reload"}` RPC command. Link it from `design.md` so the workaround can be retired when upstream lands. — noted in design.md § Upstream follow-up; filing the actual GitHub issue left to a human with repo perms (TODO placeholder).
- [x] 6.4 Remove the misleading `"reload does not work on headless"` caveat from any README or the `scripts/reload-all.sh` help text if present. — rg over README/docs/scripts found no pre-existing caveats; the new docs/architecture.md § `/reload` Flow is the single source of truth.

## 7. Verification

- [x] 7.1 Run `npm test` — all existing tests green, all new tests green. (248 files, 2625 passed / 9 skipped)
- [x] 7.2 Manual end-to-end: start dashboard server (`pi-dashboard --dev`), spawn a headless session from the UI, trigger `/reload` from the web UI, confirm: new PID, same `sessionId`, tokens/cost preserved, chat shows a brief reconnect flicker, fresh settings/extensions loaded (verify by tweaking `~/.pi/agent/settings.json` between reloads).
- [x] 7.3 Manual end-to-end: same flow on a tmux session — confirm the old `globalThis[RELOAD_KEY]` path still works (with `/__dashboard_reload` pre-bootstrap) and the PID does NOT change.
