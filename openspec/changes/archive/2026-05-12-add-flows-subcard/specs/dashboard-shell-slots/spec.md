## ADDED Requirements

### Requirement: New plugin slot `session-card-flows` is reserved and consumed by FLOWS subcard

A new dashboard plugin slot identifier `session-card-flows` SHALL be added to `SLOT_DEFINITIONS` in `packages/shared/src/dashboard-plugin/slot-types.ts`. Multiplicity SHALL be `many`. Payload tier SHALL be `react-only` (matching `session-card-action-bar` and `session-card-memory`). The slot SHALL render its claims inside the FLOWS subcard. When no plugin claims the slot, the subcard renders nothing.

A matching consumer component `SessionCardFlowsSlot({ session })` SHALL be exported from `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`. The consumer SHALL render both legacy refs claims (filtered via `forSessionRendered`) and intent-store contributions (via `useSlotIntents("session-card-flows", session.id)`), each wrapped in a per-claim `SlotErrorBoundary` + `CurrentPluginLayer`.

The slot SHALL be classified as session-scoped: `SlotPredicateInput<"session-card-flows">` SHALL resolve to `DashboardSession | null | undefined`. The compile-time exhaustiveness assertion (`_AssertAllSlotsPredicateClassified`) SHALL cover the new slot id without modification beyond the union extension.

#### Scenario: Slot definition exists

- **WHEN** the slot registry is initialized
- **THEN** `SLOT_DEFINITIONS` SHALL contain an entry with `id: "session-card-flows"` and `multiplicity: "many"`

#### Scenario: Slot consumer is exported from the runtime

- **WHEN** a consumer imports from `@blackbelt-technology/dashboard-plugin-runtime`
- **THEN** the named export `SessionCardFlowsSlot` SHALL be present and accept a `{ session: DashboardSession }` prop

#### Scenario: Plugin contribution renders inside FLOWS subcard

- **WHEN** a plugin registers a `session-card-flows` claim that returns a non-empty React node for a session
- **AND** a desktop session card is rendered for that session
- **THEN** the rendered DOM SHALL contain a `FLOWS` titled subcard
- **AND** the plugin's contribution SHALL appear inside that subcard's body

#### Scenario: Predicate input is session-scoped

- **WHEN** type-checking `SlotPredicateInput<"session-card-flows">`
- **THEN** the resolved type SHALL be `DashboardSession | null | undefined`

## MODIFIED Requirements

### Requirement: Slot taxonomy is a frozen, named list

The dashboard SHALL expose a fixed set of named slots, defined as a TypeScript union in `@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/slot-types.ts`. Each slot SHALL have a stable string id and a typed payload contract. Slot ids SHALL NOT be renamed or removed within a major version.

The slot taxonomy SHALL include at minimum:

```ts
type SlotId =
  // first-party React-targeted slots
  | "sidebar-folder-section"
  | "session-card-badge"
  | "session-card-action-bar"
  | "session-card-flows"
  | "session-card-memory"
  | "workspace-action-bar"
  | "content-view"
  | "content-header-sticky"
  | "content-inline-footer"
  | "anchored-popover"
  | "command-route"
  | "settings-section"
  | "tool-renderer"
  // descriptor-renderable slots (shared with extension-ui-system)
  | "management-modal"
  | "footer-segment"
  | "agent-metric"
  | "breadcrumb"
  | "gate"
  | "toast"
  | "rjsf-form";
```

Each slot id SHALL be associated with a payload type and a `multiplicity` (`one` | `many` | `one-active`).

#### Scenario: Slot id is referenced via type import

- **WHEN** a plugin or shell component declares a claim on a slot
- **THEN** the slot id SHALL be passed as a typed `SlotId` value, not as a free string, so renames produce TypeScript errors.

#### Scenario: Adding a new slot is a minor version bump

- **WHEN** a new slot id is added to the union
- **THEN** the change SHALL be a minor (non-breaking) version of `pi-dashboard-shared`, since existing plugins that don't reference the new slot are unaffected.

#### Scenario: Removing a slot is a major version bump

- **WHEN** a slot id is removed
- **THEN** the change SHALL be a major version, and plugins claiming that slot fail to load with an explicit error.

### Requirement: Slot taxonomy SHALL classify each slot id by predicate input shape

The shared package `@blackbelt-technology/pi-dashboard-shared/dashboard-plugin/slot-types.js` SHALL export a public type `SlotPredicateInput<S extends SlotId>` that maps every `SlotId` to the input shape its registered predicates receive at runtime. The mapping SHALL reflect the actual filter helpers in the plugin runtime:

