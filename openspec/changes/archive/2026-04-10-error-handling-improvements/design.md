## Context

The dashboard currently models sessions with four statuses: `active | idle | streaming | ended`. There is no error state. When an LLM provider returns an error (quota, rate limit, overloaded, auth failure), pi-agent-core emits `agent_end` with the error encoded in the messages array (`stopReason: "error"`, `errorMessage: "..."`). The bridge serializes and forwards this, but neither the server nor client reads the error fields.

Three user-visible symptoms:
1. Session silently returns to "idle" after an LLM error — no feedback
2. `pendingPrompt` spinner stays forever if pi errors before `agent_start`/`message_start`
3. Spawn failures shown only as transient toasts

The error data already flows end-to-end. This change reads it and surfaces it.

## Goals / Non-Goals

**Goals:**
- Extract error info from `agent_end` events and surface it in the UI
- Clear stuck `pendingPrompt` spinners via `agent_end` clearing and a safety timeout
- Show persistent spawn/resume error feedback (not just toasts)

**Non-Goals:**
- Retry logic or automatic recovery from errors
- Error classification (e.g. distinguishing quota from rate limit from network)
- Provider-specific error handling or messaging
- Changes to the WebSocket protocol (no new message types)
- Changes to the bridge extension

## Decisions

### 1. Error extraction from `agent_end` — client-side only

**Decision**: Extract error info in the client event-reducer, not the server.

**Rationale**: The `agent_end` event's `data.messages` array contains full AssistantMessage objects from pi-agent-core. The last message may have `stopReason: "error"` and `errorMessage`. This data is already forwarded as-is by the bridge and server. Extracting on the client side means:
- No server changes for error detection (simpler)
- No new fields on `DashboardSession` or `session_updated` protocol
- The server doesn't need to understand pi-agent-core message internals

**Alternative considered**: Server-side extraction in `event-status-extraction.ts` with a `lastError` field on `DashboardSession`. Rejected because it adds coupling between the server and pi-agent-core's message schema, and would require broadcasting error state changes. The client already processes every event, so it can extract locally.

### 2. `lastError` field on `SessionState` (client only)

**Decision**: Add `lastError?: { message: string; timestamp: number }` to `SessionState`. Set on `agent_end` when error detected. Clear on next `agent_start`.

**Shape**:
```typescript
// In SessionState
lastError?: {
  message: string;    // Human-readable error message from provider
  timestamp: number;  // When the error occurred
};
```

**Lifecycle**:
- Set: `agent_end` handler detects `stopReason === "error"` in last message
- Clear: `agent_start` handler (new turn started, error is stale)
- Clear: user dismisses the banner manually

### 3. `pendingPrompt` clearing strategy

**Decision**: Two-pronged approach:
1. **Immediate**: Clear `pendingPrompt` in `agent_end` handler (currently only cleared by `agent_start` and `message_start`)
2. **Timeout**: 30-second safety timeout in `useSessionActions` — if `pendingPrompt` is set and no clearing event arrives, auto-clear and set `lastError`

**Rationale**: The immediate fix covers the common case (pi starts, errors, emits `agent_end`). The timeout covers the edge case where pi never even emits `agent_start` (e.g. the bridge connection dropped, or pi crashed before the agent loop started).

**Alternative considered**: Bridge-side "prompt_received" acknowledgment. Rejected — adds protocol complexity and the timeout achieves the same safety net.

### 4. Error banner in ChatView

**Decision**: Render error as an inline red banner at the bottom of the chat (above the input), not as a toast or modal.

**Rationale**: 
- Inline positioning is contextual — the error relates to this session's last action
- Persistent until dismissed or next turn — user can't miss it
- Matches existing patterns (pendingPrompt card, streaming text area)

**Structure**:
```
┌──────────────────────────────────────────────┐
│  ⚠ Error: Rate limit exceeded. Please wait   │
│  and try again.                         [✕]  │
└──────────────────────────────────────────────┘
```

### 5. Session card error indicator

**Decision**: Show a red status dot (replacing green) when `lastError` is present in the session's state.

**Rationale**: The sidebar already uses colored dots for status (`green` = idle, `yellow pulse` = streaming, `gray` = ended). Adding red for error is consistent and minimal.

**Implementation**: The session card doesn't currently have access to `SessionState` (it uses `DashboardSession`). Rather than pass the full state, pass a derived `hasError: boolean` prop.

### 6. Spawn/resume error persistence

**Decision**: Store spawn/resume errors in component state as a per-workspace error map, not in the global session state. Show as a dismissible banner in the workspace header area.

**Rationale**: Spawn errors aren't session-scoped (the session may not exist yet). They're workspace-scoped. A simple `Map<cwd, string>` in the SessionList component is sufficient.

## Risks / Trade-offs

**[Risk] `agent_end` message format changes** → The extraction relies on `data.messages[last].stopReason`. If pi-agent-core changes this schema, extraction silently fails (no error shown). Mitigation: defensive extraction with optional chaining; the fallback is the current behavior (no error shown).

**[Risk] False positives from `stopReason: "error"`** → Some provider errors may be retried internally by pi before reaching `agent_end`. We might show errors for transient issues that pi recovered from. Mitigation: `agent_end` with `stopReason: "error"` is terminal — pi only emits it when the run is actually over due to error.

**[Risk] 30s timeout too aggressive or too lenient** → Too short: slow networks or large context could take >30s before first event. Too long: user waits unnecessarily. Mitigation: 30s is conservative (normal prompt→agent_start is <2s). Can be adjusted later.

**[Trade-off] Client-only error state** → Error state is not persisted or shared across browser tabs. If user opens a new tab, they won't see the error from the previous tab. Acceptable because errors are transient — the session is idle and ready for a new prompt.
