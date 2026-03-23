## Why

Tool calls in the dashboard's ChatView render as static labels (gear icon + tool name) despite the `ToolCallStep` expandable component already existing and the event reducer already populating all needed data (`args`, `result`, `toolStatus`). Users cannot inspect tool arguments or outputs, making the dashboard significantly less useful for monitoring sessions.

## What Changes

- Replace the static `toolResult` rendering in `ChatView.tsx` with the existing `ToolCallStep` component
- Wire through `args`, `result`, and `toolStatus` from `ChatMessage` to `ToolCallStep` props
- Click-to-expand behavior (no auto-expand for running tools)

## Capabilities

### New Capabilities

_(none — no new capabilities introduced)_

### Modified Capabilities

_(none — the `chat-view` spec already defines tool call rendering with `ToolCallStep`. This change fixes the implementation to match the existing spec.)_

## Impact

- **Code**: `src/client/components/ChatView.tsx` — single file change, replace ~8 lines of static JSX with `ToolCallStep` usage
- **Dependencies**: None new — `ToolCallStep` already exists
- **Risk**: Minimal — purely a rendering change, no data pipeline modifications
