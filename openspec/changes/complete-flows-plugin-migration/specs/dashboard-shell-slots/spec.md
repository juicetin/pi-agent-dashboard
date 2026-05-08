## ADDED Requirements

### Requirement: DashboardSession carries optional flow and architect state

The `DashboardSession` type defined in `packages/shared/src/types.ts` SHALL include three optional fields populated by the bridge whenever a session is participating in a pi-flows execution or a flow-architect interaction:

- `flowState?: FlowState | null` — the active flow's state object, as emitted by `reduceFlowEvent` in `packages/flows-plugin/src/flow-reducer.ts`. `null` when no flow is currently active on the session; `undefined` when the bridge has not yet reported on the session.
- `flowStates?: ReadonlyMap<string, FlowState>` — map of every flow seen during the session, keyed by `flowName`. Used by `FlowDashboard` to switch between subflows. Empty map when no flow has executed.
- `architectState?: ArchitectState | null` — the flow-architect interaction state, as emitted by `reduceArchitectEvent`. `null` when no architect interaction is active.

All three fields SHALL be optional. Older browser clients reconnecting to a server that emits these fields SHALL NOT crash; the fields SHALL be ignored if the client does not consume them. The bridge process SHALL be the source of truth for these fields; the server SHALL NOT compute them itself.

#### Scenario: Session with no active flow has flowState null or undefined

- **WHEN** a session has not started any flow during its lifetime
- **THEN** `session.flowState` SHALL be `undefined` or `null`
- **AND** `session.flowStates` SHALL be `undefined` or an empty `Map`

#### Scenario: Session with active flow has populated flowState

- **WHEN** a session is currently running a flow named `"deploy"`
- **THEN** `session.flowState` SHALL be a `FlowState` object with `flowName === "deploy"` and `status` matching the active execution status
- **AND** `session.flowStates` SHALL contain at least one entry with key `"deploy"` mapping to the same object

#### Scenario: Bridge populates flow state on session_register

- **WHEN** the bridge sends a `session_register` message for a session that already has flow state on disk (e.g., reconnect mid-flow)
- **THEN** the message payload SHALL include the latest `flowState` and `architectState` produced by the bridge's flow event listener
- **AND** the server's `MemorySessionManager` SHALL store the augmented session object

#### Scenario: Reconnect mid-flow surfaces flow state to client

- **WHEN** a browser reconnects to the dashboard server while a session has an active flow
- **THEN** the first `sessions_snapshot` message the browser receives SHALL contain `session.flowState` populated to the latest known state
- **AND** the dashboard SHALL render the flow UI without requiring a manual refresh

#### Scenario: Older browser ignores new fields gracefully

- **WHEN** a browser built without knowledge of `flowState`/`architectState` connects to a server that includes these fields in `sessions_snapshot`
- **THEN** the browser SHALL parse the message without throwing
- **AND** the unrecognized fields SHALL be ignored
- **AND** all other session functionality SHALL continue to work unchanged

### Requirement: Flow-related claims self-derive from session

Slot consumers for `session-card-badge`, `session-card-action-bar`, `content-header-sticky`, `content-view`, and `content-inline-footer` SHALL continue to pass exactly the props defined by the frozen v0.x slot prop contracts (`{session}` for the first three and the last; `{session, routeParams, onClose}` for `content-view`). The slot prop contracts SHALL NOT be expanded to carry flow-specific payloads.

Plugin components claiming these slots SHALL self-derive flow state from `session.flowState`, `session.flowStates`, `session.architectState`, and where applicable from `routeParams`. Components SHALL gracefully render `null` when their required state is absent, returning early before any side effects.

#### Scenario: FlowActivityBadge derives state from session

- **WHEN** the slot consumer for `session-card-badge` invokes the `FlowActivityBadge` claim with `{session}`
- **THEN** the component SHALL read `flowName`, `agentsDone`, `agentsTotal`, and `status` from `session.flowState` (or directly from session-level convenience fields if exposed)
- **AND** the component SHALL render `null` if `session.flowState` is `null` or `undefined`

