## Why

The dashboard can livelock an entire Node process when two concurrent code paths both call `SettingsManager.create()` (from `@mariozechner/pi-coding-agent`) against the same `<agentDir>/settings.json`. Observed in a real `npm test` run: the vitest worker pinned one CPU core at ~100 % for 26+ minutes with no progress, no timeout, and no SIGINT response. Three debugger pauses taken 2 s apart all showed the identical stack inside pi's `acquireLockSyncWithRetry`, with `proper-lockfile` reporting `"Lock file is already being held"` and a synchronous `while (Date.now() - start < 20) {}` busy-wait spinning the event loop so tightly that the peer's microtask — the one that would *release* the lock — never gets a chance to run.

The root fix belongs upstream in pi (the sync busy-wait and the in-memory proper-lockfile registry wedge together into an unrecoverable priority inversion). But until that lands, we can eliminate the trigger entirely on our side: `package-manager-wrapper` already dedupes concurrent `createPackageManager()` calls per-`cwd` via `pmPending`, but nothing prevents two *different* cwds from racing on the **same global `settings.json`**. A single global mutex keyed by `agentDir` (not `cwd`) closes that gap.

## What Changes

- **Server:** add a global per-`agentDir` async mutex to `PackageManagerWrapper.createPackageManager`. All calls to pi's `SettingsManager.create(effectiveCwd, agentDir)` SHALL run serially for a given `agentDir`, regardless of `cwd`. Callers still see the same `pmCache`/`pmPending` per-cwd semantics — the mutex only serializes the `SettingsManager.create` + `new SafePM(...)` body.
- **Shared utility:** introduce a minimal `AsyncMutex` helper (≤ 30 LOC) in `packages/shared/src/async-mutex.ts`. No dependency change.
- **Test coverage:**
  - a unit test that fires `createPackageManager` concurrently for N distinct cwds and asserts that pi's mocked `SettingsManager.create` is invoked strictly serially (no overlap across awaits),
  - a regression test that uses a slow mocked `SettingsManager.create` and asserts all N callers resolve within `N × slowMs + tolerance` (i.e. serialization, not parallelism).
- **Docs:** AGENTS.md key-file annotation for `package-manager-wrapper.ts` gains a sentence noting the global agentDir mutex. `docs/architecture.md` gets a short "Known upstream livelock in pi SettingsManager" note with a link to the upstream issue (to be filed — number TBD) and a summary of this mitigation.

This change is purely additive to our side — no behavioral change for callers, no API change, and no upstream dependency bump.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `package-manager`: the package manager capability's invariant "concurrent `createPackageManager` calls are deduped per cwd" is strengthened to also require global serialization of `SettingsManager.create` calls per `agentDir` to prevent the upstream pi livelock.

## Impact

- **Code (small surface):**
  - `packages/server/src/package-manager-wrapper.ts` — wrap the `SettingsManager.create(...) + new SafePM(...)` section of `createPackageManager` in an `agentDir`-keyed mutex acquire.
  - `packages/shared/src/async-mutex.ts` — new file, ~30 LOC, zero dependencies.
  - `packages/server/src/__tests__/package-manager-wrapper.test.ts` — new concurrency tests.
- **Tests:** +2 unit tests. Existing tests continue to pass unchanged.
- **APIs:** none.
- **Persistence/migration:** none.
- **Performance:** `SettingsManager.create` on macOS/Linux is sub-millisecond (file stat + read); serializing it adds negligible latency. On Windows cold-start (documented as "several seconds" in the existing code comment) the cost is already paid once per cwd via `pmCache`; serializing the *first* call across cwds adds at most one cold-start per extra cwd — acceptable.
- **Rollback:** drop the mutex wrapper and the new file. No data, no contract changes.
- **Compatibility with upstream fix:** when pi eventually fixes the livelock, our mutex becomes a no-op optimization. No code change required to benefit from the upstream fix.
- **Bug report:** a separate GitHub issue will be filed upstream on `@mariozechner/pi-coding-agent` pointing at `dist/core/settings-manager.js:40–60` and the deadlocked-stack evidence from the live debugger session. This proposal does not depend on that issue being resolved.
