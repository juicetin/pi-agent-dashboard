## 1. Entry ID Propagation

- [x] 1.1 Add `entryId` to `message_start` and `message_end` event data in `src/shared/state-replay.ts` (pass `entry.id` through `makeEvent`)
- [x] 1.2 Add optional `entryId?: string` to `ChatMessage` interface in `src/client/lib/event-reducer.ts`
- [x] 1.3 Populate `entryId` from `data.entryId` in the event reducer for `message_start` (user) and `message_end` (assistant) cases
- [x] 1.4 Write tests for `replayEntriesAsEvents` verifying `entryId` is present in generated events
- [x] 1.5 Write tests for event reducer verifying `entryId` propagates to ChatMessage
- [x] 1.6 Enrich live `message_start`/`message_end` events with `entryId` via `ctx.sessionManager.getLeafId()` in `src/extension/bridge.ts`

## 2. Protocol Extension

- [x] 2.1 Add optional `entryId?: string` to `ResumeSessionBrowserMessage` in `src/shared/browser-protocol.ts`

## 3. Server-Side Branched Fork

- [x] 3.1 Add `createBranchedSessionFile()` to `src/server/session-file-reader.ts` — standalone JSONL surgery to write pruned session file (root → target entry)
- [x] 3.2 In `handleResumeSession`, when `mode === "fork"` and `entryId` is present, use `createBranchedSessionFile` to create a pruned session file
- [x] 3.3 Pass the pruned session file path to `spawnPiSession` instead of the original
- [x] 3.4 Handle errors (invalid entryId, file not found) and return `resume_result` with `success: false`
- [x] 3.5 Write tests for `createBranchedSessionFile` (5 test cases)

## 4. Client UI

- [x] 4.1 Extend `handleResumeSession` in `src/client/hooks/useSessionActions.ts` to accept optional `entryId` parameter and include it in the WebSocket message
- [x] 4.2 Add fork button (git-branch icon) in `MessageBubble` toolbar alongside copy buttons in `src/client/components/ChatView.tsx`, hidden when `entryId` is undefined
- [x] 4.3 Wire fork button click to call `handleResumeSession(sessionId, "fork", entryId)` via `src/client/App.tsx`
- [x] 4.4 Fork button only renders for messages with `entryId` and roles `user`/`assistant` — other roles have no entryId and no fork button

## 5. Fork State Fixes

- [x] 5.1 Skip OpenSpec activity detection during replay in `src/server/event-wiring.ts`
- [x] 5.2 Clear `openspecPhase` and `openspecChange` on `replay_complete` in `src/server/event-wiring.ts`
- [x] 5.3 Fix fork donor logic to use actual parent session from `pendingForkRegistry` instead of any ended session
- [x] 5.4 Forked sessions prepend to top of session list (remove `afterSessionId` from `sessionOrderManager.insert`)
