## ADDED Requirements

### Requirement: Optimistic pending card in chat
The chat view SHALL render an optimistic user message card at the bottom of the message list when `state.pendingPrompt` is set. The card SHALL use the same styling as a regular user message card but include an animated spinning icon to indicate processing.

#### Scenario: Pending card rendered
- **WHEN** `state.pendingPrompt` is defined
- **THEN** the chat view SHALL render a user-styled card at the bottom with the prompt text and a spinning loader icon

#### Scenario: Pending card removed on server event
- **WHEN** `state.pendingPrompt` becomes undefined (server confirmed or cancelled)
- **THEN** the optimistic card SHALL no longer be rendered

#### Scenario: Auto-scroll to pending card
- **WHEN** a pending card appears
- **THEN** the chat view SHALL auto-scroll to show it
