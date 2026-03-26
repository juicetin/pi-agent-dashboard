## ADDED Requirements

### Requirement: Auto-name from attached proposal
When a proposal is attached to a session and the session's `name` field is empty or undefined, the server SHALL automatically set `session.name` to the proposal name and send a `rename_session` message to the extension.

#### Scenario: Session auto-named on proposal attach
- **WHEN** proposal `"add-auth"` is attached to session with `name = undefined`
- **THEN** the server SHALL set `session.name = "add-auth"`
- **AND** send `rename_session` to the extension with `name: "add-auth"`
- **AND** broadcast `session_updated` with both `attachedProposal: "add-auth"` and `name: "add-auth"`

#### Scenario: Session name not overwritten on attach
- **WHEN** proposal `"add-auth"` is attached to session with `name = "my work"`
- **THEN** the server SHALL NOT change `session.name`

#### Scenario: Detach does not revert auto-name
- **WHEN** a proposal is detached from a session whose name was auto-set to the proposal name
- **THEN** `session.name` SHALL remain as the proposal name
