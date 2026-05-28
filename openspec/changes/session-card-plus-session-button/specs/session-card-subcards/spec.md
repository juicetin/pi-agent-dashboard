## ADDED Requirements

### Requirement: +Session sibling-spawn button on session card
The session card SHALL render an always-visible `+Session` button alongside the existing `Fork` and `Resume` controls. Unlike Fork/Resume, this button SHALL NOT be gated on `session.status === "ended"` or on the presence of `session.sessionFile` — it renders for live and ended sessions alike.

Click SHALL emit a `spawn_session` ws message with:
- `cwd` set to the parent session's `cwd`,
- `attachProposal` set to the parent session's `attachedProposal` when that field is a non-empty string (omitted otherwise),
- a fresh `requestId` (UUIDv4).

The button SHALL be `disabled` when `session.cwdMissing === true`, with tooltip text matching the existing Fork-disabled tooltip (`session's directory no longer exists`).

The button SHALL NOT carry `gitWorktreeBase` or any worktree-related metadata. Worktree-sibling spawning is covered by separate surfaces (folder `+Worktree`, per-change `⑂+`).

#### Scenario: Visible on live session
- **WHEN** a session card is rendered for a session with `status === "running"` (or any non-ended status)
- **THEN** the `+Session` button SHALL render
- **THEN** Fork and Resume controls SHALL be absent (existing behavior — they only show on ended sessions)

#### Scenario: Visible on ended session alongside Fork
- **WHEN** a session card is rendered for a session with `status === "ended"` and a valid `sessionFile`
- **THEN** `+Session`, `Resume`, and `Fork` SHALL all render in the same control row

#### Scenario: Click inherits cwd and proposal
- **WHEN** the user clicks `+Session` on a session with `cwd = "/project/foo"` and `attachedProposal = "add-dark-mode"`
- **THEN** a `spawn_session` ws message SHALL be sent with `cwd: "/project/foo"`, `attachProposal: "add-dark-mode"`, and a UUIDv4 `requestId`

#### Scenario: Click omits proposal when parent has none
- **WHEN** the user clicks `+Session` on a session whose `attachedProposal` is `null`, `undefined`, or empty string
- **THEN** the emitted `spawn_session` payload SHALL omit the `attachProposal` key entirely (not send empty string)

#### Scenario: Disabled on missing cwd
- **WHEN** the parent session has `cwdMissing === true`
- **THEN** the `+Session` button SHALL render with the `disabled` attribute set
- **THEN** the tooltip SHALL read `session's directory no longer exists`
- **THEN** clicks SHALL NOT emit a `spawn_session` message
