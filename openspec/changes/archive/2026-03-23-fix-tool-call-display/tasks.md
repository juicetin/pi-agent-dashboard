## 1. Event Reducer — ChatMessage type and tool event handling

- [x] 1.1 Add `args`, `result`, and `toolStatus` fields to `ChatMessage` type
- [x] 1.2 On `tool_execution_start`: add tool message to `messages[]` with `toolStatus: "running"`, args, and `id: tool-{toolCallId}`
- [x] 1.3 On `tool_execution_update`: find existing tool message by toolCallId and update `result` with `partialResult` (truncated to 30 lines)
- [x] 1.4 On `tool_execution_end`: find existing tool message by toolCallId, update `toolStatus` to complete/error, store `result` (truncated to 30 lines). Remove the duplicate message creation.
- [x] 1.5 Add helper function `truncateLines(text: string, maxLines: number): string`

## 2. Event Reducer Tests

- [x] 2.1 Test: tool message appears in `messages[]` on `tool_execution_start` with status "running" and args
- [x] 2.2 Test: `tool_execution_update` updates existing message result with partialResult
- [x] 2.3 Test: `tool_execution_end` updates existing message status and result in-place (no duplicate message)
- [x] 2.4 Test: result truncation to 30 lines
- [x] 2.5 Update existing tests that assert message counts to account for tool messages appearing on start

## 3. ToolCallStep Component

- [x] 3.1 Add `result` prop to `ToolCallStep` component
- [x] 3.2 Render result in expanded view as `<pre>` block below args section
- [x] 3.3 Show "Output:" label only when result is present

## 4. ChatView Integration

- [x] 4.1 Import `ToolCallStep` in `ChatView`
- [x] 4.2 Replace plain `<div>` tool result rendering with `ToolCallStep`, passing `args`, `result`, and `toolStatus` from the message
