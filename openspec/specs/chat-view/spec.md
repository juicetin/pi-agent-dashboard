## ADDED Requirements

### Requirement: Session header
The chat view SHALL display a header showing the selected session's metadata: workspace name, session display name, model, thinking level, token count, cost, and session duration.

#### Scenario: Header displays live stats
- **WHEN** a session is selected and stats update
- **THEN** the header SHALL reflect current values in real-time

### Requirement: User message rendering
The chat view SHALL render user messages with a subtle tinted background (`bg-blue-500/10`) and a left accent border (`border-l-2 border-l-blue-400`) to distinguish them from assistant messages without using a heavy solid color. Messages SHALL be rendered using the MarkdownContent component for full markdown support. The message wrapper SHALL use a `<div>` element (not `<p>`) to avoid invalid nested HTML. The bubble SHALL have `rounded-xl`, `shadow-md`, and `border border-blue-500/20` for a 3D elevated appearance.

#### Scenario: User message from TUI
- **WHEN** a user message originates from the TUI (forwarded via events)
- **THEN** the chat view SHALL display it the same as any other user message

#### Scenario: User message from dashboard
- **WHEN** a user sends a message from the dashboard input
- **THEN** the chat view SHALL display it immediately (optimistic rendering) before the pi event echo arrives

#### Scenario: User message with markdown
- **WHEN** a user message contains markdown formatting (e.g., code blocks)
- **THEN** the chat view SHALL render it with full markdown formatting

#### Scenario: User message visual style
- **WHEN** a user message is rendered
- **THEN** the bubble SHALL have a subtle blue tint background (not solid blue), a blue left accent border, rounded-xl corners, and a shadow for depth

### Requirement: Assistant message rendering with streaming
The chat view SHALL render assistant messages with streaming text using the MarkdownContent component. During streaming, a cursor indicator (e.g., blinking block █) SHALL appear at the end of the text. The message wrapper SHALL use a `<div>` element (not `<p>`) to avoid invalid nested HTML. The bubble SHALL have `rounded-xl`, `shadow-md`, and `border border-white/5` for a 3D elevated appearance.

#### Scenario: Streaming text
- **WHEN** `message_update` events with `text_delta` arrive
- **THEN** the chat view SHALL append each delta to the message in real-time with smooth rendering and markdown formatting

#### Scenario: Stream complete
- **WHEN** a `message_end` event arrives for an assistant message
- **THEN** the cursor indicator SHALL disappear and the message SHALL be finalized

#### Scenario: Streaming with partial code block
- **WHEN** the streaming text contains an unclosed fenced code block
- **THEN** the component SHALL render gracefully without errors

#### Scenario: Assistant message visual style
- **WHEN** an assistant message is rendered
- **THEN** the bubble SHALL have rounded-xl corners, a shadow for depth, and a subtle border highlight

### Requirement: Thinking block rendering
The chat view SHALL render assistant thinking blocks (from reasoning models) in a collapsible section, collapsed by default, with a visual indicator showing thinking occurred.

#### Scenario: Thinking block present
- **WHEN** an assistant message contains thinking content
- **THEN** the chat view SHALL show a "💭 Thinking..." indicator that can be expanded to show the thinking text

#### Scenario: Thinking collapsed by default
- **WHEN** a message with thinking is rendered
- **THEN** the thinking section SHALL be collapsed, showing only the indicator

### Requirement: Tool call rendering (collapsed by default)
The chat view SHALL render tool calls as collapsible step blocks using the `ToolCallStep` component. Each tool call SHALL appear in the message list immediately when `tool_execution_start` is received, showing a running/spinner state. On `tool_execution_end`, the same message SHALL update in-place to show completion status.

Each tool call SHALL be collapsed by default, showing only a one-line summary: status icon, tool name, and a brief description of the arguments.

When expanded, the tool call SHALL display:
- **Args section**: The tool arguments as formatted JSON
- **Output section**: The tool result text, truncated to 30 lines maximum

Collapsed summaries by tool type:
- `read`: "Read {filepath}"
- `bash`: "$ {command} (truncated to 60 chars)"
- `edit`: "Edit {filepath}"
- `write`: "Write {filepath}"
- Custom tools: "{toolName}"

