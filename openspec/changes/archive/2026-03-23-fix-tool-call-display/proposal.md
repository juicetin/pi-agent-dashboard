## Why

Tool calls in the chat view are broken: they render as non-expandable plain text lines showing only the tool name, and some don't appear at all (they only show on `tool_execution_end`, not on start). The `ToolCallStep` component exists with expand/collapse functionality but is never wired into `ChatView`. The event reducer drops `tool_execution_update` events entirely and doesn't store args or result content on tool messages. This makes it impossible to see what tools are doing or what they returned.

## What Changes

- **Wire `ToolCallStep` into `ChatView`**: Replace the plain `<div>` tool result rendering with the existing `ToolCallStep` component
- **Show tool calls on start**: Add tool call messages to the message list on `tool_execution_start` (running state with spinner), not just on `tool_execution_end`
- **Store args and result on tool messages**: Enrich the `ChatMessage` type with `args`, `result`, and `toolStatus` fields so `ToolCallStep` can display them
- **Handle `tool_execution_update`**: Update partial results on tool messages as they stream in
- **Truncate result display to 30 lines**: Prevent huge tool outputs from overwhelming the UI
- **Update `ToolCallStep` to show result content**: Add an output section below args in the expanded view

## Capabilities

### New Capabilities

_(none — this is fixing existing capability implementation)_

### Modified Capabilities

- `chat-view`: Tool call rendering requirements are already specified but not fully implemented. No spec changes needed — this is an implementation fix to match existing spec.

## Impact

- `src/client/lib/event-reducer.ts` — Add tool message on start, handle update, store result on end
- `src/client/lib/event-reducer.ts` — `ChatMessage` type gains `args`, `result`, `toolStatus` fields
- `src/client/components/ChatView.tsx` — Import and use `ToolCallStep` for tool messages
- `src/client/components/ToolCallStep.tsx` — Add result display, accept result prop
- `src/client/lib/__tests__/event-reducer.test.ts` — Update tests for new behavior
