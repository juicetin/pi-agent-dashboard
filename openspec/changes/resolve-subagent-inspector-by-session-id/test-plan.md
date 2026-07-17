# Test Plan — resolve-subagent-inspector-by-session-id

Stage: design   Generated: 2026-07-17

All Triples fill from the spec (concrete input · trigger · observable). No spec
gap → no clarification gate.

---

## Scenarios

### Edge-case

| id | requirement | technique | level | disposition | input | trigger | expected observable |
|----|-------------|-----------|-------|-------------|-------|---------|---------------------|
| E1 | Details may carry runner session id (dual-index) | decision-table | L1 | automated | a `subagent_started` frame whose `details` carry `agentId=A` (v4) and `agentSessionId=S` (v7) | reducer applies the frame | `subagents.get(A)` and `subagents.get(S)` return the SAME `SubagentState` ref; `state.agentSessionId === S`; `state.id === A` |
| E2 | Single-key when field absent (graceful degrade) | decision-table | L1 | automated | a `subagent_started` frame whose `details` have NO `agentSessionId` | reducer applies the frame | `subagents.get(A)` returns state; `subagents` has exactly one key for the run (no `S` alias key) |
| E3 | Backfilled completed subagent resolvable by either id | state-transition | L1 | automated | a `tool_execution_end` with `toolName="Agent"`, `endDetails.agentId=A`, `endDetails.agentSessionId=S` (no prior `subagents:*` frames — refresh/`/resume`) | reducer backfill arm runs | backfilled `SubagentState` retrievable under both `A` and `S` keys |
| E4 | Backfill single-key when field absent | state-transition | L1 | automated | same `tool_execution_end` but `endDetails` lack `agentSessionId` | reducer backfill arm runs | only the `A` key is set; no `S` alias |
| E5 | Resolution adds no independent bound (BVA on 64) | BVA | L1 | automated | 65 distinct running subagents tracked, each frame carrying its own `S`, then all completed | after the 65th, resync for the 1st (evicted) `agentId` and its `S` | both resync calls no-op; retained running-snapshot count ≤ 64; no separate index retains the completed 65 |
| E6 | Unknown id still shows placeholder | EP | L1 | automated | a `subagents` map with agent `A`/`S` present | `subagents.get(<id that is neither a tracked agentId nor agentSessionId>)` | returns `undefined` → `SubagentDetailView` renders "Subagent not found in this session." |

### Frontend-quirk

| id | requirement | technique | level | disposition | input | trigger | expected observable (invariant) |
|----|-------------|-----------|-------|-------------|-------|---------|---------------------------------|
| F1 | Inspector resolves a run by runner session id (running) | state-convergence | L3 | automated | a running faux subagent whose frames carry `agentSessionId=S`; parent session `P` | open `/session/P/subagent/S` (v7 in the `:agentId` slot) | inspector body converges to the live timeline; the string "Subagent not found in this session." is NOT shown |
| F2 | Deep-link by runner id after refresh (backfill — PRIMARY case) | state-transition | L3 | automated | a COMPLETED faux subagent whose end details carried `agentSessionId=S`; page reloaded (state-replay emits no `subagent_*` frames) | open `/session/P/subagent/S` | rehydrated timeline renders (not the placeholder) |
| F3 | Genuinely-unknown id still shows placeholder (regression) | state-transition | L3 | automated | parent session `P` with a known subagent | open `/session/P/subagent/<random-unknown-id>` | "Subagent not found in this session." IS shown (no false resolve) |

### Error-handling

| id | requirement | technique | level | disposition | fault | trigger | expected observable |
|----|-------------|-----------|-------|-------------|-------|---------|---------------------|
| X1 | Graceful degrade with old producer (no lockstep) | fault-injection (missing field) | L1 | automated | frames + end details that never carry `agentSessionId` (producer < 0.2.3) | resync/inspect by the runner session id `S` | reducer creates no `S` key; frame-buffer resync(`S`) no-ops; behaviour identical to today; no throw |
| X2 | Resync resolves by derived agentSessionId match | state-transition | L1 | automated | a retained running snapshot for `A` whose `details.agentSessionId=S` | `SubagentFrameBuffer.resync(S)` (id is not an `agentId` key) | returns that snapshot via the values-scan (fast path `get(A)` also returns it) |
| X3 | Terminated/evicted run resolves to nothing by either id | state-transition | L1 | automated | a subagent whose terminal frame (`completed`/`failed`) removed its retained snapshot | `resync(A)` and `resync(S)` | both no-op; no stale "running" snapshot served |
| X4 | Populated timeline still does not resync (regression) | state-transition | L1 | automated | a running subagent whose client `entries[]` is non-empty | open inline expand or popout | no `subagent_resync_request` is sent (unchanged variant-A guard preserved) |

### Performance

| id | requirement | technique | level | disposition | workload | metric + threshold | window |
|----|-------------|-----------|-------|-------------|----------|--------------------|--------|
| P1 | Derived scan is cheap on a full buffer | micro-latency | L1 | automated | a `snapshots` map at its 64-agent cap, resync by a non-matching `agentSessionId` (worst case: full scan, miss) | single-call wall time < 1 ms | single call |

---

## Coverage summary

- Requirements covered: 3/3 (details-carry-runner-id · inspector-resolves-by-runner-id · resync MODIFIED)
- Scenarios by class: edge 6 · perf 1 · frontend 3 · error 4
- Scenarios by level: L1 11 · L2 0 · L3 3
- Scenarios by disposition: automated 14 · manual-only 0

## New infra needed

- none (L1 exemplars: `packages/extension/src/__tests__/subagent-frame-buffer.test.ts`, `packages/client/src/lib/__tests__/event-reducer.test.ts`; L3 exemplar: `tests/e2e/subagent-inspector.spec.ts`).
