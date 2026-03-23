## ADDED Requirements

### Requirement: Git info update message
The protocol SHALL define a `git_info_update` message type for extension → server communication. The message SHALL include:
- `type`: `"git_info_update"`
- `sessionId`: string
- `gitBranch`: string
- `gitBranchUrl`: optional string
- `gitPrNumber`: optional number
- `gitPrUrl`: optional string

#### Scenario: Extension sends git info
- **WHEN** the extension detects git info for a session
- **THEN** it SHALL send a `git_info_update` message with all available fields

#### Scenario: Server receives git info
- **WHEN** the server receives a `git_info_update` message
- **THEN** it SHALL update the session record and broadcast `session_updated` to browser clients with the git fields
