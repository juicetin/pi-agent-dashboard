# Tasks

## 1. Prerequisite
- [ ] 1.1 Confirm `scope-openspec-poll-to-active-cwds` is applied and that profiling under realistic load (62-change repo active) still shows main-thread stalls >50ms per tick. If not, defer this change.

## 2. Worker + pool (test-first)
- [ ] 2.1 Add `packages/server/src/__tests__/openspec-poll-worker.test.ts` — parity: worker `data` equals in-process derivation for a fixture change set; `serialized === JSON.stringify(data)`. Confirm it drives the not-yet-written worker (RED).
- [ ] 2.2 Implement `packages/server/src/openspec-poll-worker.ts` — import the existing pure derivation helpers; message in `{cwd, changesRoot, listResult, gateEnabled, perChangePreMtimes}` → out `{cwd, data, serialized, changeMtimes}`. No logic duplicated.
- [ ] 2.3 Implement `packages/server/src/openspec-poll-worker-pool.ts` — fixed pool (size `min(maxConcurrentSpawns, cpus)`, ≥1), request queue, per-request timeout, lifecycle tied to DirectoryService start/stop, in-process fallback on spawn/crash/timeout.
- [ ] 2.4 Fallback test: with worker unavailable, poll still yields correct data in-process.

## 3. Wire into the poll tick
- [ ] 3.1 In `directory-service.ts::pollOne()` (force===false), dispatch per-change derivation + serialization to the pool; keep `openspec list`, semaphore, cache write, broadcast on the main thread.
- [ ] 3.2 Consume worker `serialized` for the `nextJson !== prevJson` diff and pass it through to `broadcast()` (serialize exactly once, in-worker).
- [ ] 3.3 Preserve the TOCTOU gate: stamp `changeMtimes` from the worker result; discard racy changes exactly as today.
- [ ] 3.4 Add `DashboardConfig.openspec.useWorker` (default true) with validator + clamp in `packages/shared/src/config.ts`; false → permanent in-process path.

## 4. Verify
- [ ] 4.1 `npm test` green (`npm test 2>&1 | tee /tmp/pi-test.log`; `grep -nE 'FAIL|✗' /tmp/pi-test.log`).
- [ ] 4.2 Restart; under the 62-change repo, confirm per-tick main-thread time drops (no `slow tick`, event-loop lag stays low) and `openspec_update` payloads are unchanged byte-for-byte (capture a frame before/after).
- [ ] 4.3 Kill the worker mid-run; confirm the pool respawns and the tick falls back in-process without a dropped/corrupt broadcast.

## 5. Spec + docs
- [ ] 5.1 `openspec validate offload-openspec-poll-to-worker --strict` passes.
- [ ] 5.2 Delegate `docs/architecture.md` + file-index rows to a subagent in caveman style (poll derive+serialize runs in worker; main thread owns cache/broadcast/semaphore; in-process fallback; `useWorker` flag).
