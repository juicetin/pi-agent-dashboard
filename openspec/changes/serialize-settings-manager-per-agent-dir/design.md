## Context

`packages/server/src/package-manager-wrapper.ts:266–303` lazily constructs pi's `DefaultPackageManager` per distinct `cwd`. The existing `pmCache` + `pmPending` pair already guarantees that two concurrent calls for the **same cwd** share one in-flight promise, and two sequential calls for the same cwd share a cached instance.

But the body that runs inside `pmPending` calls pi's `SettingsManager.create(effectiveCwd, AGENT_DIR)` — and `AGENT_DIR` is **global** (`~/.pi/agent/`), identical for every cwd. Inside pi, `SettingsManager.fromStorage` loads both the global settings (`<agentDir>/settings.json`) and the project settings (`<cwd>/.pi/settings.json`); the global load acquires a file lock via `proper-lockfile` on the global path.

Pi's `acquireLockSyncWithRetry` (observed at `@mariozechner/pi-coding-agent/dist/core/settings-manager.js:40–60`) busy-waits synchronously between retries:

```js
const start = Date.now();
while (Date.now() - start < delayMs) {
  // Sleep synchronously to avoid changing callers to async.
}
```

When two promise chains race to `SettingsManager.create` for *different* cwds (hence different `pmPending` keys, no dedup), both contend for the same global `settings.json` lock. `proper-lockfile`'s in-memory registry hands it to one; the other enters the busy-wait. The peer's microtask to release the lock cannot run while the busy-wait hogs the event loop, so the retry never succeeds; and because the caller that "won" eventually resumes and immediately re-enters for another reason (our observed livelock), the condition becomes permanent.

**This is reproducible, not theoretical.** The `cdp-pause` probe on the live vitest worker pid showed three consecutive 2s-spaced pauses all landing at the same PC inside `acquireLockSyncWithRetry`, with `lastError = "Lock file is already being held"` and the locked path inside the test's isolated HOME.

## Goals

- Eliminate the race condition on our side, **without** requiring any change in pi.
- Keep per-`cwd` semantics identical: same `pmCache`, same `pmPending`, same return type, same error flow.
- Zero new dependencies.
- Make the mutex trivial to remove once the upstream fix ships (so we don't carry dead mitigation code forever).

## Non-Goals

- Fixing pi's sync busy-wait. That's an upstream concern — we'll file an issue but are not blocked on it.
- Replacing `proper-lockfile`. That's upstream too.
- Serializing *all* pi interactions. Only `SettingsManager.create` is the known hot spot — other pi APIs (e.g. `listConfiguredPackages`) do not hit the global settings lock on every call.

## Decisions

### Decision 1 — Mutex granularity: per-`agentDir`, not global

**Choice:** key the mutex by `agentDir` (e.g. `AGENT_DIR = ~/.pi/agent`). In practice today there is only one `agentDir` per process, but the type signature already accepts it and the test harness uses a tmpdir-based alternate `agentDir`, so keying on it future-proofs multi-profile scenarios (e.g. a user running the dashboard against two isolated pi installs).

**Alternatives considered:**
- *Process-global singleton mutex:* simpler but incorrect for the tmpdir isolation test harness, which deliberately points different code paths at different `agentDir`s.
- *Mutex keyed by full settings path:* equivalent in practice (global path is derived from `agentDir`), but `agentDir` is the more natural identifier since it's what we already pass into pi.

### Decision 2 — Wrap the minimum: `SettingsManager.create + new SafePM`

**Choice:** the mutex is acquired immediately before `SettingsManager.create(...)` and released immediately after the `SafePM` constructor returns. We do **not** hold it for the whole lifetime of the package-manager instance.

**Rationale:** the livelock trigger is the `SettingsManager.create` call specifically (that's where pi's `withLock` fires). Subsequent `pm.listConfiguredPackages()` / `installAndPersist()` calls do not re-enter `withLock` in a way that races across cwds (each already has its own `SettingsManager` instance and uses it serially).

Holding the mutex longer would pessimize unrelated pi operations for no gain.

### Decision 3 — Minimal `AsyncMutex` primitive

**Choice:** a ~30-line promise-queue mutex in `packages/shared/src/async-mutex.ts` with a single `runExclusive<T>(key, fn): Promise<T>` method. No fairness guarantees beyond FIFO. No timeout option in v1 (we control the critical section; a deadlock inside it would be our own bug, not a foreign one).

**Shape:**
```ts
export class AsyncMutex<K = string> {
  private tail = new Map<K, Promise<unknown>>();
  async runExclusive<T>(key: K, fn: () => Promise<T>): Promise<T> {
    const prev = this.tail.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    // prevent unhandled-rejection if nobody awaits; set tail before awaiting
    this.tail.set(key, next.catch(() => {}));
    try { return await next; }
    finally {
      // cleanup if we're still the tail (no newer waiters queued)
      if (this.tail.get(key) === next.catch(() => {})) this.tail.delete(key);
    }
  }
}
```

(Exact cleanup predicate refined in implementation — the idea is: no leak if the map never drains, but map keys are bounded by distinct `agentDir`s which are O(1).)

**Alternatives considered:**
- `async-mutex` npm package: pulls a new runtime dep for a primitive we can inline in 30 LOC. Rejected.
- `p-queue` with concurrency: 1: same objection, plus heavier API than needed.

## Risks / Trade-offs

- **Latency added to concurrent cold starts.** Two distinct cwds instantiating their first `DefaultPackageManager` concurrently will now run sequentially. On macOS/Linux the cost is sub-millisecond per cwd; on Windows it's documented as "several seconds" but *already* paid once per cwd via `pmCache`. Net-new cost ≤ one cold-start, and only when the dashboard genuinely needs two different cwds' package managers before either has warmed.
- **Mutex leak if `fn` rejects.** Mitigated by `.catch(() => {})` on the tail promise and keyed cleanup in `finally`. Unit-tested.
- **Mutex defeats upstream fix detection.** If pi fixes the livelock we want to remove the mitigation cleanly — kept simple precisely so it's a one-file revert.
- **Cross-process contention still exists.** Two dashboard processes (or dashboard + a real `pi` CLI invocation) still race on the on-disk proper-lockfile. That's a strictly smaller blast radius (file lock works correctly between processes; in-memory registry wedge is the in-process bug) and is out of scope. Documented.

## Migration Plan

None. Pure additive server-side code. No persisted state, no wire protocol change, no upstream bump.

Rollback: delete `async-mutex.ts`, revert the two edits in `package-manager-wrapper.ts`. One commit.

## Open Questions

- Should we also serialize `pm.listConfiguredPackages()` / `pm.installAndPersist()` per `agentDir`? **Current answer: no.** The livelock evidence is specific to `SettingsManager.create`. If we later observe the same stack inside `listConfiguredPackages`, we expand the critical section; the mutex primitive supports it trivially. Defer.

- Do we need a test-only `forceAcquireSerial()` hook for deterministic repro? **Current answer: no.** The concurrency test can use a mocked `SettingsManager.create` with an artificial `await sleep(…)` to observe ordering; no production seam required.
