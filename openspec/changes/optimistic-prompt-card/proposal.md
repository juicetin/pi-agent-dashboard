## Why

When a user sends a prompt, there is no visual feedback until the server echoes back the `message_start` event. On slow connections or heavy workloads this creates a dead zone where the user sees nothing, the input stays enabled, and duplicate sends are possible. We need immediate feedback to close this gap.

## What Changes

- Show an **optimistic user message card** with an animated spinner immediately when the user sends a prompt, before the server responds.
- **Disable the input** while a prompt is pending, preventing duplicate sends.
- Show the **Stop button** during the pending state (reusing existing abort infrastructure).
- Allow **cancellation** via Stop button or Escape key — this sends an abort to the bridge, removes the optimistic card, and re-enables the input.
- When the server's `message_start` (role: "user") arrives, the optimistic card is replaced by the real server event card seamlessly.

## Capabilities

### New Capabilities
- `optimistic-prompt`: Optimistic prompt card rendering with pending state, spinner animation, cancellation, and server event reconciliation.

### Modified Capabilities
- `play-stop-controls`: Stop button and Escape key also active during new "pending" state (not just "streaming").
- `chat-view`: User message area renders optimistic pending card at the bottom when a prompt is awaiting server confirmation.

## Impact

- **event-reducer.ts**: New `pendingPrompt` field on `SessionState`; cleared on `message_start` or `agent_start`.
- **App.tsx**: `handleSend` sets `pendingPrompt`; new cancel handler clears it and sends abort.
- **ChatView.tsx**: Renders optimistic card with `animate-spin` icon when `pendingPrompt` exists.
- **CommandInput.tsx**: Disabled when pending; Stop button visible during pending; Escape triggers cancel.
- No server or bridge changes — reuses existing `abort` message pipeline.
