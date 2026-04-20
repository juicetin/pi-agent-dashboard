## ADDED Requirements

### Requirement: Package manager instantiation serialized per agent directory
The server SHALL ensure that pi's `SettingsManager.create(cwd, agentDir)` is invoked at most once at a time for a given `agentDir`, regardless of how many distinct `cwd` values are requesting a new `DefaultPackageManager` concurrently. Concurrent requests for **different** `agentDir` values MAY run in parallel.

This requirement mitigates an upstream livelock in `@mariozechner/pi-coding-agent`'s `SettingsManager`: when two promise chains race to acquire the `proper-lockfile` lock on the same global `settings.json`, pi's synchronous busy-wait retry loop (`while (Date.now() - start < delayMs) {}`) starves the peer's release microtask, producing a permanent CPU-bound deadlock on the Node event loop.

#### Scenario: Two concurrent cwds serialize
- **WHEN** `createPackageManager(cwdA)` and `createPackageManager(cwdB)` are called in the same tick with the same `agentDir`
- **THEN** the second `SettingsManager.create` SHALL NOT begin execution until the first has returned (successfully or with a thrown error)

#### Scenario: Different agent directories run in parallel
- **WHEN** `createPackageManager(cwdA)` with `agentDir="/tmp/a"` and `createPackageManager(cwdB)` with `agentDir="/tmp/b"` are called concurrently
- **THEN** both `SettingsManager.create` calls MAY execute in parallel (the mutex only serializes per `agentDir`)

#### Scenario: Thrown error does not wedge the mutex
- **WHEN** the first `SettingsManager.create` call for an `agentDir` throws
- **AND** a second `createPackageManager` call for the same `agentDir` is subsequently made
- **THEN** the second call SHALL proceed normally (the mutex slot SHALL be released on both fulfilment and rejection paths)

#### Scenario: FIFO ordering
- **WHEN** three concurrent `createPackageManager` calls are queued on the same `agentDir`
- **THEN** their `SettingsManager.create` invocations SHALL execute in enqueue order
