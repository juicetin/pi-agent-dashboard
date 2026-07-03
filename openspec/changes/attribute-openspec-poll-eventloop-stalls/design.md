# Design — Attribute and eliminate poll-path event-loop stalls

## Context

Measured evidence (production `/api/health` + 20-sample loop + 240k-line
`server.log`):

- Server event-loop delay: `mean≈p99≈21ms` (healthy), `max≈711–731ms` (lone
  recurring spike). Single synchronous burst signature.
- Not hydration (sample static during spike), not client (server-side ELD).
- `durationMs` per tick ≈ 4.6s is **jitter stagger**, not blocking; the 5s
  slow-tick warning is therefore near-useless (fires 1,704×, blind to the 700ms
  real stall).

The `server-openspec-polling` spec already moved derivation + serialization into
a worker. What it explicitly left on the main thread:

> "The main thread SHALL retain ownership of the `openspec list` CLI spawn, the
> spawn-concurrency semaphore, the per-cwd cache, the mtime/TOCTOU gate stamping,
> and the broadcast."

Plus `tickFolderHeads()` runs **ungated, every tick**, before the openspec gate,
doing git HEAD reads across every pinned + active-session directory.

## Why measure-first (not fix-first)

We have a strong candidate (`tickFolderHeads`) but not proof. The three
main-thread survivors — folder-head git reads, broadcast fan-out, gate `stat`
stamping — plus V8 GC are all plausible sources of a ~700ms burst. Shipping a
`tickFolderHeads` rewrite on a guess risks (a) fixing the wrong thing and (b)
duplicating the caution the archived poll work already exercised. Attribution is
cheap (`performance.now()` marks) and turns the guess into a fact before we
touch the hot path.

## Phase 1 — Attribution

### 1a. Sub-threshold event-loop spike retention

Today `/api/health` reads `{meanMs,p99Ms,maxMs}` from a histogram and **resets
it on every read**. A stall that happens when nobody polls leaves no trace.

Add a small ring buffer of the N worst recent event-loop-delay observations
(timestamp + ms + optional attributed segment), sampled on a fixed cadence
independent of `/api/health` reads, so the evidence is already captured when a
user later notices "it felt stuck." Model it on `hydration-metrics.ts`
(O(1) record, no serialization, process-local).

```
eventLoopSpikes: [
  { at: 1750000000000, ms: 711, segment: "folderHeads" },
  { at: 1749999940000, ms: 731, segment: "broadcast" },
  ...
]  // newest-first, capped
```

### 1b. Per-tick synchronous segment timing

Wrap the main-thread segments of `scheduleOpenSpecTick` in `performance.now()`
marks:

| Segment        | What it measures                                      |
|----------------|-------------------------------------------------------|
| `folderHeads`  | `tickFolderHeads()` — git HEAD reads, all folders     |
| `gateStat`     | mtime/TOCTOU `stat` stamping across changes           |
| `broadcast`    | `onChangeCallback` fan-out (serialize reuse + send)   |

Record the max segment per tick into the spike buffer's `segment` field. This is
the measurement that converts "700ms somewhere" into a named line.

### 1c. Fix the slow-tick alarm

`durationMs` (wall) is dominated by jitter — replace the warn signal with the
**sum of synchronous segment time** for the tick (`folderHeads + gateStat +
broadcast`), and set the threshold to something that catches a 700ms stall
(proposed default 250ms, configurable). Jitter no longer trips it.

## Phase 2 — Elimination (branches on 1b result)

Whichever segment 1b indicts:

**If `folderHeads` (leading hypothesis):**
- It runs ungated every tick. Apply the same mtime-gate discipline used for
  openspec: only re-read a folder's git HEAD when its `.git/HEAD` /
  `.git/refs` mtime advanced. Most folders don't switch branches every minute.
- Or make the git reads async (`child_process`/`fs.promises`) + bounded
  concurrency so they never form one synchronous burst.
- Or chunk with `setImmediate` between folders to yield to WS I/O.

**If `broadcast`:**
- Chunk the fan-out (yield between clients / dirs), or coalesce per-dir
  broadcasts within a tick into fewer, batched frames.

**If `gateStat`:**
- Batch the `stat`s via `fs.promises` with a concurrency cap; the gate result is
  already cached, only the freshness `stat` is per-tick.

**If GC:** attribution will show segment times all small while ELD max is high →
signals allocation pressure; separate follow-up (out of scope here, but the
attribution correctly points there instead of us guessing).

## Alternatives considered

- **Raise `pollIntervalSeconds` / unpin dirs (config only).** Real mitigation,
  zero code — recommended to the user as an immediate stopgap. But it only makes
  the stall rarer, not gone, and doesn't explain the source. Not a substitute for
  the fix; noted in tasks as the interim workaround.
- **Fix `tickFolderHeads` directly without attribution.** Rejected: guess-driven,
  may miss the real segment (broadcast/GC), no regression signal afterward.
- **New standalone perf subsystem.** Rejected: over-built. Extends the existing
  `server-session-hydration` eventLoop measurement + `/api/health` surface.

## Risks

- Segment marks add negligible overhead (a few `performance.now()` per tick).
- Ring buffer is process-local, bounded, no persistence — same proven shape as
  `hydration-metrics.ts`.
- Phase 2 touches the poll hot path; guarded by the archived mtime-gate tests +
  the byte-identical-payload invariant already in `server-openspec-polling`.