#### Scenario: FlowDashboard derives state from session

- **WHEN** the slot consumer for `content-header-sticky` invokes the `FlowDashboard` claim with `{session}`
- **THEN** the component SHALL read `flowState` and `flowStates` from the session
- **AND** the component SHALL pull command callbacks (`onAbort`, `onToggleAutonomous`, `onDismissSummary`, `onSendPrompt`, `onViewYaml`, `onViewAgentSource`, `onAgentClick`) from a `FlowActionsContext` provided by the dashboard shell
- **AND** the component SHALL render `null` if `session.flowState` is `null` or `undefined`

#### Scenario: FlowAgentDetail derives agent from session and routeParams

- **WHEN** the slot consumer for `content-view` invokes the `FlowAgentDetail` claim with `{session, routeParams: {agentId}, onClose}`
- **THEN** the component SHALL look up the agent via `session.flowState?.agents.get(routeParams.agentId)`
- **AND** the component SHALL render `null` if the agent cannot be found
- **AND** the component SHALL invoke `onClose` (passed by the slot consumer) when its back/dismiss action fires

### Requirement: Predicates filter flow claims at the slot consumer level

The `forSession` filter (defined in `packages/dashboard-plugin-runtime/src/slot-registry.ts`) SHALL evaluate each claim's `predicate` function (when present) against the rendered session and SHALL exclude claims whose predicate returns falsy. With the predicate emission requirement on `dashboard-plugin-loader` satisfied, predicates declared in `flows-plugin`'s manifest (`hasActiveFlow`, `hasActiveArchitect`) SHALL be real function references, not string identifiers.

This requirement does not change the `forSession` filter's behavior — it has always called `c.predicate(session)` if the field exists. The change is operational: with predicate emission fixed, predicates START actually existing on emitted claims (today they are always `undefined`).

#### Scenario: hasActiveFlow predicate filters badge to active-flow sessions

- **WHEN** session A has `session.flowState !== null` and session B has `session.flowState === null`
- **AND** the `FlowActivityBadge` claim has `predicate: hasActiveFlow`
- **THEN** the slot consumer SHALL render the badge for session A
- **AND** SHALL NOT render the badge for session B

#### Scenario: Predicate exception surfaces via per-claim error boundary

- **WHEN** a claim's `predicate(session)` throws an exception
- **THEN** the per-claim error boundary (already required by `dashboard-shell-slots`) SHALL catch the error
- **AND** the claim SHALL render nothing
- **AND** sibling claims for the same slot SHALL continue rendering
- **AND** the error SHALL be logged with the offending plugin id and slot id

### Requirement: flows-plugin manifest claims are populated and slot-rendered

`packages/flows-plugin/package.json#pi-dashboard-plugin.claims` SHALL be a non-empty array containing the following claims (other fields like `priority` may be added):

| slot | component | predicate | view (for content-view) |
|---|---|---|---|
| `session-card-badge` | `FlowActivityBadge` | `hasActiveFlow` | — |
| `session-card-action-bar` | `SessionFlowActions` | — | — |
| `content-header-sticky` | `FlowDashboard` | `hasActiveFlow` | — |
| `content-header-sticky` | `FlowArchitect` | `hasActiveArchitect` | — |
| `content-view` | `FlowAgentDetail` | — | `flow-agent-detail` |
| `content-view` | `FlowArchitectDetail` | — | `flow-architect-detail` |
| `content-inline-footer` | `FlowSummary` | `hasActiveFlow` | — |

`packages/flows-plugin/src/client/index.tsx` SHALL export `hasActiveFlow` and `hasActiveArchitect` as predicate functions accepting `DashboardSession` and returning `boolean`.

The dashboard shell (`App.tsx`, `SessionCard.tsx`, `SessionHeader.tsx`) SHALL NOT directly import any of these seven flow components; they SHALL be reached only through the slot consumers.

#### Scenario: Manifest claims are populated

