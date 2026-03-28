## ADDED Requirements

### Requirement: Internal dashboard command for tree/fork access
The bridge extension SHALL register a command named `__dashboard` via `pi.registerCommand()`. This command SHALL receive `ExtensionCommandContext` which provides access to `ctx.fork()`, `ctx.navigateTree()`, and `ctx.sessionManager`.

The command handler SHALL parse the `args` string as JSON with an `action` field and dispatch accordingly:
- `{ "action": "get_tree" }`: read tree structure and send `tree_snapshot`
- `{ "action": "navigate_tree", "targetId": "<id>" }`: call `ctx.navigateTree(targetId, { summarize: false })`
- `{ "action": "fork", "entryId": "<id>" }`: call `ctx.fork(entryId)`

The command SHALL validate that args is valid JSON. On invalid input, it SHALL silently return without action.

#### Scenario: Get tree action
- **WHEN** the `__dashboard` command receives `{ "action": "get_tree" }`
- **THEN** it SHALL read `ctx.sessionManager.getTree()` and `ctx.sessionManager.getLeafId()`, convert to a flat `TreeNodeInfo[]`, and send a `tree_snapshot` message via the connection

#### Scenario: Navigate tree action
- **WHEN** the `__dashboard` command receives `{ "action": "navigate_tree", "targetId": "a1b2c3d4" }`
- **THEN** it SHALL call `ctx.navigateTree("a1b2c3d4", { summarize: false })` and wait for completion

#### Scenario: Fork action
- **WHEN** the `__dashboard` command receives `{ "action": "fork", "entryId": "a1b2c3d4" }`
- **THEN** it SHALL call `ctx.fork("a1b2c3d4")` and wait for completion

#### Scenario: Invalid JSON args
- **WHEN** the `__dashboard` command receives non-JSON args (e.g., invoked manually from TUI)
- **THEN** the command SHALL silently return without action or error

#### Scenario: Action while streaming
- **WHEN** the `__dashboard` command receives a navigate_tree or fork action while `ctx.isIdle()` returns false
- **THEN** the command SHALL send an error response via the connection and NOT execute the action

### Requirement: Filter internal command from commands list
When sending the `commands_list` message to the dashboard server, the bridge SHALL filter out any commands whose name starts with `__`. This prevents the internal `__dashboard` command from appearing in the dashboard's autocomplete or command list.

#### Scenario: Commands list excludes internal commands
- **WHEN** `pi.getCommands()` returns commands including `__dashboard`
- **THEN** the `commands_list` message SHALL NOT include any commands with names starting with `__`

#### Scenario: Regular commands unaffected
- **WHEN** `pi.getCommands()` returns commands like `tree`, `fork`, `name`
- **THEN** all non-underscore-prefixed commands SHALL be included in the `commands_list`

### Requirement: Forward session_tree and session_fork events
The bridge extension SHALL subscribe to `session_tree` and `session_fork` events and forward them to the dashboard server as `event_forward` messages, in addition to the existing forwarded event types.

#### Scenario: Tree navigation event forwarded
- **WHEN** pi fires a `session_tree` event with `{ newLeafId, oldLeafId }`
- **THEN** the bridge SHALL forward it as an `event_forward` message with `eventType: "session_tree"`

#### Scenario: Fork event forwarded
- **WHEN** pi fires a `session_fork` event with `{ previousSessionFile }`
- **THEN** the bridge SHALL forward it as an `event_forward` message with `eventType: "session_fork"`

### Requirement: Send session snapshot after tree navigation
When the bridge receives a `session_tree` event, it SHALL read the new branch from `ctx.sessionManager.getBranch()`, convert entries to `SnapshotMessage` format, and send a `session_snapshot` message with `reason: "tree_navigation"`.

#### Scenario: Snapshot sent after tree navigation
- **WHEN** `session_tree` fires with `newLeafId: "c3d4"`
- **THEN** the bridge SHALL read `getBranch()`, convert entries, and send `session_snapshot` with `reason: "tree_navigation"` and the converted messages

#### Scenario: Tree navigation to root
- **WHEN** `session_tree` fires with `newLeafId: null` (reset to empty)
- **THEN** the bridge SHALL send a `session_snapshot` with an empty messages array

### Requirement: Send session snapshot after fork
When the bridge receives a `session_fork` event, it SHALL read the new branch from `ctx.sessionManager.getBranch()`, convert entries to `SnapshotMessage` format, and send a `session_snapshot` message with `reason: "fork"` and the `forkedFrom` field set to `event.previousSessionFile`.

#### Scenario: Snapshot sent after fork
- **WHEN** `session_fork` fires with `previousSessionFile: "/path/to/old.jsonl"`
- **THEN** the bridge SHALL send `session_snapshot` with `reason: "fork"`, the converted messages, and `forkedFrom: "/path/to/old.jsonl"`

### Requirement: Handle tree and fork requests from server
The bridge extension SHALL handle new server-to-extension message types for tree operations by dispatching them to the `__dashboard` command.

New server → extension messages:
- `request_tree`: trigger `get_tree` action
- `navigate_tree` with `targetId`: trigger `navigate_tree` action
- `fork_session` with `entryId`: trigger `fork` action

#### Scenario: Server requests tree
- **WHEN** the bridge receives a `request_tree` message
- **THEN** it SHALL invoke the `__dashboard` command with `{ "action": "get_tree" }`

#### Scenario: Server requests navigate tree
- **WHEN** the bridge receives a `navigate_tree` message with `targetId: "a1b2"`
- **THEN** it SHALL invoke the `__dashboard` command with `{ "action": "navigate_tree", "targetId": "a1b2" }`

#### Scenario: Server requests fork
- **WHEN** the bridge receives a `fork_session` message with `entryId: "c3d4"`
- **THEN** it SHALL invoke the `__dashboard` command with `{ "action": "fork", "entryId": "c3d4" }`
