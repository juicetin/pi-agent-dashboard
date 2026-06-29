## 1. Resolve open questions (design.md)

- [ ] 1.1 Decide the cold-start `healthTimeoutMs` value for the bridge path (8 s / 10 s / 15 s) against the slowest supported host class — record in design.md
- [ ] 1.2 Confirm append-only `{ logFile }` policy is acceptable for the bridge path (shared with CLI server.log; no rotation concern) — record decision

## 2. Bridge auto-spawn writes a log file (server-launch)

- [ ] 2.1 Write failing test: bridge `launchServer` passes `stdio: { logFile: getServerLogPath() }` (not `stdio: "ignore"`) and `healthTimeoutMs: 10000`
- [ ] 2.2 Import `getServerLogPath` from `@blackbelt-technology/pi-dashboard-shared/dashboard-paths.js` in `packages/extension/src/server-launcher.ts`
- [ ] 2.3 Change `launchServer` to pass `stdio: { logFile }` and the extended `healthTimeoutMs`
- [ ] 2.4 Make 2.1 pass; assert `~/.pi/dashboard/server.log` exists with a header line after a (mocked) spawn

## 3. Truthful failure copy (server-launch)

- [ ] 3.1 Write failing test: `EarlyExitError` message in `server-launcher.ts` references `getServerLogPath()` output, not a hardcoded string
- [ ] 3.2 Write failing test: `server-auto-start.ts` warning `logPath` is derived from `getServerLogPath()` and is only emitted on the log-owning path
- [ ] 3.3 Replace the inline `path.join(os.homedir(), ".pi", "dashboard", "server.log")` in `server-auto-start.ts` with `getServerLogPath()`
- [ ] 3.4 Update the `EarlyExitError` branch message in `server-launcher.ts`
- [ ] 3.5 Make 3.1/3.2 pass

## 4. Shared spec scenario tests

- [ ] 4.1 Update `packages/shared` server-launcher tests pinning the extension stdio/timeout contract (was `stdio: "ignore"` / 2000 → now `{ logFile }` / 10000)
- [ ] 4.2 Add a slow-cold-start scenario test: server health-OK after >2 s but <10 s resolves without `readiness timeout`

## 5. Verify

- [ ] 5.1 `npm test` green
- [ ] 5.2 `openspec validate fix-bridge-server-start-diagnostics` passes
- [ ] 5.3 Manual: kill the server, start pi on a slow path, confirm slow cold start no longer warns AND when it does fail `~/.pi/dashboard/server.log` exists with content
