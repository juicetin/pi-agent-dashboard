# Error Handling Improvements

## Problem

The dashboard has no concept of error states in the session lifecycle. When LLM providers return errors (quota exceeded, rate limited, overloaded, auth failures, network errors), users see no feedback. Three specific gaps:

1. **LLM errors are invisible** — pi-agent-core sets `stopReason: "error"` and `errorMessage` on the final assistant message in `agent_end`, and the bridge forwards this data, but neither the server nor the client extract or display it. The session silently returns to "idle".

2. **Pending prompt spinner gets stuck** — When a user sends a prompt via the dashboard, a `pendingPrompt` spinner is shown. It's cleared by `agent_start` → `message_start(user)`. If pi errors before emitting these events (auth failure, model not found, provider unreachable), the spinner stays forever. There is no timeout or error-clearing fallback.

3. **Spawn/resume failures are transient** — Session creation failures show as a brief toast notification with no persistent error state on the session card or workspace.

## Root Cause

The dashboard models session lifecycle as: `idle → streaming → idle → ended`. There is no error state anywhere in the pipeline — not in `event-status-extraction.ts`, not in the client's `event-reducer.ts`, not in the UI components.

The data to detect errors already exists. The `agent_end` event carries the full messages array from pi-agent-core, which includes `stopReason: "error"` and `errorMessage` on the final AssistantMessage. The bridge's `mapEventToProtocol` serializes everything, so `event.data.messages` arrives at the server and client intact — nobody reads it.

## Data Flow (Current)

```
Provider error (429/529/network)
  → pi-agent-core: stopReason="error", errorMessage="..."
    → agent_end event (messages array has error info)
      → bridge: mapEventToProtocol (forwards all data)
        → server event-status-extraction: agent_end → { status: "idle" }  ❌ ignores error
          → client event-reducer: agent_end → isStreaming=false, status="idle"  ❌ ignores error
            → UI: session appears idle, no error shown  ❌
```

## Proposed Solution

### 1. Extract error info from `agent_end` events

**Server** (`event-status-extraction.ts`): When processing `agent_end`, inspect the messages array for the final assistant message. If `stopReason === "error"`, extract `errorMessage` and include it in session updates. Add a transient `lastError` field to `DashboardSession`.

**Client** (`event-reducer.ts`): When processing `agent_end`, inspect `event.data.messages` for error info. Add `lastError?: { message: string; timestamp: number }` to `SessionState`. Clear it on next `agent_start`.

**UI**: Show an inline error banner in ChatView when `lastError` is present. Show a red dot on the session card. Auto-dismiss when the next turn starts.

### 2. Add pendingPrompt timeout and error clearing

**Client**: Add a safety timeout (e.g. 30s) for `pendingPrompt`. If no `agent_start` or `message_start(user)` arrives within the timeout, clear the spinner and show an error: "No response from session — the prompt may not have been received."

Also clear `pendingPrompt` on `agent_end` (it already clears on `agent_start`, but if `agent_end` arrives without a preceding `agent_start` for our prompt, the spinner should still clear).

### 3. Persistent spawn/resume error state

**Client**: When `spawn_result` or `resume_result` arrives with `success: false`, show the error as a persistent banner in the workspace (not just a toast). Dismiss on user action or next successful spawn.

## Scope

- **In scope**: Error detection, display, and clearing for LLM provider errors; pendingPrompt stuck states; spawn failure visibility
- **Out of scope**: Retry logic, automatic recovery, error classification/categorization, provider-specific error handling

## Affected Files

| Layer | File | Change |
|-------|------|--------|
| Shared | `packages/shared/src/types.ts` | Add `lastError` to `DashboardSession` |
| Server | `packages/server/src/event-status-extraction.ts` | Extract error from `agent_end` messages |
| Server | `packages/server/src/event-wiring.ts` | Forward error info in session updates |
| Client | `packages/client/src/lib/event-reducer.ts` | Add `lastError` to `SessionState`, extract from `agent_end` |
| Client | `packages/client/src/components/ChatView.tsx` | Error banner display |
| Client | `packages/client/src/components/SessionSidebar.tsx` | Error indicator on session card |
| Client | `packages/client/src/hooks/useSessionActions.ts` | pendingPrompt timeout logic |
| Client | `packages/client/src/components/SessionList.tsx` | Persistent spawn error state |

## Complexity

Low-medium. The error data already flows through the system — we just need to read it and display it. No protocol changes needed. No new WebSocket message types. The main subtlety is correctly identifying the error info inside the `agent_end` event's messages array (it's nested: `data.messages[last].stopReason`).