- **WHEN** reading `packages/flows-plugin/package.json#pi-dashboard-plugin.claims`
- **THEN** the array SHALL contain exactly seven entries matching the table above
- **AND** SHALL NOT be empty

#### Scenario: Predicates are exported from client entry

- **WHEN** importing from `@blackbelt-technology/pi-dashboard-flows-plugin/client`
- **THEN** the exports SHALL include `hasActiveFlow` AND `hasActiveArchitect` as functions
- **AND** each function SHALL accept `DashboardSession | null | undefined` and return a `boolean`

#### Scenario: Shell does not import flow components directly

- **WHEN** scanning `packages/client/src/App.tsx`, `packages/client/src/components/SessionCard.tsx`, `packages/client/src/components/SessionHeader.tsx`, and `packages/client/src/components/MobileShell.tsx`
- **THEN** none of these files SHALL contain `import` statements that name `FlowDashboard`, `FlowAgentCard`, `FlowAgentDetail`, `FlowArchitect`, `FlowArchitectDetail`, `FlowSummary`, `FlowActivityBadge`, `SessionFlowActions`, or `FlowLaunchDialog` from `@blackbelt-technology/pi-dashboard-flows-plugin/*`
- **AND** flow rendering SHALL flow exclusively through the slot consumer components

#### Scenario: SessionCard does not double-render flow contributions

- **WHEN** a session card renders for a session with `session.flowState !== null`
- **THEN** the rendered DOM SHALL contain exactly ONE `FlowActivityBadge` instance (rendered via the slot)
- **AND** SHALL contain exactly ONE `SessionFlowActions` instance (rendered via the slot)
- **AND** the regression test `packages/client/src/__tests__/session-card-no-double-flow.test.tsx` SHALL pass

### Requirement: Flow callbacks flow through plugin contexts

The dashboard shell SHALL provide two React contexts that flow components consume in lieu of receiving callbacks via slot props:

- **`FlowsActionsContext`** — provided by `packages/flows-plugin/src/client/FlowsActionsContext.tsx`, carries `{ flows: FlowInfo[]; commands: CommandInfo[]; onFlowAction: (action, opts?) => void }`. Provider wraps the session list (above `SessionCard` in the tree) so that `SessionFlowActions` (rendered inside session cards) can read it.

- **`FlowActionsContext`** — provided by `packages/flows-plugin/src/client/FlowActionsContext.tsx`, carries the active-session flow control callbacks (`onAbort`, `onToggleAutonomous`, `onDismissSummary`, `onSendPrompt`, `onViewYaml`, `onViewAgentSource`, `onAgentClick`, `onPromptRespond`). Provider wraps the per-session content area so that `FlowDashboard`, `FlowArchitect`, `FlowAgentDetail`, `FlowArchitectDetail`, and `FlowSummary` can read it.

Both contexts SHALL throw a clear error when their hooks are called outside the matching provider (analogous to existing plugin-context hooks).

#### Scenario: SessionFlowActions reads from FlowsActionsContext

- **WHEN** `SessionFlowActions` renders inside `<FlowsActionsProvider value={mockFlowsActions}>`
- **THEN** the component SHALL receive `flows`, `commands`, and `onFlowAction` from the mock value
- **AND** invoking actions in the rendered UI SHALL call `mockFlowsActions.onFlowAction` with the expected arguments

#### Scenario: FlowDashboard reads from FlowActionsContext

- **WHEN** `FlowDashboard` renders inside `<FlowActionsProvider value={mockFlowActions}>` and receives `{session}` with a populated `session.flowState`
- **THEN** the component SHALL receive `onAbort`, `onToggleAutonomous`, `onDismissSummary`, etc. from the mock value
- **AND** clicking the "Abort" button SHALL call `mockFlowActions.onAbort()` exactly once

#### Scenario: Hook called outside provider throws

- **WHEN** a `FlowDashboard` instance is rendered without a wrapping `<FlowActionsProvider>`
- **THEN** the rendering SHALL throw an error with a message naming the missing provider
