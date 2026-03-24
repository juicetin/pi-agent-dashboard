## Context

The `WorkingIndicator` component only renders during streaming (returns null when idle). The input area has a text "Send" button with no abort capability. The extension context exposes `ctx.modelRegistry.getAvailable()` which returns `[{ provider, id }]` synchronously. The dashboard already has `send_prompt` and `abort` message infrastructure.

## Goals / Non-Goals

**Goals:**
- Always-visible status bar with model selector + working status
- Filterable model autocomplete dropdown
- Model switch via `/model provider/id` send_prompt
- Play (▶) icon replaces text Send button
- Red Stop (■) button visible during streaming, sends abort
- Models list from extension via new protocol message

**Non-Goals:**
- Thinking level selector (future work)
- Custom model registration from dashboard
- Model favorites or recent models

## Decisions

### 1. StatusBar replaces WorkingIndicator

**Decision:** New `StatusBar` component is always visible. Left: model selector. Right: working indicator (only during streaming). Replaces `WorkingIndicator` in App.tsx.

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ [anthropic/claude-4 ▾]          ⟳ Running bash… │
└─────────────────────────────────────────────────┘
```

When idle, right side is empty.

### 2. ModelSelector as autocomplete dropdown

**Decision:** Clickable model name with chevron. Click opens a dropdown with text filter input and scrollable model list. Each model shown as `provider/id`. Filter matches both provider and id. Selecting sends `/model provider/id` via `onSendPrompt` callback.

**Why not a select element:** Need custom styling, filter-as-you-type, and consistent look with the existing command autocomplete pattern.

### 3. Models list via protocol messages

**New Extension → Server message:**
```typescript
interface ModelsListMessage {
  type: "models_list";
  sessionId: string;
  models: Array<{ provider: string; id: string }>;
}
```

**New Server → Browser message:** Same shape, forwarded.

**New Browser → Server message:**
```typescript
interface RequestModelsMessage {
  type: "request_models";
  sessionId: string;
}
```

**Extension sends models on session_start** (from `ctx.modelRegistry.getAvailable()`). Browser can request refresh via `request_models`.

### 4. Play/Stop button design

**Decision:**
- Send button: Replace "Send" text with Play icon (▶ / `mdiPlay`). Blue, same position.
- Stop button: Red square icon (■ / `mdiStop`). Appears at the right end of input area only during streaming. Sends `abort` message.

**Layout:**
```
Idle:
┌──────────────────────────────────────────┬──┐
│ [message input...]                       │▶ │
└──────────────────────────────────────────┴──┘

Streaming:
┌──────────────────────────────────────┬──┬──┐
│ [message input...]                   │▶ │■ │
└──────────────────────────────────────┴──┴──┘
```

### 5. Extension reads modelRegistry from event context

**Decision:** On `session_start`, the extension accesses `ctx.modelRegistry.getAvailable()` and sends the list. On `request_models`, the command handler does the same.

**Why session_start:** Models are typically static during a session. One-time send is sufficient. `request_models` exists for edge cases (e.g., user adds API key mid-session).

## Risks / Trade-offs

- **[modelRegistry not on ExtensionAPI]** → It's on the event context (`ctx`), not the top-level `pi` API. We need to capture it from the `session_start` handler and store it for later use by command handler.
- **[Model switch feedback]** → After sending `/model`, the agent processes it and fires `model_select` event. There's a brief delay. The model selector shows the old model until the event arrives. Acceptable — same behavior as the TUI.
- **[Stop button UX]** → Abort is not instant — the agent finishes the current tool execution. The stop button should disable briefly after click to prevent double-abort.