Status icons:
- Running: ⏳ (yellow)
- Complete: ✓ (green)
- Error: ✗ (red)

#### Scenario: Tool call appears on start
- **WHEN** a `tool_execution_start` event arrives with `toolCallId`, `toolName`, and `args`
- **THEN** the chat view SHALL immediately show a collapsed tool call step with ⏳ spinner and tool summary

#### Scenario: Tool call updates with partial result
- **WHEN** a `tool_execution_update` event arrives with `partialResult`
- **THEN** the tool call message SHALL update its stored result with the partial content (truncated to 30 lines)

#### Scenario: Tool call completes
- **WHEN** a `tool_execution_end` event arrives with `result` and `isError`
- **THEN** the existing tool call message SHALL update in-place: status changes to ✓ or ✗, result content is stored (truncated to 30 lines)

#### Scenario: Tool call expanded display
- **WHEN** a user clicks a collapsed tool call step
- **THEN** the step SHALL expand to show args as JSON and output as preformatted text

#### Scenario: Tool call error
- **WHEN** a tool result has `isError: true`
- **THEN** the collapsed summary SHALL show a red ✗ indicator

#### Scenario: Result truncation
- **WHEN** a tool result exceeds 30 lines
- **THEN** only the first 30 lines SHALL be displayed

### Requirement: Lazy-loaded tool content on expand
When a user expands a collapsed tool call, the full content SHALL be fetched from the server on demand, NOT preloaded in the DOM. This optimizes DOM size and memory for sessions with many tool calls.

#### Scenario: Expand tool call
- **WHEN** a user clicks a collapsed tool call step
- **THEN** the browser SHALL fetch the full event payload from `GET /api/events/:sessionId/:seq` and render the content

#### Scenario: Collapse tool call
- **WHEN** a user collapses an expanded tool call
- **THEN** the full content SHALL be removed from the DOM (or hidden) to free memory

#### Scenario: Expand while loading
- **WHEN** a user expands a tool call and the content is being fetched
- **THEN** a loading spinner SHALL be shown until the content arrives

### Requirement: Syntax-highlighted code blocks
Code blocks within messages and tool results SHALL be syntax-highlighted based on language detection or file extension.

#### Scenario: Code in assistant message
- **WHEN** an assistant message contains a fenced code block with a language tag
- **THEN** the code SHALL be rendered with syntax highlighting for that language

#### Scenario: File content from read tool
- **WHEN** an expanded read tool result shows file content
- **THEN** the content SHALL be syntax-highlighted based on the file extension

### Requirement: File diff rendering
Edit and write tool results SHALL render diffs with added/removed line highlighting (green for additions, red for removals).

#### Scenario: Edit tool result expanded
- **WHEN** a user expands an edit tool result
- **THEN** the diff SHALL be shown with green/red line highlighting

### Requirement: Markdown rendering
Assistant message text SHALL be rendered as markdown with support for: headings, bold/italic, lists, links, inline code, fenced code blocks, tables, and blockquotes.

#### Scenario: Markdown in assistant message
- **WHEN** an assistant message contains markdown formatting
- **THEN** it SHALL be rendered as formatted HTML

### Requirement: Auto-scroll with scroll lock
The chat view SHALL auto-scroll to the bottom as new content arrives. If the user scrolls up, auto-scroll SHALL pause (scroll lock). Auto-scroll SHALL resume when the user scrolls back to the bottom.

#### Scenario: New message while at bottom
- **WHEN** a new message or delta arrives and the user is at the bottom of the chat
- **THEN** the view SHALL auto-scroll to show the new content

#### Scenario: User scrolls up during streaming
- **WHEN** the user scrolls up while the assistant is streaming
- **THEN** auto-scroll SHALL pause and a "↓ New messages" indicator SHALL appear

#### Scenario: Resume auto-scroll
- **WHEN** the user scrolls back to the bottom (or clicks the "↓ New messages" indicator)
- **THEN** auto-scroll SHALL resume

### Requirement: Compaction indicator
When a compaction event occurs, the chat view SHALL show a visual divider indicating that context was compacted, with the summary text if available.

#### Scenario: Compaction event
- **WHEN** a `session_compact` event arrives
- **THEN** the chat view SHALL show a divider with "Context compacted" and the compaction summary (collapsed by default)
