## MODIFIED Requirements

### Requirement: User message rendering
The chat view SHALL render user messages with a right-aligned style, `bg-blue-600` background, and `border border-blue-500/20` border. Messages SHALL be rendered using the MarkdownContent component for full markdown support. The message wrapper SHALL use a `<div>` element.

#### Scenario: User message styling
- **WHEN** a user message is rendered
- **THEN** it SHALL have a blue background with a subtle blue border

### Requirement: Assistant message rendering with streaming
The chat view SHALL render assistant messages with `bg-gray-800` background and `border border-gray-700/40` border, using the MarkdownContent component. During streaming, a cursor indicator SHALL appear at the end of the text.

#### Scenario: Assistant message styling
- **WHEN** an assistant message is rendered
- **THEN** it SHALL have a gray background with a subtle gray border
