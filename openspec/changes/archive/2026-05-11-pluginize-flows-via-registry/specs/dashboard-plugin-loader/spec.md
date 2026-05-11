## ADDED Requirements

### Requirement: Plugin context exposes per-session event stream

`PluginContextValue` SHALL provide a hook
`useSessionEvents(sessionId: string): readonly DashboardEvent[]` that
returns every event observed for the given session in arrival order.
The hook SHALL be reactive: when a new event arrives for the
subscribed session, the consuming component SHALL re-render with the
extended event list.

The returned array SHALL be referentially stable across renders that
do not change the event list. Plugins MAY use it as a `useMemo`
dependency to recompute derived state only when new events arrive.

The dashboard shell SHALL accumulate per-session events in a parallel
in-memory store sourced from the existing `case "event"` handler in
`useMessageHandler.ts`. The accumulator SHALL be initialized empty on
`session_register`, appended to on each `event`, and cleared on
session unregister.

#### Scenario: Plugin derives state from events

- **GIVEN** a plugin contribution is rendered for session `S`
- **AND** events `[e1, e2, e3]` have been received for session `S`
- **WHEN** the contribution calls `useSessionEvents("S")`
- **THEN** the hook SHALL return an array containing `[e1, e2, e3]` in
  arrival order
- **AND** the array reference SHALL be the same on subsequent renders
  until a new event arrives

#### Scenario: New event triggers re-render

- **GIVEN** a plugin contribution rendered with `useSessionEvents("S")`
  returning `[e1, e2]`
- **WHEN** event `e3` arrives via the `case "event"` handler
- **THEN** the contribution SHALL re-render
- **AND** the hook SHALL return `[e1, e2, e3]` on the new render

#### Scenario: Hook is per-session

- **GIVEN** events `[a1, a2]` for session `A` and `[b1]` for session `B`
- **WHEN** a contribution calls `useSessionEvents("A")`
- **THEN** the hook SHALL return only `[a1, a2]`
- **AND** SHALL NOT include any event from session `B`

### Requirement: ContentViewSlot SHALL filter competing claims by predicate

`ContentViewSlot` SHALL select among multiple `content-view` claims by
invoking each claim's optional `predicate` function and rendering the
first claim (by priority order) whose predicate returns `true`. If no
claim's predicate returns `true`, `ContentViewSlot` SHALL render
nothing (return `null`), allowing the shell's fallback (`??
sessionDetail`) to render the default chat view. The slot is
`multiplicity: "one-active"`, so at most one claim renders at a time.

The `predicate` field on `PluginClaim` is the SAME field used by
session-card-badge and other session-scoped slots. It is a free
JavaScript function name resolved at build time by the vite plugin
against the plugin's client entry exports. The function's body MAY
read any state its module exposes (including plugin-internal
stores); the `session` argument is informational.

The SDK SHALL NOT add a parallel discriminator mechanism (such as a
`route?` field). Plugins compose with the existing predicate slot
field. (Earlier drafts of this change added a `route?` field; it was
removed — see design.md Decision 3 RECONSIDERED.)

#### Scenario: ContentViewSlot picks the predicate-true claim

- **GIVEN** two `content-view` claims registered:
  - Claim A: `{ component: "FlowAgentDetail", predicate: "isFlowAgentDetailActive" }`
  - Claim B: `{ component: "FlowArchitectDetail", predicate: "isFlowArchitectDetailActive" }`
- **AND** `isFlowAgentDetailActive` returns `true`
- **AND** `isFlowArchitectDetailActive` returns `false`
- **WHEN** the shell mounts `<ContentViewSlot>`
- **THEN** only Claim A SHALL render
- **AND** Claim B SHALL NOT render

#### Scenario: ContentViewSlot renders nothing when all predicates are false

- **GIVEN** content-view claims whose predicates all return `false`
- **WHEN** the shell mounts `<ContentViewSlot>`
- **THEN** the slot SHALL render nothing
- **AND** the shell's `?? sessionDetail` fallback SHALL render the
  chat view

#### Scenario: Multiple true predicates resolve by priority

- **GIVEN** two content-view claims whose predicates both return
  `true`, one at priority 40 and one at priority 60
- **WHEN** the shell mounts `<ContentViewSlot>`
- **THEN** only the lower-priority-value (priority 40) claim SHALL
  render (existing slot `(priority asc, pluginId asc)` ordering)

#### Scenario: Predicate can read plugin-internal state via closure

- **GIVEN** a content-view claim's predicate function is defined in
  the plugin's client entry and closes over a module-level state
  store
- **WHEN** the user triggers a plugin action that updates the store
  (e.g. `setFlowDetailAgent(name)`)
- **THEN** the predicate's next invocation SHALL reflect the new
  state
- **AND** the slot consumer SHALL pick up the change on next render

