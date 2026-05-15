# Model Selector — deltas

## MODIFIED Requirements

### Requirement: Roles UI surfaces via settings-section plugin contribution

The dashboard SHALL surface role-to-model assignment, preset save/load, preset delete, AND **deferred persistence with explicit Save / Reload affordances** through a `settings-section` plugin contribution claimed by a bundled built-in plugin. The claim SHALL target `tab: "general"`.

The contribution SHALL maintain local pending state (`pending: Record<string,string>`) for role picks the user has made but not yet saved. The pending state SHALL be the source of truth for display: the rendered value of a role pill is `pending[role] ?? rolesMap[role]`. The contribution SHALL NOT dispatch `role_set` on every pick.

The contribution SHALL render a Save and a Reload button below the preset row and above the role grid. The contribution SHALL render an inline dirty marker on each role pill whose key exists in `pending` and whose pending value differs from the persisted value.

#### Scenario: Picking a model only updates pending state

- **WHEN** the user clicks a role pill, opens the model picker, and picks a model whose label differs from the persisted value for that role
- **THEN** the contribution SHALL update its local `pending` state for that role
- **AND** the contribution SHALL NOT dispatch a `role_set` WebSocket message
- **AND** the pill SHALL render with the picked value and an inline dirty marker

#### Scenario: Picking the persisted value back clears dirty

- **WHEN** the user picks a model whose label equals `rolesMap[role]` (the current server value)
- **THEN** the contribution SHALL remove that key from `pending`
- **AND** the pill SHALL render without a dirty marker

#### Scenario: Save dispatches only changed roles

- **WHEN** the user clicks Save while `pending` contains one or more roles whose values differ from `rolesMap`
- **THEN** the contribution SHALL dispatch one `role_set` WebSocket message per such role, in arbitrary order
- **AND** each dispatched message SHALL carry `modelId` equal to the pending label and `provider` parsed as the prefix before `/`
- **AND** the contribution SHALL clear `pending` optimistically (before any `roles_list` ack arrives)
- **AND** roles where `pending[role] === rolesMap[role]` SHALL NOT trigger a dispatch

#### Scenario: Save when clean dispatches nothing

- **WHEN** the user clicks Save while `pending` is empty (or every entry matches the server value)
- **THEN** the contribution SHALL NOT dispatch any messages
- **AND** Save SHALL be rendered as disabled (`aria-disabled` true, visually muted)

#### Scenario: Reload discards pending and re-reads from server

- **WHEN** the user clicks Reload
- **THEN** the contribution SHALL clear `pending` immediately
- **AND** the contribution SHALL dispatch `{type:"request_roles", sessionId}` to force the bridge to re-emit `roles_list` from `~/.pi/agent/providers.json`
- **AND** the pills SHALL render with `rolesMap[role]` (no dirty markers) starting on the next render

#### Scenario: Inbound roles_list auto-cleans matching pending entries

- **WHEN** the contribution receives a `roles_list` (via `usePluginConfig` update) where `roles[role] === pending[role]`
- **THEN** the contribution SHALL remove that key from `pending`
- **AND** the pill SHALL render without a dirty marker

#### Scenario: Inbound roles_list preserves conflicting pending entries

- **WHEN** the contribution receives a `roles_list` where `roles[role]` differs from BOTH the previous `rolesMap[role]` AND the user's `pending[role]`
- **THEN** the contribution SHALL leave `pending[role]` unchanged
- **AND** the dirty marker SHALL remain visible

#### Scenario: Preset Load while dirty surfaces a confirmation

- **WHEN** the user clicks a preset's Load button while `pending` is non-empty
- **THEN** the contribution SHALL show a confirmation prompt ("Discard unsaved role changes?")
- **AND** on confirm, the contribution SHALL clear `pending` and dispatch `role_preset_load`
- **AND** on cancel, the contribution SHALL leave `pending` untouched and SHALL NOT dispatch `role_preset_load`

#### Scenario: Preset Save while dirty saves edits first

- **WHEN** the user names and confirms saving a preset while `pending` is non-empty
- **THEN** the contribution SHALL run the Save logic (one `role_set` per dirty role) FIRST
- **AND** then dispatch `role_preset_save` with the chosen name
- **AND** SHALL render a one-line hint above the input ("Unsaved edits will be saved first.") for the duration of the saving-preset flow when `pending` is non-empty

## ADDED Requirements

### Requirement: Dirty count visible on Save button

The Save button SHALL render the count of dirty roles in its label when `pending` is non-empty (e.g. `Save (3)`). When `pending` is empty, the button SHALL render its label as `Save` without a count and SHALL be disabled.

#### Scenario: Count reflects dirty entries

- **WHEN** the user has picked new values for two roles (neither matching the server value)
- **THEN** the Save button label SHALL read `Save (2)`

#### Scenario: Count excludes entries that round-tripped back to server value

- **WHEN** the user has three entries in `pending` but one matches `rolesMap`
- **THEN** the Save button label SHALL read `Save (2)`
- **AND** the round-tripped entry's pill SHALL NOT render a dirty marker
