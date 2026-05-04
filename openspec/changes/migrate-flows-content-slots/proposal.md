## Why

`extract-flows-as-plugin` (committed as `234b45c`) physically relocated the flow rendering code into `packages/flows-plugin/`, but **deliberately deferred** the JSX-to-slot-consumer migration for the "rich" slots:

- `<FlowArchitect>` and `<FlowDashboard>` rendered in App.tsx as sticky headers above the chat (today: 4 distinct conditional branches at App.tsx:884–1075).
- `<FlowAgentDetail>` rendered as a full-page content view when a flow agent is clicked.
- `<FlowArchitectDetail>` rendered as a full-page content view for the architect mode.
- `<FlowYamlPreview>` rendered as a full-page content view for flow YAML inspection (uses `MarkdownPreviewView` shape).
- `<FlowSummary>` rendered inline below the chat as a post-completion banner.

The blocker named in `extract-flows-as-plugin/design.md` Decision 2 + Decision 3:

> "The frozen v0.x `<ContentHeaderStickySlot session={session}/>` and `<ContentInlineFooterSlot session={session}/>` consumers only thread `{session}` to claims, but the flow components need `flowState`, `onAgentClick`, `onAbort`, `onToggleAutonomous`, `onDismissSummary`, `onViewYaml`, `onViewAgentSource`, etc. Wiring those through slots would require either extending the frozen slot prop contract (a minor bump on `dashboard-shell-slots`) or refactoring the components to derive everything from session state + plugin context."

This proposal picks the **second path** (refactor for self-derivation) and lands the migration. It also handles the parallel `<FlowLaunchDialog>` which sits in App.tsx command-router code (`/flows`, `/flows:new`, `/flows:edit`, `/flows:delete`) and has the same prop-threading problem.

`migrate-flows-jsx-to-slots` (already scaffolded, separate proposal) handles the **session-card** slots only (`session-card-badge` + `session-card-action-bar`) and the predicate-emission gap. This proposal is the **complementary** richer-slot migration and explicitly does not duplicate that work.

## What Changes

### Component refactors (self-derivation pattern)

- **MODIFY** `packages/flows-plugin/src/client/FlowDashboard.tsx`:
  - Switch entry signature to `({ session }: { session: DashboardSession })`.
  - Internally derive `flowState`, `flowStates` from `session` (session-state shape established by `event-reducer.ts`).
  - Pull command callbacks (`onAbort`, `onToggleAutonomous`, `onDismissSummary`, `onViewYaml`, `onViewAgentSource`, `onAgentClick`) from a new `FlowActionsContext`.
  - Self-gate: return `null` when `session.flowState == null`.

- **MODIFY** `packages/flows-plugin/src/client/FlowArchitect.tsx`:
  - Same shape: `({ session }: { session: DashboardSession })`.
  - Derive `architectState` from `session`. Self-gate on `session.architectState != null`.
  - Callbacks (`onAbort`, `onPromptRespond`, `onViewYaml`, `onViewAgentSource`) come from `FlowActionsContext`.

- **MODIFY** `packages/flows-plugin/src/client/FlowAgentDetail.tsx`:
  - Switch to `({ session, routeParams, onClose }: SlotProps<"content-view">)`.
  - Derive `agent` from `session.flowState?.agents.get(routeParams.agentId)`. Self-gate.

- **MODIFY** `packages/flows-plugin/src/client/FlowArchitect.tsx → FlowArchitectDetail`:
  - Switch to `({ session, onClose }: SlotProps<"content-view">)`. Derive `architectState` from session.

- **MODIFY** `packages/flows-plugin/src/client/FlowSummary.tsx`:
  - Switch to `({ session }: { session: DashboardSession })`. Derive `flowState` from session. Self-gate on `flowState.status === "complete" || "error"`.
  - `onDismissSummary` callback comes from `FlowActionsContext`.

