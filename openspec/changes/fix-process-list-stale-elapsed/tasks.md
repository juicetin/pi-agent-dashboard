## 1. Protocol types (additive)

- [ ] 1.1 Add optional `startedAt?: number` to the `process_list` message type in `packages/shared/src/protocol.ts` (extension → server).
- [ ] 1.2 Add optional `startedAt?: number` to the `process_list` message type in `packages/shared/src/browser-protocol.ts` (server → browser).
- [ ] 1.3 Add optional `startedAt?: number` to `Session.processes[]` in `packages/shared/src/types.ts`.
- [ ] 1.4 Run `npm run check` (or equivalent type-check script) and confirm no type regressions.

## 2. Bridge emit

- [ ] 2.1 Write a failing unit test in `packages/extension/src/__tests__/` that drives the scan-and-emit code path with a synthetic `scanChildProcesses` result and asserts the sent `process_list` payload contains `startedAt` ≈ `Date.now() - elapsedMs` (±5 ms).
- [ ] 2.2 In `packages/extension/src/bridge.ts`, include `startedAt: Date.now() - p.elapsedMs` in the emitted payload (preserve existing `elapsedMs`).
- [ ] 2.3 Confirm the test from 2.1 passes.

## 3. Server passthrough

- [ ] 3.1 Trace `process_list` flow from pi-gateway through event-wiring into `Session.processes` and the browser-gateway broadcast; confirm no field stripping/whitelisting drops `startedAt`.
- [ ] 3.2 Add a focused server test (or extend an existing one) that feeds a `process_list` with `startedAt` and asserts the stored `Session.processes` retains it and the outbound browser message retains it.

## 4. Client rendering

- [ ] 4.1 Write a failing unit/DOM test for `packages/client/src/components/ProcessList.tsx` that renders an entry with `startedAt: Date.now() - 14 * 60_000` and asserts the displayed elapsed text reads "14 min" (or equivalent), then advances mock time by 60 s and asserts it reads "15 min".
- [ ] 4.2 Write a second test confirming that when `startedAt` is absent and `elapsedMs: 36_000` is supplied, the displayed elapsed reads "36s" and does NOT advance when mock time advances (fallback path).
- [ ] 4.3 Update `ProcessList.tsx` to prefer `startedAt` via `ElapsedBadge` in live/ticking mode; fall back to static `elapsedMs` when `startedAt` is `undefined`.
- [ ] 4.4 Confirm both tests from 4.1 and 4.2 pass.

## 5. Manual verification

- [ ] 5.1 `npm run build` and restart the dashboard server.
- [ ] 5.2 Reload at least one live pi session (`npm run reload` on a single session is fine).
- [ ] 5.3 Start a long-running command in that session (e.g. `sleep 600`), wait 2 min, confirm the session card shows a monotonically increasing elapsed value (not frozen at ~30 s).
- [ ] 5.4 On another (un-reloaded) session, confirm the old behavior still renders without errors (mixed-version compatibility).

## 6. Docs & archival

- [ ] 6.1 Update `AGENTS.md` and/or `docs/architecture.md` ProcessList entry if it describes the frozen-elapsed behavior.
- [ ] 6.2 Add a bullet to `CHANGELOG.md` under `## [Unreleased]` (Fixed): "Session card process list now shows live-ticking elapsed time instead of a frozen value".
- [ ] 6.3 After merge, archive the change via `openspec archive fix-process-list-stale-elapsed`.
