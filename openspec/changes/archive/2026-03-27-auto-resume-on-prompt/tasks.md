## 1. Shared Types & Protocol

- [x] 1.1 Add `resuming?: boolean` to `DashboardSession` in `src/shared/types.ts`
- [x] 1.2 ~~Add `AutoResumeNavigateMessage`~~ — Removed: `pi --session` reuses the same session ID, so no navigation message is needed

## 2. Pending Resume Registry

- [x] 2.1 Create `src/server/pending-resume-registry.ts` with `PendingResumeRegistry` interface and factory function (Map<cwd, PendingResume>, 30s expiry, record/consume/dispose methods) — follow `PendingForkRegistry` pattern
- [x] 2.2 Write tests for `PendingResumeRegistry`: record, consume, expiry timeout, overwrite on same cwd, dispose

## 3. Server-Side Auto-Resume Logic

- [x] 3.1 Instantiate `PendingResumeRegistry` in `browser-gateway.ts` (or accept as dependency)
- [x] 3.2 In `send_prompt` handler: detect ended session, validate sessionFile exists, record pending resume, set `resuming: true` on session, broadcast `session_updated`, spawn pi with continue mode. On spawn failure: clear pending resume and reset `resuming` flag.
- [x] 3.3 In `server.ts` `session_register` handler: after existing logic, check `pendingResumeRegistry.consume(cwd)`. If entry exists: send queued prompt to resumed session and clear `resuming` flag. No hide/navigate needed (same session ID).
- [x] 3.4 Add `onTimeout` callback to `PendingResumeRegistry` entries — on expiry, clear `resuming` flag on old session and broadcast `session_updated`

## 4. Client-Side Navigation

- [x] 4.1 ~~Handle `auto_resume_navigate`~~ — Removed: same session ID, no navigation needed. Instead: optimistic `resuming: true` on Resume/Fork click, clear on failure or `session_added`
- [x] 4.2 Ensure auto-subscribe fires for the resumed session (existing `session_added` handler already subscribes active sessions)
- [x] 4.3 Resume/Fork buttons disabled during `session.resuming` with `disabled:opacity-50` styling

## 5. Session Card Visual Indicator

- [x] 5.1 In `SessionCard.tsx` `ActivityIndicator`: add check for `session.resuming` — return `<span className="text-yellow-400">Resuming…</span>` before the ended check
- [x] 5.2 In `SessionCard.tsx` status dot: when `session.resuming` is true, use pulsing yellow dot class (`bg-yellow-500 animate-pulse`) instead of ended grey

## 6. Testing

- [x] 6.1 Write integration test: `send_prompt` to ended session triggers resume flow (sets resuming, spawns, queues prompt)
- [x] 6.2 Write integration test: `session_register` with pending resume flushes prompt and clears resuming flag
- [x] 6.3 Write test: spawn failure clears resuming flag and pending entry
