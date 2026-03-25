## 1. State Layer

- [x] 1.1 Add `pendingPrompt?: { text: string; images?: ChatImage[] }` field to `SessionState` in `event-reducer.ts` and initialize it as `undefined` in `createInitialState()`
- [x] 1.2 Clear `pendingPrompt` in `reduceEvent` on `message_start` (role: "user") and `agent_start` events
- [x] 1.3 Write tests for the reducer: pendingPrompt is preserved through unrelated events, cleared on message_start (user), cleared on agent_start

## 2. App Integration

- [x] 2.1 In `App.tsx` `handleSend`, after sending the WebSocket message, set `pendingPrompt` on the selected session's state
- [x] 2.2 Add `handleCancelPending` in `App.tsx` that clears `pendingPrompt` and sends `{ type: "abort" }` to the server
- [x] 2.3 Pass `pendingPrompt` and `onCancelPending` down to `ChatView` and `CommandInput`

## 3. ChatView Optimistic Card

- [x] 3.1 In `ChatView.tsx`, render an optimistic user card at the bottom of the message list when `state.pendingPrompt` exists — same style as user cards plus an `animate-spin` spinner icon
- [x] 3.2 Render image attachments in the optimistic card when `pendingPrompt.images` is present
- [x] 3.3 Trigger auto-scroll when `pendingPrompt` changes
- [x] 3.4 Write tests for ChatView: optimistic card renders when pendingPrompt is set, disappears when cleared

## 4. CommandInput Pending Behavior

- [x] 4.1 Disable the input and send button when `pendingPrompt` exists (add to existing `disabled` logic)
- [x] 4.2 Show Stop button when `pendingPrompt` exists (extend existing `sessionStatus === "streaming"` check)
- [x] 4.3 Handle Escape key in input to trigger `onCancelPending` when `pendingPrompt` exists
- [x] 4.4 Write tests for CommandInput: input disabled during pending, Stop button visible during pending, Escape triggers cancel
