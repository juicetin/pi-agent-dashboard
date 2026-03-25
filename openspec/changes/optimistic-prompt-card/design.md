## Context

When a user sends a prompt via the dashboard, the message travels: Browser → Server WebSocket → Bridge → pi agent. The pi agent then emits a `message_start` event (role: "user") which flows back to the browser where `reduceEvent` adds the user card to `SessionState.messages`. On slow connections this round-trip creates a visible gap with no feedback.

The existing abort pipeline (`abort` message from browser → server → bridge → `cachedCtx.abort()`) already supports stopping the agent mid-processing.

## Goals / Non-Goals

**Goals:**
- Immediate visual feedback when user sends a prompt
- Prevent duplicate sends during the pending period
- Allow cancellation of a pending prompt via Stop button or Escape key
- Seamless replacement of the optimistic card when the server event arrives

**Non-Goals:**
- Timeout-based auto-cancel (keep it manual)
- Server or bridge protocol changes
- Offline/queue support for prompts

## Decisions

### 1. Single `pendingPrompt` field on SessionState

Add `pendingPrompt?: { text: string; images?: ChatImage[] }` to `SessionState`. This is set locally by `App.tsx` on send (not via the event reducer) and cleared by the reducer on `message_start` (role: "user") or `agent_start`.

**Why not a separate state store?** The pending prompt is tightly coupled to session state and the event stream. Keeping it in `SessionState` means ChatView and CommandInput can read it from the same place they read everything else.

**Why not add a fake message to `messages[]`?** A separate field avoids contaminating the event-sourced message list with client-only state. Clean separation — `messages` stays server-authoritative.

### 2. Reuse existing abort for cancellation

Cancel sends the same `{ type: "abort" }` WebSocket message already used by the Stop button. No new protocol messages needed. If the agent hasn't started processing, abort is a harmless no-op. If it has, it kills the current turn.

**Alternative considered:** Client-only cancel (just remove the card, don't send abort). Rejected because the server may already be processing the prompt — we want to actually stop it.

### 3. Manage pendingPrompt outside the event reducer

`handleSend` in `App.tsx` sets `pendingPrompt` by updating session state directly (via `setSessionStates` or similar). The event reducer clears it when `message_start` arrives. This keeps the reducer pure (event-driven) while the optimistic state is set imperatively.

### 4. Stop button and Escape during pending state

CommandInput already shows Stop when `sessionStatus === "streaming"`. Extend this to also show when a `pendingPrompt` exists. Escape key in the input triggers cancel only during the pending state (not during streaming — that already has its own behavior).

## Risks / Trade-offs

- **Race condition: cancel arrives after agent starts** → Agent aborts mid-processing. Acceptable — same as clicking Stop during streaming today.
- **Race condition: `message_start` arrives right as user cancels** → Reducer clears `pendingPrompt`, cancel abort is sent to an idle agent. Harmless no-op.
- **`pendingPrompt` set outside reducer** → Breaks pure event-sourcing for this one field. Trade-off accepted for simplicity — alternative would require inventing a local event type.
