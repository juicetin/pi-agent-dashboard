## ADDED Requirements

### Requirement: Session snapshot state reset
When the client receives a `session_snapshot` event, the chat view SHALL clear all current messages and rebuild from the snapshot. The chat SHALL scroll to the bottom after rebuilding.

#### Scenario: Snapshot replaces messages
- **WHEN** a `session_snapshot` event is received with 10 messages
- **THEN** the chat view SHALL clear all existing messages and display the 10 snapshot messages

#### Scenario: Snapshot clears streaming state
- **WHEN** a `session_snapshot` arrives while streaming text is displayed
- **THEN** the streaming text and cursor indicator SHALL be cleared, and the snapshot messages SHALL be displayed

#### Scenario: Auto-scroll after snapshot
- **WHEN** a snapshot rebuilds the chat view
- **THEN** the view SHALL scroll to the bottom of the conversation

### Requirement: Tree navigation indicator
When a `session_snapshot` with `reason: "tree_navigation"` is received, the chat view SHALL show a brief toast notification indicating that the session navigated to a different branch.

#### Scenario: Tree navigation toast
- **WHEN** a `session_snapshot` with `reason: "tree_navigation"` is processed
- **THEN** a toast notification SHALL appear: "↩ Navigated to branch"

### Requirement: Fork indicator
When a `session_snapshot` with `reason: "fork"` is received, the chat view SHALL show a brief toast notification indicating that the session was forked.

#### Scenario: Fork toast
- **WHEN** a `session_snapshot` with `reason: "fork"` is processed
- **THEN** a toast notification SHALL appear: "🔀 Session forked"

### Requirement: Tree panel button in header
The chat view header SHALL include a tree icon button next to the existing controls. The button SHALL toggle the tree panel component.

#### Scenario: Tree button placement
- **WHEN** the chat view header is rendered for a live session
- **THEN** a tree icon button (🌳 or tree icon from icon library) SHALL appear in the header controls area

#### Scenario: Tree button active state
- **WHEN** the tree panel is open
- **THEN** the tree button SHALL have an active/highlighted visual state
