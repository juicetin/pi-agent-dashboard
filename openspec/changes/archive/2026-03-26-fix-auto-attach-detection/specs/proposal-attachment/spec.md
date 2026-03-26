## MODIFIED Requirements

### Requirement: Server-side auto-attach from activity detection
When the server receives `openspec_activity_update` messages, it SHALL update the session's `openspecPhase` and `openspecChange` fields independently. After each update, if the session has both `openspecPhase` and `openspecChange` set and no `attachedProposal`, the server SHALL automatically set `attachedProposal` to the session's accumulated `openspecChange` value.

#### Scenario: Auto-attach on first activity detection
- **WHEN** the server receives `openspec_activity_update` with `phase: "apply"` and `changeName: "add-auth"` for a session with `attachedProposal = null`
- **THEN** the server SHALL set `session.attachedProposal = "add-auth"` and broadcast `session_updated`

#### Scenario: Auto-attach from separately arriving phase and changeName
- **WHEN** the server receives `openspec_activity_update` with `phase: "apply"` (no changeName) for a session with `attachedProposal = null`
- **AND** later receives `openspec_activity_update` with `changeName: "add-auth"` (no phase) for the same session
- **THEN** the server SHALL set `session.attachedProposal = "add-auth"` and broadcast `session_updated`

#### Scenario: No auto-attach when proposal already attached
- **WHEN** the server receives `openspec_activity_update` with `changeName: "other-change"` for a session with `attachedProposal = "add-auth"`
- **THEN** the server SHALL NOT change `attachedProposal`

#### Scenario: No auto-attach when only phase detected
- **WHEN** the server receives `openspec_activity_update` with `phase: "explore"` but no `changeName` for a session with `openspecChange = null`
- **THEN** the server SHALL NOT set `attachedProposal`

#### Scenario: No auto-attach when only changeName detected
- **WHEN** the server receives `openspec_activity_update` with `changeName: "add-auth"` but no `phase` for a session with `openspecPhase = null`
- **THEN** the server SHALL NOT set `attachedProposal`

### Requirement: Manual detach via browser
The browser SHALL send a `detach_proposal` message to clear the attached proposal. The server SHALL set `session.attachedProposal` to null, clear `openspecPhase` and `openspecChange` to null, and broadcast a `session_updated` message. The session name SHALL NOT be reverted.

#### Scenario: User clicks Detach
- **WHEN** the user clicks the "Detach" button in the OpenSpec header for session `"s1"`
- **THEN** the browser SHALL send `{ type: "detach_proposal", sessionId: "s1" }`
- **AND** the server SHALL set `session.attachedProposal = null`, `session.openspecPhase = null`, `session.openspecChange = null` and broadcast the update
- **AND** the session name SHALL remain unchanged

#### Scenario: Re-detection after detach
- **WHEN** a proposal is detached from a session
- **AND** the session later receives new `openspec_activity_update` messages with both phase and changeName
- **THEN** the server SHALL auto-attach the newly detected change