- **NEW** `packages/flows-plugin/src/client/FlowYamlPreview.tsx` (extracted from `App.tsx`):
  - Today the `flowYamlPreview` state and JSX live in App.tsx (~lines 236–700, scattered). Extract into a dedicated component claiming `content-view` route `flow-yaml/:flowName`.
  - Self-derives content from session state + a new `useFlowYamlContent(session, routeParams)` hook (or a server-side fetch if the YAML isn't cached on session).

- **NEW** `packages/flows-plugin/src/client/FlowActionsContext.tsx`:
  - `FlowActionsContext` carrying `{ onAbort, onToggleAutonomous, onDismissSummary, onViewYaml, onViewAgentSource, onPromptRespond, onAgentClick, onArchitectDetailOpen, onFlowAgentDetailOpen }`.
  - Provider mounted in `App.tsx` wrapping the slot-consumer subtree.
  - Hook `useFlowActions()` returning the context value.

- **MOVE** `<FlowLaunchDialog>` invocation logic from App.tsx into a plugin-local `FlowsCommandHandler` component:
  - Today App.tsx has ~80 LOC of `flowPickerOpen / flowNewOpen / flowEditPickerOpen / flowDeletePickerOpen / flowLaunchTarget` state machinery driving the `/flows*` commands.
  - Move into `packages/flows-plugin/src/client/FlowsCommandHandler.tsx`. Either claim a new slot kind (`command-route` for `/flows`, `/flows:new`, etc.) or — if the `command-route` semantics don't match (those modals aren't full-page views) — claim `anchored-popover` or define a plugin-local invisible component that subscribes to the command stream.
  - **Open question**: which slot is the right home for ephemeral modal dialogs triggered by slash commands? See Open Questions below.

### Slot consumer payload contract (no breaking changes)

- **NO CHANGE** to `packages/shared/src/dashboard-plugin/slot-types.ts` (frozen v0.x). The slot consumers continue to pass `{session}` to their claims. All adaptation happens in the components and the new context.

- **VERIFY** `packages/dashboard-plugin-runtime/src/slot-consumers.tsx → ContentViewSlot`:
  - Today emits `{session, routeParams, onClose}`. flow-agent-detail / architect-detail / flow-yaml all need `routeParams` to identify which agent / yaml is being viewed. Confirm shape is sufficient.

### Manifest restoration

- **MODIFY** `packages/flows-plugin/package.json`:
  - Add the deferred claims (already prepared as comments in `//pi-dashboard-plugin-deferred-claims` per the parent proposal):
    - `{ slot: "content-header-sticky", component: "FlowArchitect", priority: 10, predicate: "hasArchitect" }`
    - `{ slot: "content-header-sticky", component: "FlowDashboard", priority: 20, predicate: "hasFlow" }`
    - `{ slot: "content-view", component: "FlowAgentDetail", command: "flow-agent-detail/:agentId" }` (route binding TBD per Open Question 2)
    - `{ slot: "content-view", component: "FlowArchitectDetail", command: "architect-detail" }`
    - `{ slot: "content-view", component: "FlowYamlPreview", command: "flow-yaml/:flowName" }`
    - `{ slot: "content-inline-footer", component: "FlowSummary", predicate: "hasFlowResult" }`
  - Export `hasArchitect`, `hasFlow`, `hasFlowResult` predicates from `packages/flows-plugin/src/client/index.tsx`.

### Shell cleanup

- **MODIFY** `packages/client/src/App.tsx`:
  - Remove all 4 conditional `<FlowArchitect>` / `<FlowDashboard>` JSX branches (lines ~884–1075). The slot consumers `<ContentHeaderStickySlot session={selectedSession}/>` (already mounted at line 1078) pick up rendering.
  - Remove `<FlowAgentDetail>` and `<FlowArchitectDetail>` JSX branches. Replace with `<ContentViewSlot session={selectedSession} routeParams={routeParams} onClose={...}/>` (already mounted at line 1614 — verify it covers all detail-view paths).
  - Remove `<FlowSummary>` mounting (currently inside `<FlowDashboard>` itself + bottom-of-chat in some branches). The slot consumer `<ContentInlineFooterSlot/>` (already at line 1149) takes over.
  - Remove `flowDetailAgent`, `architectDetailOpen`, `flowYamlPreview` state — replaced by route navigation through `pluginRouter`.
  - Remove the `/flows` command-router state (flowPickerOpen, flowNewOpen, etc.) — moved to `FlowsCommandHandler`.
  - Wrap subtree in `<FlowActionsContext.Provider value={...}>`.
  - Net: ~250 LOC reduction in App.tsx (the original aspirational goal of `extract-flows-as-plugin`, now realized).

