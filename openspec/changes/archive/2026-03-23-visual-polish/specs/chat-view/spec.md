## MODIFIED Requirements

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
