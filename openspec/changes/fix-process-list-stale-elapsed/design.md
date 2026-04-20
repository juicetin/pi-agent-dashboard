## Context

The bridge's process-scan timer runs every 10 s and, by design, only emits a `process_list` WebSocket frame when the sorted set of PIDs changes (see `packages/extension/src/bridge.ts:1048–1060`). The `elapsedMs` on each entry is captured from `ps -o etime=` at emit time and shipped as a plain number.

Because emissions stop once the PID set stabilizes, every downstream consumer (server in-memory session record, browser `Session.processes`, `ProcessList` component) holds a value that is at best a few seconds after the first time the scanner noticed the process (which itself is ≥30 s after birth due to `DEFAULT_MIN_ELAPSED_MS = 30_000`). For a long-running `npm test`, users see `36 s` forever.

## Goals

- Show **correct, live-updating** elapsed time for each child process with no increase in WebSocket traffic.
- Keep the protocol additive — no coordinated upgrade required.
- Zero new timers on the server; no new polling from the client.

## Non-Goals

- Refactoring the "emit-on-change" scan strategy itself. It's a valid bandwidth-saving design; the bug is purely that we shipped a *derived* value (elapsed) instead of a *stable* one (start time).
- Adding sub-process metrics (CPU/mem) to the list. Out of scope.
- Changing `minElapsedMs` filter semantics.

## Decisions

### Decision 1 — Send `startedAt` instead of (eventually: in addition to) `elapsedMs`

**Choice:** extension computes `startedAt = Date.now() - elapsedMs` once per scan emit and includes it on each `process_list` entry. Keep `elapsedMs` on the wire for one release for backward compatibility.

**Alternatives considered:**
- *Periodic re-emit of `process_list`:* works, but costs an extra frame per session every N seconds, and between ticks the UI still drifts. Strictly worse than a stable timestamp.
- *Server computes elapsed from first-seen time:* unreliable. The server doesn't know when the bridge actually observed birth vs. when it first emitted (the 30 s filter creates a systematic skew). Only the bridge has `ps etime`.
- *Compute elapsed on the client from `lastEmittedAt + elapsedMs`:* complex, still drifts if frames are delayed.

`startedAt` is the **simplest** correct primitive: a single monotonic field that the client can subtract from `Date.now()` on every render tick.

### Decision 2 — Additive, optional field

**Choice:** `startedAt?: number` on every protocol type; client prefers it when present, falls back to `elapsedMs`.

**Rationale:** users run mixed versions during phased rollout (bridge extension reloads one session at a time; client refresh is manual). Making the field required would require a coordinated redeploy and break old sessions mid-flight.

### Decision 3 — Reuse `ElapsedBadge` in live/ticking mode

**Choice:** `ProcessList` passes `startedAt` to the existing `ElapsedBadge` component (already used elsewhere in the dashboard), which handles the render-loop ticking and human-readable formatting.

**Rationale:** DRY. No new duration-formatting code, no new `setInterval` inside `ProcessList`.

## Risks / Trade-offs

- **Clock skew between extension host and client:** negligible in practice (both usually the same machine; even on remote hosts, drift is typically <1 s). Worst case the elapsed is a second or two off, which is massively better than being 15 minutes off.
- **Process PID reuse:** if a PID is reused between scans and the scanner associates a new `startedAt` to the old PID, the elapsed resets correctly (new emit, new `startedAt`). Not a regression.
- **`elapsedMs` retention for one release:** small dead-code cost. Acceptable for rollout safety.

## Migration Plan

None — process list is in-memory only. No sessions.json, no SQLite, no sidecar files carry this data. On restart/reconnect, the bridge rescans and re-emits.

Deployment order can be any of: extension first, client first, or server first (passthrough is invariant). Mixed-version behavior is defined above.

## Open Questions

None. The fix is mechanical.
