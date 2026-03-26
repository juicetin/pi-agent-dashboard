## MODIFIED Requirements

### Requirement: Fork session
The dashboard SHALL support forking a session by spawning a new pi instance with `pi --fork <session-file-path>`. This creates a new JSONL file with a new session ID. The server SHALL record a pending fork entry so the new session is placed after its parent in the session order.

#### Scenario: Fork ended session
- **WHEN** the user clicks "Fork" on an ended session that has a `sessionFile` stored
- **THEN** the server SHALL spawn pi with `pi --fork <session-file-path>` in the session's cwd via tmux
- **AND** pi SHALL create a new session with a new ID, which connects via the bridge as a new visible session
- **AND** the original session SHALL remain hidden
- **AND** the server SHALL record a pending fork entry with the parent session's ID and cwd

#### Scenario: Fork active session
- **WHEN** the user clicks "Fork" on an active session
- **THEN** the server SHALL spawn pi with `pi --fork <session-file-path>` in the session's cwd
- **AND** a new independent session SHALL be created without affecting the original
- **AND** the server SHALL record a pending fork entry with the parent session's ID and cwd