- **VERIFY** `packages/client/src/components/MobileShell.tsx`:
  - Confirm it correctly routes through the slot consumers on mobile. Update sticky-header positioning if needed (today's mobile path may have flow-aware behavior).

### Slot fallback guardrail (apply Section 7 of the parent change)

- **APPLY** the `getClaims().length > 0` gate around any slot consumer mounted inside a `??` fallback chain in App.tsx, per `fix-slot-fallback-masks-content`.
- **UPDATE** `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts → SCAN_FILES` to include any newly-touched shell file.

### Tests (apply Section 8.2 + 8.3 of the parent change)

- **NEW** `packages/flows-plugin/src/__tests__/plugin-disabled.test.tsx`:
  - Mount the dashboard with `plugins.flows.enabled = false`. Dispatch `flow_started` + `flow_complete` events. Assert: zero `FlowDashboard` / `FlowActivityBadge` / `FlowSummary` / `FlowAgentDetail` DOM nodes.

- **NEW** `packages/flows-plugin/src/__tests__/sticky-header-stack.test.tsx`:
  - Mount a session with both `flowState` (running) and `architectState` (replanning) populated. Assert sticky header DOM order: architect on top, flow dashboard below. Pixel-identical to the pre-extract-flows-as-plugin baseline (snapshot or layout assertion).

- **NEW** `packages/flows-plugin/src/__tests__/content-view-routing.test.tsx`:
  - Navigate to `flow-agent-detail/researcher`, `architect-detail`, `flow-yaml/research` routes via `pluginRouter`. Assert each renders the correct claim's component with the expected `routeParams`.

- **NEW** `packages/flows-plugin/src/__tests__/flow-actions-context.test.tsx`:
  - Render `<FlowDashboard>` outside the provider. Assert it either throws (strict mode) or renders the empty fallback. Render inside provider: assert callbacks fire correctly.

- **MODIFY** existing tests (`flow-reducer.test.ts`, `architect-reducer.test.ts`): no changes — reducer contract unchanged.

## Capabilities

### Modified Capabilities

- `flows-plugin` — adds requirements for: self-deriving session-shaped components, FlowActionsContext, plugin-disabled empty-render guarantee, sticky-header stack ordering, content-view route binding for the three detail views.

### New Capabilities

None. This proposal completes the slot wiring for an existing capability.

## Impact

**Code touched (estimated):**

- `packages/flows-plugin/src/client/FlowDashboard.tsx` — refactor signature + self-derive, ~30 LOC delta.
- `packages/flows-plugin/src/client/FlowArchitect.tsx` (covers FlowArchitect + FlowArchitectDetail) — ~40 LOC delta.
- `packages/flows-plugin/src/client/FlowAgentDetail.tsx` — ~20 LOC delta.
- `packages/flows-plugin/src/client/FlowSummary.tsx` — ~15 LOC delta.
- `packages/flows-plugin/src/client/FlowYamlPreview.tsx` — NEW file, ~80 LOC.
- `packages/flows-plugin/src/client/FlowActionsContext.tsx` — NEW file, ~30 LOC.
- `packages/flows-plugin/src/client/FlowsCommandHandler.tsx` — NEW file, ~120 LOC (extracted from App.tsx).
- `packages/flows-plugin/src/client/index.tsx` — export new predicates + components, ~10 LOC.
- `packages/flows-plugin/package.json` — restore 6 claims, ~20 LOC delta.
- `packages/client/src/App.tsx` — remove ~250 LOC of conditional JSX + state + add provider wrap, **net -200 LOC**.
- `packages/client/src/components/MobileShell.tsx` — verify, possibly tweak ~10 LOC.
- 4 new test files, ~250 LOC total.

**Behavior changes:**

- App.tsx becomes flow-agnostic: zero direct imports of any flow component, zero conditional `if flowState`/`if architectState` JSX branches.
- Disabling the plugin via config (`plugins.flows.enabled = false`) takes the entire flow UI offline — empty slots, no DOM nodes, no errors when `flow_*` events arrive.
- Sticky-header stacking order preserved by manifest priority (FlowArchitect priority 10, FlowDashboard priority 20). Verified by regression test.
- The `/flows*` slash commands still work, but their UI lives inside `FlowsCommandHandler` (a plugin component), not in App.tsx state.

## Migration Risks

- **Self-derivation breaks edge cases.** Components today receive props that may not be derivable from `session` alone (e.g. `onAbort` is a closure over `selectedId` + `send`). The `FlowActionsContext` provider must be constructed at App level with the right closures. **Mitigation:** type the context strictly; the migration test (`flow-actions-context.test.tsx`) asserts every callback fires correctly when wired.
- **`/flows*` command flow extraction.** The command-router state machine is intricate — `selectedFlows`, `sessionFlows.get(selectedId)`, the picker → confirm → launch flow. Moving it out of App.tsx risks a behavior delta. **Mitigation:** unit-test the extracted `FlowsCommandHandler` against a synthetic command stream; smoke-test the four commands manually before archive.
- **`content-view` route binding mechanism.** The current `ContentViewSlot` doesn't appear to filter claims by route — it just renders the first one. With three flow `content-view` claims (agent-detail, architect-detail, yaml), the consumer needs route-aware filtering. **Mitigation:** verify the consumer's behavior; if route filtering doesn't exist, this proposal grows to add it (a minor bump on `dashboard-shell-slots`). See Open Question 2.
- **Mobile path divergence.** `MobileShell.tsx` may have flow-aware swipe transitions or layout. Slot consumers must work identically on mobile. **Mitigation:** explicit mobile test pass during implementation; expand `useMobile` hook to plug into the actions context if needed.
- **FlowYamlPreview content fetching.** Today `App.tsx → openFlowYaml` fetches YAML from the server (when not cached on `architectState.flowYamlContent`). The extracted `FlowYamlPreview` needs the same fetch. **Mitigation:** introduce `useFlowYamlContent` hook inside the plugin; expose the fetcher via `pluginContext.send` or a server REST call.
- **Removal of App.tsx state precludes rollback.** Once `App.tsx` loses `flowDetailAgent`, `architectDetailOpen`, etc., the only way to roll back is to revert the entire change. **Mitigation:** ship behind a feature flag — actually no, the slot system already provides this: `plugins.flows.enabled = false` reverts behavior to "no flow UI", which is the rollback semantic.

## Open Questions

1. **Slash command modal dispatch.** What slot kind hosts plugin-owned slash command modals (`/flows:new` opens `FlowLaunchDialog`)? `command-route` is for full-page content views. `anchored-popover` is for trigger-anchored UIs. Neither matches an ephemeral modal triggered by a typed command. Options: (a) extend `command-route` semantics to support modal claims, (b) introduce a new `command-modal` slot, (c) keep `FlowsCommandHandler` as a plugin-local invisible subscriber to the command stream (no slot, just a React effect). Leaning toward (c) for v1.
2. **`ContentViewSlot` route filtering.** Today the consumer renders the first matching `content-view` claim with no route discrimination. With three flow `content-view` claims, we need route-aware filtering. Is route filtering already implemented elsewhere (`CommandRouteSlot` does filter by `command`) and just missing here? Or does this proposal need to extend the consumer? **Investigation required before tasks land.**
3. **`FlowYamlPreview` fetch path.** The current implementation calls `getServerUrl() + /api/flow-source` directly from App.tsx. Should the plugin call this REST endpoint via `pluginContext.send` (WebSocket-bridged), or via a direct `fetch()` (HTTP)? Pi context is a WS-first system; direct fetches break the contract. Confirm during implementation.
4. **`extension-ui-system` BreadcrumbSlot dependency.** `FlowDashboard` consumes `<BreadcrumbSlot>` from `packages/client/src/components/extension-ui/`. After self-derivation, that import stays cross-package (deep relative path). Document or promote to shared. Track as v1 debt continuation.

## References

- Parent change: `openspec/changes/archive/extract-flows-as-plugin/` (commit `234b45c`) — design.md Decision 2/3 + tasks.md Section 6/7/8.2/8.3 (deferred items).
- Sibling proposal handling session-card slots: `openspec/changes/migrate-flows-jsx-to-slots/proposal.md` (badge + action-bar + predicate emission).
- Slot consumer source: `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`.
- Slot taxonomy (frozen): `packages/shared/src/dashboard-plugin/slot-types.ts`.
- Co-tenancy + visual regression rule: `openspec/changes/archive/2026-04-26-add-dashboard-shell-slots-runtime/`.
- Slot fallback hardening: `openspec/changes/archive/fix-slot-fallback-masks-content/` + `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts`.
