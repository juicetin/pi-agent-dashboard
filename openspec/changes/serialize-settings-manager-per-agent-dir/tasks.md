## 1. AsyncMutex primitive (TDD)

- [ ] 1.1 Write failing unit tests at `packages/shared/src/__tests__/async-mutex.test.ts`:
  - [ ] 1.1.1 `runExclusive` for the same key runs two callbacks serially (second starts only after first resolves).
  - [ ] 1.1.2 `runExclusive` for different keys runs callbacks concurrently.
  - [ ] 1.1.3 A rejection in one call does not prevent the next call (same key) from running.
  - [ ] 1.1.4 FIFO order is preserved across ≥3 queued callers on the same key.
  - [ ] 1.1.5 No unhandled rejection is raised when the caller awaits `runExclusive` and the callback throws.
- [ ] 1.2 Implement `packages/shared/src/async-mutex.ts` with `AsyncMutex<K>.runExclusive<T>(key, fn)` and keyed cleanup.
- [ ] 1.3 Confirm tests from 1.1 pass.

## 2. Integrate into `package-manager-wrapper`

- [ ] 2.1 Write a failing test in `packages/server/src/__tests__/package-manager-wrapper.test.ts`:
  - [ ] 2.1.1 Mock pi's `SettingsManager.create` to `await sleep(50)` before returning; record enter/exit timestamps.
  - [ ] 2.1.2 Fire `createPackageManager` for 3 distinct cwds concurrently (same `agentDir`).
  - [ ] 2.1.3 Assert enter/exit intervals are non-overlapping (serialized) and total elapsed ≥ 150 ms.
- [ ] 2.2 Write a second failing test asserting that distinct `agentDir` values run concurrently (total elapsed ≈ 50 ms for 3 callers across 3 agent dirs).
- [ ] 2.3 Add `private readonly settingsMutex = new AsyncMutex<string>();` field to `PackageManagerWrapper` and wrap the `SettingsManager.create(...) + new SafePM(...)` block inside `createPackageManager` with `await this.settingsMutex.runExclusive(agentDir, async () => { ... })`.
- [ ] 2.4 Confirm new tests pass and all pre-existing tests in `package-manager-wrapper.test.ts` still pass unchanged.

## 3. End-to-end regression verification

- [ ] 3.1 Add a test or extend an existing integration test that boots `createTestServer()` and fires `GET /api/packages/installed` concurrently for two distinct cwds; assert both return 200 within a reasonable budget (e.g. ≤ 2 s) with no CPU spike.
- [ ] 3.2 Run the full workspace test suite (`npm test`) and confirm it completes in normal time (single-digit minutes) with no livelock.

## 4. Documentation

- [ ] 4.1 Update the `packages/server/src/package-manager-wrapper.ts` key-files row in `AGENTS.md` to mention the global agentDir mutex.
- [ ] 4.2 Add a short "Known upstream livelock in pi SettingsManager" section to `docs/architecture.md` (or the closest existing troubleshooting section) describing: the observed symptom (one CPU pinned, no timeout, identical stack at every pause), the upstream cause (sync busy-wait in `acquireLockSyncWithRetry`), and our mitigation (the mutex).
- [ ] 4.3 Add a `## [Unreleased]` → Fixed bullet in `CHANGELOG.md`: "Prevent livelock in `package-manager-wrapper` when two cwds race on pi's global `settings.json` lock."

## 5. Upstream bug report (parallel, non-blocking)

- [ ] 5.1 File an issue on `@mariozechner/pi-coding-agent` pointing at `dist/core/settings-manager.js:40–60`. Include:
  - [ ] debug transcript (3 identical stacks across 2 s intervals at `acquireLockSyncWithRetry`),
  - [ ] root cause sketch (sync `while (Date.now()-start < 20) {}` busy-wait + `proper-lockfile` in-memory registry wedge),
  - [ ] suggested fix (make `acquireLock*` async; use `setTimeout` for back-off; ensure proper-lockfile's registry entry is always cleaned up on thrown errors).
- [ ] 5.2 Link the issue number into `docs/architecture.md` once filed.

## 6. Archive

- [ ] 6.1 After merge and one green CI run, archive the change via `openspec archive serialize-settings-manager-per-agent-dir`.
