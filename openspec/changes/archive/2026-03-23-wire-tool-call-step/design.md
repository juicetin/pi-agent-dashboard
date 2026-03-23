## Context

`ChatView.tsx` renders tool call messages (`role: "toolResult"`) as static labels — a gear icon and tool name. The `ToolCallStep` component already exists with full expand/collapse functionality, and the event reducer already populates `args`, `result`, and `toolStatus` on `ChatMessage`. The component and data are there; they just aren't connected.

## Goals / Non-Goals

**Goals:**
- Wire `ToolCallStep` into `ChatView` for tool result messages
- Click-to-expand behavior (collapsed by default)

**Non-Goals:**
- Auto-expand running tools
- Lazy-loading full output from server (existing `onExpand` prop — separate concern)
- Changes to the event reducer or data pipeline
- Changes to `ToolCallStep` component itself

## Decisions

### Use existing ToolCallStep as-is
**Decision**: Import and render `ToolCallStep` in `ChatView.tsx` without modifying the component.

**Rationale**: The component already has the exact interface needed — `toolName`, `args`, `status`, `result`, expand/collapse state. The `ChatMessage` type already carries all these fields. No adapter code needed.

**Alternative considered**: Building inline expand/collapse directly in ChatView. Rejected — duplicates existing component.

### Map ChatMessage fields directly to ToolCallStep props
**Decision**: Pass `msg.toolName`, `msg.args`, `msg.toolStatus`, and `msg.result` straight through.

**Rationale**: The field names and types already align. `toolStatus` maps to `status`, everything else is 1:1.

## Risks / Trade-offs

- **[Low] Unused `onExpand` prop**: `ToolCallStep` accepts `onExpand` for lazy-loading, which we won't wire up. No risk — it's optional and already unused.
- **[Low] Result truncation**: Output is already truncated to 30 lines by the reducer. Expanding a tool with large output will show truncated content with no way to see the rest. Acceptable for now; lazy-loading is a separate change.