| Slot category | Slot ids | `SlotPredicateInput<S>` |
|---|---|---|
| Session-scoped | `session-card-badge`, `session-card-action-bar`, `session-card-flows`, `session-card-memory`, `workspace-action-bar`, `content-view`, `content-header-sticky`, `content-inline-footer`, `command-route` | `DashboardSession \| null \| undefined` |
| Folder-scoped | `sidebar-folder-section` | `FolderDescriptor` |
| Predicate-irrelevant | every other `SlotId` (`settings-section`, `tool-renderer`, `anchored-popover`, all descriptor-only slots) | `never` |

The classification SHALL be expressed as a single conditional type. The file SHALL include a compile-time exhaustiveness assertion (analogous to the existing `_AssertAllSlotsCovered` pattern for `SlotPropsMap`) that fails type-checking if any `SlotId` is left unclassified.

The `never` value for predicate-irrelevant slots is documentation-only: under the bivariant method-shorthand contract used by `ClaimEntry`, predicates can still be registered against `never`-input slots without a type error, but the registered function is never invoked at runtime because filter helpers only target session- and folder-scoped slots. Plugins SHOULD NOT rely on `never`-typed slots rejecting predicates at compile time.

#### Scenario: Session-scoped slot maps to DashboardSession input

- **WHEN** type-checking `SlotPredicateInput<"session-card-badge">`
- **THEN** the resolved type SHALL be `DashboardSession | null | undefined`.

#### Scenario: New session-card-flows slot is session-scoped

- **WHEN** type-checking `SlotPredicateInput<"session-card-flows">`
- **THEN** the resolved type SHALL be `DashboardSession | null | undefined`.

#### Scenario: Folder-scoped slot maps to FolderDescriptor input

- **WHEN** type-checking `SlotPredicateInput<"sidebar-folder-section">`
- **THEN** the resolved type SHALL be `FolderDescriptor`.

#### Scenario: Predicate-irrelevant slot maps to `never`

- **WHEN** type-checking `SlotPredicateInput<"settings-section">`
- **THEN** the resolved type SHALL be `never`.
- **AND** registering a predicate on such a slot SHALL compile (method bivariance) but the predicate SHALL NOT be invoked at runtime.

#### Scenario: Adding a new slot id without classification is a compile error

- **WHEN** a new entry is added to the `SlotId` union but is not assigned a classification in `SlotPredicateInput`
- **THEN** the compile-time exhaustiveness assertion in `slot-types.ts` SHALL fail with a TypeScript error pointing at the unclassified slot.

### Requirement: Shell SHALL render all flow content via plugin slot claims

The shell SHALL NOT directly import or render any `Flow*` component.
All flow rendering SHALL go through slot consumers populated by
`flows-plugin` claims. Specifically:

- `FlowActivityBadge` rendered via `session-card-badge` slot.
- `SessionFlowActions` rendered via `session-card-flows` slot.
- `FlowDashboard` and `FlowArchitect` rendered via
  `content-header-sticky` slot.
- `FlowAgentDetail`, `FlowArchitectDetail`, `FlowYamlPreview`
  rendered via `content-view` slot, each with a distinct `route`.
- `FlowSummary` rendered via `content-inline-footer` slot.
- Slash-command wrappers (`/flows`, `/flows:new`, `/flows:edit`,
  `/flows:delete`) rendered via `command-route` slot.

The shell SHALL NOT pass flow-specific props to any slot consumer.
Slot consumers receive the standard prop contract for their slot
(`{ session, pluginContext }` or
`{ session, routeParams, onClose, pluginContext }` for content-view).

#### Scenario: Single content-header-sticky claim renders FlowArchitect

- **GIVEN** a session whose event stream has produced a non-null
  `architectState` inside `flows-plugin`'s internal context
- **WHEN** the shell renders `<ContentHeaderStickySlot session={...}>`
- **THEN** `<FlowArchitect>` SHALL render exactly once via the slot
  contribution
- **AND** the rendering SHALL not require any flow-specific props from
  the shell

#### Scenario: FlowArchitect collapses across selection states

- **GIVEN** the user is viewing a session with both `architectState`
  and `flowState` set
- **WHEN** the user transitions through architect-detail, flow-detail,
  and default content views
- **THEN** `<FlowArchitect>` SHALL be rendered exactly once at any
  point in time
- **AND** dismissal callbacks SHALL be uniform across all selection
  states (handled by the plugin's internal UI-state context)

#### Scenario: FlowDashboard collapses across selection states

- **GIVEN** the user is viewing a session with `flowState` set
- **WHEN** the user transitions through flow-detail and default views
- **THEN** `<FlowDashboard>` SHALL be rendered exactly once at any
  point in time

#### Scenario: SessionFlowActions renders inside FLOWS subcard

- **GIVEN** a session whose `flowsList` is non-empty OR whose `commandsList` includes `flows:new`
- **WHEN** the desktop session card is rendered
- **THEN** `<SessionFlowActions>` SHALL render exactly once inside the FLOWS subcard via the `session-card-flows` slot
- **AND** SHALL NOT render via the `session-card-action-bar` slot
