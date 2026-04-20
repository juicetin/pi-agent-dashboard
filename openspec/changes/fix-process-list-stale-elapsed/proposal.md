## Why

The session card's process list shows a frozen `elapsedMs` value — typically ~30–40 s — for child processes that have actually been running for many minutes (observed: a 14 min `npm test` displayed as `36 s` in the dashboard). This makes the "process stuck?" triage signal (a long-running elapsed duration) completely unreliable, which is exactly when users look at the card.

Root cause: the bridge emits `process_list` only when the **set of PIDs changes**, so the `elapsedMs` snapshot captured at the moment a PID first entered the list is never refreshed. Once the PID set stabilizes, the client keeps rendering the original value forever.

## What Changes

- **Bridge:** include a stable `startedAt` epoch-ms timestamp on each entry in the `process_list` message, computed as `Date.now() - elapsedMs` at scan time. `elapsedMs` is retained for one release as a fallback.
- **Protocol (extension → server → browser):** add `startedAt: number` to `process_list.processes[]` and `Session.processes[]`. Field is optional on the wire so older extensions remain compatible.
- **Client:** `ProcessList` prefers `startedAt` and renders a live-ticking elapsed via the existing `ElapsedBadge` component. Falls back to the frozen `elapsedMs` when `startedAt` is absent (older bridges).
- **Server passthrough:** verify the `process_list` forwarder and `Session.processes` persistence propagate the new field unchanged.

No behavior change when `startedAt` is missing → safe to roll out piecewise (extension/server/client can upgrade in any order).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `session-process-tracking`: the "Bridge polls process scanner and sends updates on change" requirement is amended to also require a stable `startedAt` timestamp per entry; the "Session card shows active child processes" requirement is amended to require a live-ticking elapsed display derived from `startedAt`.

## Impact

- **Code (small surface):**
  - `packages/extension/src/bridge.ts` — compute and include `startedAt` when building the `process_list` payload.
  - `packages/shared/src/protocol.ts`, `browser-protocol.ts`, `types.ts` — add optional `startedAt: number`.
  - `packages/server/` — passthrough (no logic change expected; verify).
  - `packages/client/src/components/ProcessList.tsx` — prefer `startedAt`, render via `ElapsedBadge` in ticking mode.
- **Tests:** new unit tests for bridge emit and `ProcessList` ticking behavior.
- **APIs:** `/api/sessions` response gains an optional `processes[].startedAt` field; no breaking change.
- **Persistence/migration:** none — process list is in-memory only.
- **Rollback:** revert the diff; no data to migrate.
- **Compatibility matrix:**
  - old extension + new server/client → `startedAt` undefined → falls back to stale `elapsedMs` (current behavior).
  - new extension + old client → ignores `startedAt`, shows stale `elapsedMs` (current behavior).
  - all new → correct live elapsed.
