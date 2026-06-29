## 1. Resolve open questions (design.md)

- [ ] 1.1 Decide persist-reduced-messages vs persist-raw-events; measure payload size + load-time re-reduce cost; record in design.md
- [ ] 1.2 Decide whether to persist the `pi-asset:<hash>` registry or accept placeholder-until-resubscribe; record in design.md
- [ ] 1.3 Confirm `entryId` availability on `tool_execution_end` (bridge live path + state-replay.ts); decide B sequencing (ship with A vs defer)
- [ ] 1.4 Pick the Strategy B stub threshold (e.g. ≥ 4 KB, aligned to truncation cap) + preview length

## 2. Replay-cache store (session-replay-persistence)

- [ ] 2.1 Write failing tests: `replay-cache.ts` get/put/evict round-trip, schemaVersion mismatch → miss, LRU eviction by last-access (fake IndexedDB)
- [ ] 2.2 Implement `packages/client/src/lib/replay-cache.ts` (IndexedDB, `{ schemaVersion, maxSeq, payload, lastAccess }` per session, size cap + LRU)
- [ ] 2.3 Make 2.1 pass

## 3. Rehydrate + delta subscribe on load (session-replay-persistence)

- [ ] 3.1 Write failing test: on mount with a cached session, `subscribe` is sent with `lastSeq = persistedMaxSeq` (not 0); state pre-seeded from cache
- [ ] 3.2 In `App.tsx`, rehydrate `sessionStates` + `maxSeqMapRef` from `replay-cache` before first subscribe; persist on reducer commit (debounced)
- [ ] 3.3 Render rehydrated state as provisional; reconcile against first `event_replay` batch (`firstSeq <= maxSeq` rule)
- [ ] 3.4 Make 3.1 pass

## 4. Invalidation (session-replay-persistence)

- [ ] 4.1 Write failing test: `session_state_reset` purges the session's cache entry and falls back to full replay
- [ ] 4.2 In `useMessageHandler.ts`, handle `session_state_reset` → `replay-cache.delete(sessionId)`; ensure a contradicting delta also purges
- [ ] 4.3 Make 4.1 pass

## 5. Stub emission in replay (lazy-expand-full-fidelity)

- [ ] 5.1 Write failing test: replayed `tool_execution_end` above threshold carries `{ stub:true, byteSize, preview, entryId }`; below threshold unchanged
- [ ] 5.2 Record pre-truncation `byteSize` in `memory-event-store.ts` (no change to truncation behavior)
- [ ] 5.3 Emit the stub shape during replay in `subscription-handler.ts` (additive; live streaming path unchanged)
- [ ] 5.4 Make 5.1 pass

## 6. Full-fidelity fetch route (lazy-expand-full-fidelity)

- [ ] 6.1 Write failing test: JSONL-backed route returns the untruncated tool body by `entryId`; 404 on unknown id
- [ ] 6.2 Add the route in `session-routes.ts` (reads JSONL, NOT the truncated memory store)
- [ ] 6.3 Make 6.1 pass

## 7. Lazy render on expand (lazy-expand-full-fidelity)

- [ ] 7.1 Write failing test: collapsed stub renders header + preview; expand fetches full body + renders; offline expand shows preview + error affordance
- [ ] 7.2 Wire stub render + on-expand fetch in the tool renderer(s), mirroring `AgentToolRenderer` lazy-expand precedent; show "Show full output (N KB)"
- [ ] 7.3 Make 7.1 pass

## 8. Verify

- [ ] 8.1 `npm test` green
- [ ] 8.2 `openspec validate reduce-session-replay-traffic` passes
- [ ] 8.3 Manual: reload an already-open session → DevTools shows a small delta replay, not full history; kill+restart server → `session_state_reset` → full replay, no stale stitching
- [ ] 8.4 Manual (B): a > 4 KB tool result renders collapsed with a preview; expand reveals the full untruncated body
