# Attribute and eliminate intermittent event-loop stalls in the poll path

## Why

Users report the dashboard "sometimes seems stuck" — chatlog loading and other
interactions freeze for a fraction of a second, intermittently. Live measurement
against a running production server (`/api/health`) reproduced a concrete signal:

```
eventLoopDelay:  meanMs=20.8   p99Ms=21.3   maxMs=731     ← lone ~700ms spike
recentHydration: wallMs=232    fileBytes=74463            ← unchanged across the stall
```

A 20-sample poll loop caught the transient in the act:

```
elMax=21ms → 180ms → 711ms → 22ms   (p99 stayed 21ms the whole time)
```

Findings, in order of what they rule out:

1. **Not session hydration.** The `hydration` sample did not change during the
   711ms spike — no chatlog was being loaded when the event loop blocked.
   Hydration is already timed + worker-offloadable (`server-session-hydration`).
2. **Not the client.** This is server-side `monitorEventLoopDelay` — the Node
   main thread itself blocked. Every connected WebSocket client freezes for that
   window at once, which is exactly the "server seems stuck" symptom: during the
   block the server cannot flush WS frames, so an in-flight chatlog replay waits.
3. **The `p99≈21ms` / `max≈711ms` shape is a single synchronous operation**, not
   sustained load — a lone main-thread burst, recurring (731ms, then 711ms).

The existing OpenSpec poll optimizations do **not** cover this:

- mtime-gate, spawn-concurrency cap, jitter, and worker-offload of derivation +
  serialization already shipped (archived: `optimize-openspec-poll-burst`,
  `fix-openspec-mtime-gate-blind-spots`, `fix-openspec-mtime-gate-toctou`, and
  the `server-openspec-polling` "derivation runs off the main event loop" req).
- But three things still run **on the main thread every tick**, by that spec's
  own wording: `tickFolderHeads()` (git HEAD reads, **ungated, every tick**), the
  broadcast fan-out, and the mtime/TOCTOU gate `stat` stamping.
- And the existing `TICK_SLOW_WARN_MS = 5000` threshold is effectively **dead**:
  `jitterSeconds` defaults to 5, so a tick's `durationMs` sits at ~4.6s by
  design (it waits out the jitter stagger). The 5s warning fires on benign jitter
  and is blind to the real ~700ms sub-second stalls. Server log confirms: 1,704
  "slow tick" warnings, 9,327 of 9,533 ticks in the 4–6s bucket — almost all
  jitter, not work.

So the true defect is a **sub-5s, unattributed, main-thread stall on the poll
path** that no existing metric records and no existing optimization targets.

## What Changes

Measure-first. We do not yet have byte-level attribution of which synchronous
segment (`tickFolderHeads` git reads vs. broadcast fan-out vs. gate `stat`s vs.
V8 GC) produces the ~700ms burst, so the change is two-phase within one proposal:

**Phase 1 — Attribute (observability):**

- Retain sub-threshold event-loop spikes: a rolling in-memory ring buffer of the
  worst event-loop-delay samples (including sub-5s ones), surfaced on
  `/api/health`, so a ~700ms stall is recorded even when nobody is polling at the
  instant it happens. Extends the existing `server-session-hydration` eventLoop
  measurement — no new subsystem.
- Segment-time the periodic tick's **main-thread** work: wrap `tickFolderHeads`,
  the broadcast, and the gate `stat` stamping in cheap `performance.now()` marks,
  attribute each tick's synchronous cost to a named segment, and record the worst
  offenders. This turns "something blocks 700ms" into "`tickFolderHeads` blocked
  680ms across 14 folders."
- Fix the misleading alarm: make the slow-tick warning fire on **synchronous
  main-thread time**, not wall `durationMs` (which is dominated by jitter). Lower
  the effective threshold so sub-second stalls surface.

**Phase 2 — Eliminate (fix the attributed segment):**

- Move the identified per-tick synchronous work off the main loop or yield it:
  the leading candidate is `tickFolderHeads()` (ungated git HEAD reads every
  tick across all pinned + session dirs). Options captured in `design.md`:
  async/batched git reads, mtime-gating the folder-head poll like openspec, or
  chunking with `setImmediate` between folders.
- Bound the broadcast fan-out so a 14-dir tick cannot serialize+send in one
  uninterrupted synchronous burst.

Out of scope: client-side rendering, session-hydration internals (already
covered), and re-litigating the shipped mtime-gate / jitter / worker design.

## Impact

- Affected specs: `server-session-hydration` (ADDED: sub-threshold stall
  retention + segment attribution), `server-openspec-polling` (ADDED: ungated
  per-tick main-thread work must not block the event loop; slow-tick alarm keys
  on synchronous time).
- Affected code: `packages/server/src/directory-service.ts` (tick segment
  timing, `tickFolderHeads` offload, slow-tick threshold), `packages/server/src/
  server.ts` + `packages/server/src/routes/system-routes.ts` (spike retention on
  `/api/health`), `packages/server/src/hydration-metrics.ts` (or a sibling
  ring-buffer for event-loop spikes).
- No protocol break; `/api/health` additions are additive.
