## ADDED Requirements

### Requirement: Attach proposal browser message
The browser→server protocol SHALL include an `attach_proposal` message type with fields `sessionId: string` and `changeName: string`.

#### Scenario: Attach proposal message sent
- **WHEN** the browser sends `{ type: "attach_proposal", sessionId: "s1", changeName: "add-auth" }`
- **THEN** the server SHALL process the attachment and broadcast a `session_updated` with `attachedProposal: "add-auth"`

### Requirement: Detach proposal browser message
The browser→server protocol SHALL include a `detach_proposal` message type with field `sessionId: string`.

#### Scenario: Detach proposal message sent
- **WHEN** the browser sends `{ type: "detach_proposal", sessionId: "s1" }`
- **THEN** the server SHALL process the detachment and broadcast a `session_updated` with `attachedProposal: null`
