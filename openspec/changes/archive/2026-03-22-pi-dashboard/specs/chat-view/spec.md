## ADDED Requirements

### Requirement: Session header
The chat view SHALL display a header showing the selected session's metadata: workspace name, session display name, model, thinking level, token count, cost, and session duration.

#### Scenario: Header displays live stats
- **WHEN** a session is selected and stats update
- **THEN** the header SHALL reflect current values in real-time

### Requirement: User message rendering
The chat view SHALL render user messages with a distinct visual style (e.g., right-aligned or highlighted background). Messages SHALL support markdown rendering.

#### Scenario: User message from TUI
- **WHEN** a user message originates from the TUI (forwarded via events)
- **THEN** the chat view SHALL display it the same as any other user message

#### Scenario: User message from dashboard
- **WHEN** a user sends a message from the dashboard input
- **THEN** the chat view SHALL display it immediately (optimistic rendering) before the pi event echo arrives

### Requirement: Assistant message rendering with streaming
The chat view SHALL render assistant messages with streaming text. During streaming, a cursor indicator (e.g., blinking block █) SHALL appear at the end of the text.

#### Scenario: Streaming text
- **WHEN** `message_update` events with `text_delta` arrive
- **THEN** the chat view SHALL append each delta to the message in real-time with smooth rendering

#### Scenario: Stream complete
- **WHEN** a `message_end` event arrives for an assistant message
- **THEN** the cursor indicator SHALL disappear and the message SHALL be finalized

### Requirement: Thinking block rendering
The chat view SHALL render assistant thinking blocks (from reasoning models) in a collapsible section, collapsed by default, with a visual indicator showing thinking occurred.

#### Scenario: Thinking block present
- **WHEN** an assistant message contains thinking content
- **THEN** the chat view SHALL show a "💭 Thinking..." indicator that can be expanded to show the thinking text

#### Scenario: Thinking collapsed by default
- **WHEN** a message with thinking is rendered
- **THEN** the thinking section SHALL be collapsed, showing only the indicator

### Requirement: Tool call rendering (collapsed by default)
The chat view SHALL render tool calls as collapsible step blocks. Each tool call SHALL be collapsed by default, showing only a one-line summary: tool icon, tool name, and a brief description of the arguments.

Collapsed summaries by tool type:
- `read`: "📄 {filepath}"
- `bash`: "💻 `{command}` (truncated to 60 chars)"
- `edit`: "✏️ {filepath}"
- `write`: "📝 {filepath}"
- `grep`: "🔍 `{pattern}` in {path}"
- `find`: "📁 {path} ({pattern})"
- `ls`: "📂 {path}"
- Custom tools: "🔧 {toolName}"

#### Scenario: Tool call collapsed display
- **WHEN** a `tool_execution_end` event arrives
- **THEN** the chat view SHALL show the tool call as a collapsed one-line step with the appropriate summary

#### Scenario: Tool call error
- **WHEN** a tool result has `isError: true`
- **THEN** the collapsed summary SHALL show a red error indicator

#### Scenario: Tool call in progress
- **WHEN** a `tool_execution_start` event arrives but no `tool_execution_end` yet
- **THEN** the tool call SHALL show as an animated/spinning step with the tool name and "Running..."

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
