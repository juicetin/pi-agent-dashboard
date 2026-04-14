## MODIFIED Requirements

### Requirement: DetectedActivity includes active flag
The `DetectedActivity` interface SHALL include an `isActive` boolean field that indicates whether the detected activity represents an active operation (write, CLI command) or a passive operation (read).

#### Scenario: Read operation returns isActive false
- **WHEN** `detectOpenSpecActivity` is called with tool "read" and a path matching `openspec/changes/<name>/`
- **THEN** the result SHALL include `isActive: false`

#### Scenario: Write operation returns isActive true
- **WHEN** `detectOpenSpecActivity` is called with tool "write" and a path matching `openspec/changes/<name>/`
- **THEN** the result SHALL include `isActive: true`

#### Scenario: Bash CLI command returns isActive true
- **WHEN** `detectOpenSpecActivity` is called with tool "bash" and a command containing an openspec CLI invocation with a change name
- **THEN** the result SHALL include `isActive: true`

#### Scenario: Phase-only detection omits isActive
- **WHEN** `detectOpenSpecActivity` is called with a SKILL.md read (phase detection only, no changeName)
- **THEN** the result SHALL NOT include `isActive`

### Requirement: Auto-attach only on active operations
The server event wiring SHALL only auto-attach a session to an OpenSpec change when the detected activity has `isActive: true`.

#### Scenario: Read does not trigger auto-attach
- **WHEN** a session reads `openspec/changes/foo/proposal.md` and has no `attachedProposal`
- **THEN** `openspecChange` SHALL update to "foo" but `attachedProposal` SHALL remain unset

#### Scenario: Write triggers auto-attach
- **WHEN** a session writes `openspec/changes/foo/proposal.md` and has no `attachedProposal`
- **THEN** `attachedProposal` SHALL be set to "foo"

#### Scenario: Bash CLI triggers auto-attach
- **WHEN** a session runs `openspec new change "foo"` and has no `attachedProposal`
- **THEN** `attachedProposal` SHALL be set to "foo"
