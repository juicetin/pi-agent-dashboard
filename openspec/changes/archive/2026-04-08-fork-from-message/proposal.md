# Fork from Message

## Problem

Currently the dashboard only supports forking an entire session (from the latest entry). Pi's TUI has a tree selector that lets you pick any message to fork from. The dashboard lacks this — there's no way to fork from a specific point in the conversation.

## Solution

Add a "Fork from here" button on user and assistant messages in ChatView, placed alongside the existing copy buttons in the message toolbar. When clicked, the server creates a pruned session file (root → target entry) via standalone JSONL surgery, then spawns `pi --fork` on that pruned file.

## Scope

- Propagate `entryId` from session entries through events to client chat messages (both replayed and live)
- Extend the `resume_session` protocol message with an optional `entryId`
- Server-side: when `entryId` is present, create a branched session file before forking
- Client-side: render a fork button in the message toolbar on user/assistant messages
- Fix OpenSpec state leaking into forked sessions (stale phase/change from replayed events)
- Fix fork donor logic to use actual parent session instead of any ended session
- Forked sessions appear at top of session list (consistent with new session behavior)

## Out of Scope

- Full tree picker UI (pi's TUI-style tree selector)
- Branch visualization (showing which sessions are forks of which)
- Forking from tool calls or model changes

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/shared/state-replay.ts` | Attach `entryId` to `message_start` and `message_end` events |
| 2 | `src/client/lib/event-reducer.ts` | Add `entryId?: string` to `ChatMessage`, populate from event data |
| 3 | `src/shared/browser-protocol.ts` | Add optional `entryId` to `ResumeSessionBrowserMessage` |
| 4 | `src/server/session-file-reader.ts` | New `createBranchedSessionFile()` — standalone JSONL surgery to write pruned session file (root → target entry) |
| 5 | `src/server/browser-handlers/session-action-handler.ts` | If `entryId` present → `createBranchedSessionFile()` → fork from pruned file |
| 6 | `src/client/hooks/useSessionActions.ts` | Extend `handleResumeSession` to accept optional `entryId` |
| 7 | `src/client/components/ChatView.tsx` | Fork button in `MessageBubble` toolbar (alongside copy buttons), passed via `onForkFromMessage` prop |
| 8 | `src/client/App.tsx` | Wire `onForkFromMessage` callback to ChatView |
| 9 | `src/extension/bridge.ts` | Enrich live `message_start`/`message_end` events with `entryId` from `ctx.sessionManager.getLeafId()` |
| 10 | `src/server/event-wiring.ts` | Skip OpenSpec activity detection during replay; clear stale phase/change on `replay_complete`; fix donor logic to use actual fork parent; forked sessions prepend to top of list |

## Design Decisions

- **JSONL surgery instead of SessionManager SDK**: `pi-coding-agent` is an optional peer dependency not installed in `node_modules`. Used standalone `createBranchedSessionFile()` that reads/writes JSONL directly.
- **Fork button in message toolbar**: Placed alongside copy buttons for discoverability and consistency, rather than as an external hover button.
- **Live entryId via getLeafId()**: The bridge enriches live `message_start`/`message_end` events with the current leaf entry ID so fork buttons appear on all messages, not just replayed ones.

## Risks

- Entry ID stability across replays — IDs are UUIDs set at creation time, should be stable
- `createBranchedSessionFile` duplicates some tree-walking logic from pi's `SessionManager` — could diverge if session format changes
