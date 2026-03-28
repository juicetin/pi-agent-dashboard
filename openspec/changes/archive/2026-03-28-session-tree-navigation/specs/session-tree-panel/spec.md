## ADDED Requirements

### Requirement: Tree panel toggle
The chat view header SHALL include a tree icon button (🌳) that toggles the tree panel open/closed. The button SHALL only be visible when a live session is selected (not ended sessions).

#### Scenario: Toggle tree panel open
- **WHEN** a user clicks the tree icon button in the chat header
- **THEN** the tree panel SHALL slide in from the right side, overlaying the chat content

#### Scenario: Toggle tree panel closed
- **WHEN** the tree panel is open and the user clicks the tree icon button again
- **THEN** the tree panel SHALL slide out and close

#### Scenario: Tree button hidden for ended sessions
- **WHEN** the selected session has status `ended`
- **THEN** the tree icon button SHALL NOT be visible

### Requirement: On-demand tree loading
When the tree panel opens, it SHALL request the tree structure from the bridge extension via the `request_tree` protocol message. A loading spinner SHALL be shown while waiting for the response.

#### Scenario: Tree panel opens
- **WHEN** the tree panel becomes visible
- **THEN** the client SHALL send a `request_tree` message for the selected session and show a loading spinner

#### Scenario: Tree snapshot received
- **WHEN** the client receives a `tree_snapshot` message for the subscribed session
- **THEN** the loading spinner SHALL be replaced with the rendered tree structure

#### Scenario: Tree request timeout
- **WHEN** no `tree_snapshot` is received within 10 seconds of opening the panel
- **THEN** the panel SHALL show an error message "Failed to load tree" with a retry button

### Requirement: Tree structure rendering
The tree panel SHALL render the session's branch structure as a vertical tree with indentation and connector lines. Each node SHALL show a one-line preview of the entry.

Node display format:
- User messages: `● "First 80 chars of message..."` with blue accent
- Assistant messages: `● "First 80 chars of response..."` with neutral color
- Compaction nodes: `● [compaction]` with muted styling
- Branch summary nodes: `● [branch summary]` with muted styling
- Other entry types (model_change, thinking_level_change): hidden by default

The current leaf node SHALL be marked with a `← active` indicator and highlighted background.

Branch points (nodes with multiple children) SHALL show connector lines to indicate branching:
```
● "Hello, help me..."
└─● "Sure! I can..."
   ├─● "Try approach A" ← active
   └─● "Try approach B"
```

#### Scenario: Linear conversation
- **WHEN** the session has no branches (each node has at most one child)
- **THEN** the tree SHALL render as a simple vertical list with single connector lines

#### Scenario: Branched conversation
- **WHEN** the session has branch points (nodes with multiple children)
- **THEN** the tree SHALL show fork connectors (├─ and └─) at branch points

#### Scenario: Current leaf highlighted
- **WHEN** the tree is rendered
- **THEN** the current leaf node SHALL have a highlighted background and `← active` label

#### Scenario: Long message preview
- **WHEN** a message content exceeds 80 characters
- **THEN** the preview SHALL be truncated to 80 characters with "..." appended

#### Scenario: Labeled nodes
- **WHEN** a tree node has a label (user-defined bookmark)
- **THEN** the label SHALL be shown as a badge next to the node preview (e.g., `[checkpoint-1]`)

### Requirement: Rollback button on tree nodes
Each message node in the tree panel SHALL have a rollback button (↩) that triggers tree navigation to that node. The button SHALL be visible on hover.

#### Scenario: Click rollback on a node
- **WHEN** a user clicks the rollback button on a tree node
- **THEN** the client SHALL send a `navigate_tree` message with the node's entry ID
- **AND** the tree panel SHALL show a loading state on the clicked node

#### Scenario: Rollback completes
- **WHEN** a `session_snapshot` is received after a rollback operation
- **THEN** the tree panel SHALL refresh (re-request tree) and the chat view SHALL rebuild from the snapshot

#### Scenario: Rollback on current leaf
- **WHEN** a user clicks rollback on the node that is already the current leaf
- **THEN** no action SHALL be taken (button disabled or no-op)

#### Scenario: Rollback while streaming
- **WHEN** the session is currently streaming (agent is active) and the user clicks rollback
- **THEN** the rollback button SHALL be disabled with a tooltip "Wait for agent to finish"

### Requirement: Fork button on tree nodes
Each message node in the tree panel SHALL have a fork button (🔀) that triggers a fork from that node. The button SHALL be visible on hover.

#### Scenario: Click fork on a node
- **WHEN** a user clicks the fork button on a tree node
- **THEN** the client SHALL send a `fork_session` message with the node's entry ID
- **AND** the tree panel SHALL show a loading state

#### Scenario: Fork completes
- **WHEN** a `session_snapshot` with reason `fork` is received
- **THEN** the chat view SHALL rebuild from the snapshot and show a "🔀 Forked" indicator
- **AND** the tree panel SHALL refresh to show the new (linear) branch

#### Scenario: Fork while streaming
- **WHEN** the session is currently streaming and the user clicks fork
- **THEN** the fork button SHALL be disabled with a tooltip "Wait for agent to finish"
