# Tasks — session-card-last-activity-badge

## 1. Shared types
- [ ] 1.1 Add `lastActivityAt?: number` to `DashboardSession` in `packages/shared/src/types.ts` with JSDoc explaining semantics ("epoch ms; updated server-side on activity events; not persisted to .meta.json").

## 2. Activity-event classifier
- [ ] 2.1 Add pure helper `isActivityEvent(eventType: string): boolean` in `packages/server/src/event-status-extraction.ts` (or a new sibling file if it grows). Allowlist per design.md.
- [ ] 2.2 Add unit test `packages/server/src/__tests__/is-activity-event.test.ts` — one assertion per allowlisted type (true), one per excluded type (false), one for an unknown type (false).

## 3. Server stamping + debounced broadcast
- [ ] 3.1 In `packages/server/src/event-wiring.ts`, add module-scope `const lastBroadcastAt = new Map<string, number>()`.
- [ ] 3.2 In the `event_forward` branch (around line 112), before the existing extraction block, call `isActivityEvent(eventType)`; if true, `sessionManager.update(sessionId, { lastActivityAt: now })` unconditionally.
- [ ] 3.3 Broadcast `session_updated` only when `now - lastBroadcastAt.get(sessionId) >= 30_000`; update the map.
- [ ] 3.4 On `session_unregister` (locate existing handler), `lastBroadcastAt.delete(sessionId)`.
- [ ] 3.5 Add test `packages/server/src/__tests__/last-activity-broadcast.test.ts` with fake timers asserting:
  - first activity event → immediate broadcast
  - subsequent event 5s later → in-memory updated, no broadcast
  - subsequent event 31s later → broadcast
  - excluded event → no in-memory update, no broadcast
  - `session_unregister` → map entry removed

## 4. Cold-start seeding
- [ ] 4.1 In `packages/server/src/session-scanner.ts`, after computing the events.jsonl path for each discovered session, `fs.stat` it and set `lastActivityAt = stat.mtimeMs`. Wrap in try/catch — log but don't fail the scan on error.
- [ ] 4.2 Add test asserting that a session seeded by the scanner with a known events.jsonl mtime carries that mtime as `lastActivityAt`.

## 5. Client render
- [ ] 5.1 Add `selectBadgeTimestamp(session)` pure helper colocated with `SessionCard.tsx` (or in `packages/client/src/lib/session-card-time.ts` if a new file is cleaner).
- [ ] 5.2 Replace `now - session.startedAt` at `SessionCard.tsx:358` and `SessionCard.tsx:485` with `now - selectBadgeTimestamp(session)`.
- [ ] 5.3 Add `title={`Started ${new Date(session.startedAt).toLocaleString()}`}` on the badge `<span>` at both sites.
- [ ] 5.4 Unit-test `selectBadgeTimestamp` exhaustively:
  - ended + endedAt set → endedAt
  - ended + endedAt missing → lastActivityAt
  - ended + endedAt missing + lastActivityAt missing → startedAt
  - active + lastActivityAt set → lastActivityAt
  - active + lastActivityAt missing → startedAt

## 6. Documentation
- [ ] 6.1 Update `AGENTS.md` "Key Files" entries for `packages/shared/src/types.ts` and `packages/server/src/event-wiring.ts` to mention the new field and stamping site, citing change `session-card-last-activity-badge`.
- [ ] 6.2 Update `docs/architecture.md` (data model section) to document `lastActivityAt`.

## 7. Manual QA
- [ ] 7.1 Spawn a fresh session; confirm badge ticks like "5s", "1m", "2m" instead of staying at spawn-time.
- [ ] 7.2 Wait 5 minutes idle; confirm badge advances ("5m"). Send a prompt; confirm badge resets to "0s"/"5s".
- [ ] 7.3 Restart the server; confirm idle sessions still show the correct relative time (cold-start seed works).
- [ ] 7.4 End a session; confirm badge shows time-since-end and tooltip still shows original spawn time.
- [ ] 7.5 Hover a card on desktop; confirm `title` tooltip shows "Started <date>".
