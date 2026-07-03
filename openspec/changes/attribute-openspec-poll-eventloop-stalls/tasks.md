# Tasks — Attribute and eliminate poll-path event-loop stalls

## 0. Interim mitigation (no code — hand to user first)

- [ ] 0.1 Advise: unpin stale `.worktrees/*` dirs (the `automation-watcher` is
  attaching to each, inflating pinned-dir count 13→19) → verify pinned count drops
- [ ] 0.2 Advise: raise `openspec.pollIntervalSeconds` 60 → 180 in Settings →
  verify tick cadence via `/api/health` / server log
- [ ] 0.3 Re-run the 20-sample `/api/health` loop → verify `eventLoopDelay.maxMs`
  spikes become rarer (confirms the poll tick is the trigger before we build)

## 1. Phase 1 — Attribution (observability)

- [ ] 1.1 Add an event-loop spike ring buffer (`{at, ms, segment}`, newest-first,
  capped) modeled on `hydration-metrics.ts` → verify: unit test records + evicts
  at capacity, O(1), no serialization
- [ ] 1.2 Sample event-loop delay on a fixed cadence independent of `/api/health`
  reads, pushing worst observations into the buffer → verify: a synthetic 500ms
  block is captured even with zero `/api/health` requests
- [ ] 1.3 Surface `eventLoopSpikes` on `/api/health` (additive) in
  `routes/system-routes.ts` → verify: existing health test still passes + new
  field present
- [ ] 1.4 Wrap `tickFolderHeads`, gate `stat` stamping, and broadcast in
  `performance.now()` segment marks in `directory-service.ts`; record the max
  segment per tick into the spike buffer's `segment` field → verify: unit test
  asserts the slowest segment is attributed
- [ ] 1.5 Replace the slow-tick warn signal: key on summed **synchronous** segment
  time (not wall `durationMs`); default threshold 250ms, configurable → verify:
  a jitter-only tick (no work) does NOT warn; a 300ms synthetic segment DOES

## 2. Phase 1 — Confirm the culprit

- [ ] 2.1 Run the instrumented server under normal load; collect `eventLoopSpikes`
  across ≥30 min → verify: the dominant `segment` behind ~700ms spikes is
  identified with evidence (not a guess)
- [ ] 2.2 Record the finding in `design.md` (which branch of Phase 2 applies)

## 3. Phase 2 — Eliminate the attributed segment

> Implement ONLY the branch 2.1 indicts. Do not pre-build all branches.

- [ ] 3.1 If `folderHeads`: mtime-gate the folder-head poll (re-read git HEAD only
  when `.git/HEAD`/`refs` mtime advanced) and/or make reads async + concurrency-
  bounded → verify: segment time for `folderHeads` drops below threshold with
  unchanged branches; branch-switch still reflects in the UI on next tick
- [ ] 3.2 If `broadcast`: chunk/yield the fan-out or batch per-dir frames →
  verify: `broadcast` segment no longer forms one >250ms burst
- [ ] 3.3 If `gateStat`: batch `stat`s via `fs.promises` with a concurrency cap →
  verify: `gateStat` segment bounded
- [ ] 3.4 (Any branch) Re-run the 20-sample `/api/health` loop → verify:
  `eventLoopDelay.maxMs` stays within a small multiple of `p99` (target: no
  recurring >250ms main-thread stall on an idle-content repo)

## 4. Regression + docs

- [ ] 4.1 Ensure archived mtime-gate + byte-identical-payload tests still pass
  (`npm test`) → verify: green
- [ ] 4.2 Add a regression test asserting a no-op tick (nothing changed) produces
  no event-loop spike above threshold → verify: fails before 3.x, passes after
- [ ] 4.3 Update `docs/architecture.md` poll section + the touched directory
  `AGENTS.md` rows (delegated per docs protocol) → verify: `kb dox lint` clean
