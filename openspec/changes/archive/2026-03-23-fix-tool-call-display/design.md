## Context

The chat view has a `ToolCallStep` component with expand/collapse and arg display, but `ChatView` renders tool results as plain `<div>` elements instead. The event reducer only adds tool messages on `tool_execution_end` (so running tools are invisible), drops `tool_execution_update` events, and doesn't store args or result content. The bridge extension already forwards all tool event data including `args`, `partialResult`, and `result`.

## Goals / Non-Goals

**Goals:**
- Tool calls appear immediately when they start (running state with spinner)
- Tool calls are expandable to show args and output
- Result content is captured and displayed (truncated to 30 lines)
- Streaming partial results update the tool message in real-time

**Non-Goals:**
- Lazy-loading tool content from server (existing spec mentions this but it's a separate concern)
- Syntax highlighting of tool results (separate concern)
- Diff rendering for edit tools (already handled by DiffView, separate concern)

## Decisions

### 1. Add tool messages on `tool_execution_start`, update in-place on end

**Decision**: Create the tool message in `messages[]` when `tool_execution_start` fires. On `tool_execution_end`, find and update the existing message rather than adding a new one.

**Rationale**: This gives immediate visibility of running tools. The alternative — adding on end only — leaves gaps where the user can't see what's happening. Updating in-place avoids duplicate messages.

**Message lookup**: Use `toolCallId` to find the existing message. The message `id` follows the pattern `tool-{toolCallId}`.

### 2. Enrich `ChatMessage` type with tool-specific fields

**Decision**: Add optional fields to `ChatMessage`:
- `args?: Record<string, unknown>` — tool arguments
- `result?: string` — tool output (truncated)
- `toolStatus?: "running" | "complete" | "error"` — current execution state

**Rationale**: Keeps all display data on the message itself rather than requiring ChatView to cross-reference the `toolCalls` Map. The `toolCalls` Map can remain as-is for backward compatibility.

### 3. Truncate result to 30 lines in the reducer

**Decision**: When storing `result` on `tool_execution_end`, truncate to the first 30 lines. Apply the same truncation to `partialResult` on `tool_execution_update`.

**Rationale**: Tool outputs (especially `bash` and `read`) can be enormous. Truncating in the reducer keeps memory bounded and avoids DOM performance issues. 30 lines provides enough context for most tool calls.

### 4. Wire existing `ToolCallStep` into `ChatView`

**Decision**: Replace the plain `<div>` rendering for `toolResult` messages with the `ToolCallStep` component. Pass `args`, `result`, and `toolStatus` from the message.

**Rationale**: The component already exists with expand/collapse, status icons, and arg display. Just needs to be imported and used.

### 5. Add result display section to `ToolCallStep`

**Decision**: When expanded, show args (existing) and result (new) in separate sections. Result is rendered in a `<pre>` block below args.

**Rationale**: Minimal change to the existing component. Args and result are visually distinct sections.

## Risks / Trade-offs

- **[Risk] Updating messages in-place requires finding by toolCallId** → Use `findLastIndex` on messages array. Tool call IDs are unique, so lookup is reliable. Array scan is fine for typical message counts.
- **[Risk] 30-line truncation may hide important output** → Acceptable for dashboard monitoring use case. Full output available in the pi TUI. Could add "show more" later.
- **[Trade-off] Storing result on ChatMessage duplicates data with toolCalls Map** → Acceptable for simplicity. The Map serves a different purpose (status tracking by ID). Keeping message self-contained simplifies rendering.
