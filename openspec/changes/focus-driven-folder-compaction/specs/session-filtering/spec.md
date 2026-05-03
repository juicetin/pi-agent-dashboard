## ADDED Requirements

### Requirement: Attention predicate

A pure helper `demandsAttention(session) → boolean` SHALL be defined in `packages/client/src/lib/folder-focus.ts` and SHALL return `true` when ANY of the following holds:

- `session.currentTool === "ask_user"`
- `session.status === "streaming"`
- `session.status === "active"`
- `session.unread === true`

The helper SHALL be a pure function over `Session` fields with no I/O and no derived caches. Reactivity is achieved by re-running the predicate on every `SessionList` render.

#### Scenario: ask_user pending
- **WHEN** a session has `currentTool === "ask_user"`
- **THEN** `demandsAttention` SHALL return `true`

#### Scenario: Streaming
- **WHEN** a session has `status === "streaming"`
- **THEN** `demandsAttention` SHALL return `true`

#### Scenario: Active (tool running)
- **WHEN** a session has `status === "active"`
- **THEN** `demandsAttention` SHALL return `true`

#### Scenario: Unread bit set
- **WHEN** a session has `unread === true`
- **THEN** `demandsAttention` SHALL return `true`

#### Scenario: Idle session
- **WHEN** a session has `status === "idle"`, `currentTool` undefined, and `unread === false` (or undefined)
- **THEN** `demandsAttention` SHALL return `false`

#### Scenario: Ended session
- **WHEN** a session has `status === "ended"` and `unread === false`
- **THEN** `demandsAttention` SHALL return `false`

### Requirement: Unfocused folder attention filter

When a folder group's render mode is `compactWithAttention` (see `folder-focus` spec), the rendered session-card region SHALL contain only sessions for which `demandsAttention(session)` returns `true`. All other sessions SHALL be omitted from the DOM for that folder.

The filter SHALL apply on top of, not in place of, the existing `hidden` and `sessionSearch` filters: a hidden session SHALL remain hidden in `compactWithAttention` mode regardless of attention state, and a session that does not match an active `sessionSearch` query SHALL remain hidden.

The filter SHALL apply uniformly to pinned and unpinned (Other) folder groups.

#### Scenario: Idle sessions hidden in compact mode
- **WHEN** a folder is in `compactWithAttention` mode and contains 5 idle sessions and 1 streaming session
- **THEN** only the streaming session SHALL render

#### Scenario: Hidden session stays hidden even when attention-worthy
- **WHEN** a session has `hidden = true`, `currentTool === "ask_user"`, and the folder is in `compactWithAttention` mode with `Show hidden` OFF
- **THEN** the session SHALL NOT render

#### Scenario: Search filter still applies
- **WHEN** a session has `unread = true` but does not match the active `sessionSearch` query and the folder is in `compactWithAttention` mode
- **THEN** the session SHALL NOT render

#### Scenario: Unpinned (Other) folder honors the same rules
- **WHEN** an unpinned folder group is in `compactWithAttention` mode
- **THEN** the same attention filter SHALL apply

### Requirement: Compact-empty affordance

When a folder group's render mode is `compactEmpty` (no attention sessions visible), the folder SHALL render its header followed by a single subdued affordance row containing the text `"N sessions — click to view"` where `N` is the total count of visible sessions in the folder (after `hidden` and `sessionSearch` filters but before the attention filter).

Clicking the affordance SHALL set `lastFocusedCwd = group.cwd` (focus the folder). It SHALL NOT mutate `collapsedGroups` and SHALL NOT add the folder to `userExpanded`.

If the folder contains zero sessions after `hidden` and `sessionSearch` filters, the affordance row SHALL NOT render (header only).

#### Scenario: Affordance shows correct count
- **WHEN** a folder has 18 visible sessions and none demand attention
- **THEN** the affordance SHALL read `"18 sessions — click to view"`

#### Scenario: Click focuses the folder
- **WHEN** the user clicks the `"N sessions — click to view"` affordance for folder `/foo`
- **THEN** `lastFocusedCwd` SHALL equal `/foo`
- **AND** `collapsedGroups` SHALL NOT change
- **AND** `userExpanded` SHALL NOT change

#### Scenario: Empty folder shows no affordance
- **WHEN** a folder has zero visible sessions after filtering and is unfocused
- **THEN** only the folder header SHALL render

### Requirement: Live reactivity on attention clearance

When a session's attention state changes from `true` to `false` (e.g., `unread` is cleared by the server, `status` transitions from `streaming` to `idle`, or `currentTool` becomes undefined) AND the session belongs to an unfocused folder, the session card SHALL be removed from the rendered DOM on the next render. No transition animation is required.

#### Scenario: Streaming session ends in unfocused folder
- **WHEN** a streaming session in an unfocused folder transitions to `status: "idle"` and was not unread
- **THEN** the session card SHALL no longer render in that folder on the next render

#### Scenario: Unread bit cleared in unfocused folder
- **WHEN** a session in an unfocused folder has `unread = true` and the server clears it to `false`
- **THEN** the session card SHALL no longer render in that folder on the next render (assuming no other attention condition holds)
