## ADDED Requirements

### Requirement: pi-agent-dashboard SHALL define a canonical default role-name set and overlay it at read time

The dashboard SHALL own a canonical default role-name set `DEFAULT_ROLE_NAMES = ["planning", "coding", "compact", "fast", "vision", "research"]`, defined in the dashboard (not read from pi-flows, which the dashboard no longer depends on for role ownership).

The default set SHALL contribute role NAMES only; it SHALL NOT assign any model. A default role with no assigned model is "unconfigured". The dashboard SHALL overlay these default names onto the assigned-roles map at READ time (in the `flow:role-get-all` response) so the Roles UI is never an empty dead end. Assigned values SHALL win over defaults; non-default assigned roles SHALL be preserved.

The dashboard SHALL NOT auto-write default role names to `providers.json`. A role reaches disk only when the user assigns a model (via the existing `flow:role-set` handler). This avoids an uninvited write to the shared global `providers.json` on session start.

#### Scenario: Default role names available on a fresh install

- **GIVEN** `~/.pi/agent/providers.json` has no `roles` key (or an empty `roles` map)
- **WHEN** the Roles back-end reports the roles map (via `flow:role-get-all`)
- **THEN** the reported roles SHALL include every name in `DEFAULT_ROLE_NAMES`
- **AND** each default role with no assignment SHALL report an empty/unset model value
- **AND** `~/.pi/agent/providers.json` SHALL NOT be created or modified by the read

#### Scenario: Assigned roles win over defaults in the overlay

- **GIVEN** `roles` contains `{ fast: "anthropic/haiku", custom: "x/y" }`
- **WHEN** the Roles back-end reports the roles map (via `flow:role-get-all`)
- **THEN** the reported map SHALL contain `fast: "anthropic/haiku"` and `custom: "x/y"`
- **AND** SHALL also contain the remaining `DEFAULT_ROLE_NAMES` with empty/unset values

## MODIFIED Requirements

### Requirement: pi-agent-dashboard SHALL register a `role:resolve-model` listener serving the subagents harness

The dashboard extension SHALL register a `pi.events.on("role:resolve-model", probe)` listener in `role-manager.ts::activate`. This serves `pi-dashboard-subagents` (>= 0.2.0), which resolves an agent definition's `model: "@role"` frontmatter by emitting `role:resolve-model` with a probe-shaped `{ ref: string, resolved?: string, available?: Record<string, string>, reason?: string }` and reading back `probe.resolved`.

The handler SHALL:

- Read `probe.ref` and ignore the event when `probe` is missing/null or `probe.ref` is not a string.
- Strip a single leading `@` from `probe.ref` to obtain the role name; ignore the event when the resulting role name is empty.
- Re-read `~/.pi/agent/providers.json#roles` on every event via the same role reader used by the `flow:role-*` handlers (no duplicate file-read logic).
- Set `probe.available` to the current roles map (so the subagents harness can list assignable roles in its error output).
- Set `probe.resolved` to the role's assigned literal `provider/modelId` when that value is a non-empty string; otherwise leave `probe.resolved` unset.
- When the role is unconfigured (present but with no assigned model, OR absent), set `probe.reason` to a structured "not configured yet" message naming the role (e.g. `role 'fast' not configured yet`). This signals shadow-disabled state to callers without throwing.

The handler SHALL be read-only (no writes to `providers.json`) and SHALL NOT throw on malformed input.

This requirement is additive with respect to `dashboard-model-resolution`: the existing `model:resolve` and deprecated `flow:resolve-model` listeners are unchanged and continue to use their own probe shapes.

#### Scenario: `@role` ref resolves to the assigned model

- **GIVEN** `~/.pi/agent/providers.json#roles` contains `{ fast: "my-google/gemma-4-31b-it" }`
- **WHEN** an emitter calls `pi.events.emit("role:resolve-model", { ref: "@fast" })`
- **THEN** after the emit returns, `probe.resolved` SHALL equal `"my-google/gemma-4-31b-it"`
- **AND** `probe.available` SHALL deep-equal `{ fast: "my-google/gemma-4-31b-it" }`
- **AND** `probe.reason` SHALL be unset

#### Scenario: Bare role name without `@` resolves

- **GIVEN** `roles` contains `{ fast: "anthropic/haiku" }`
- **WHEN** an emitter calls `pi.events.emit("role:resolve-model", { ref: "fast" })`
- **THEN** `probe.resolved` SHALL equal `"anthropic/haiku"`

#### Scenario: Unconfigured role leaves `probe.resolved` unset and sets a structured reason

- **GIVEN** `roles` contains `fast` with no assigned model (default-seeded, unconfigured)
- **WHEN** an emitter calls `pi.events.emit("role:resolve-model", { ref: "@fast" })`
- **THEN** `probe.resolved` SHALL remain `undefined`
- **AND** `probe.reason` SHALL be a non-empty string naming the role as not configured yet
- **AND** `probe.available` SHALL deep-equal the current roles map

#### Scenario: Cross-session role edit is visible

- **GIVEN** the handler is registered
- **WHEN** another writer sets `roles.fast = "x/y"` on disk after activation
- **AND** an emitter then calls `pi.events.emit("role:resolve-model", { ref: "@fast" })`
- **THEN** `probe.resolved` SHALL equal `"x/y"` (the handler re-read disk)
- **AND** `probe.reason` SHALL be unset

### Requirement: The Roles settings panel SHALL render default roles and a setup prompt instead of an empty state

The Roles settings UI (`RolesSettingsSection.tsx`) SHALL render one row per role in the effective roles map (persisted ∪ defaults). When no role has an assigned model, the panel SHALL remain enabled and loaded ("shadow-disabled"), render each default role row with an unassigned placeholder, and show a single banner reading "No roles have been set up — set up now". The legacy empty-state message referencing pi-flows SHALL be removed.

#### Scenario: Fresh install shows default rows and setup banner

- **GIVEN** no role has an assigned model
- **WHEN** the Roles settings panel renders
- **THEN** it SHALL display a row for every name in `DEFAULT_ROLE_NAMES`, each with an unassigned model placeholder
- **AND** it SHALL display a "No roles have been set up — set up now" banner
- **AND** it SHALL NOT display the legacy "install … pi-flows" empty-state text

#### Scenario: Configured roles hide the setup banner

- **GIVEN** at least one role has an assigned model
- **WHEN** the panel renders
- **THEN** the "set up now" banner SHALL NOT be shown
