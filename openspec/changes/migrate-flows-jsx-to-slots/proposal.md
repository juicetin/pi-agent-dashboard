## Why

`wire-plugin-registry-into-shell` (recently landed) populates the slot registry from the build-time generated `PLUGIN_REGISTRY`. During its inventory phase it surfaced **two structural mismatches** that blocked full wiring of the flows-plugin contributions and forced a scope-down:

1. **Component prop contracts don't match the slot consumer.**
   - `<SessionCardBadgeSlot>` and `<SessionCardActionBarSlot>` invoke each claim's component as `<Component session={session} />`.
   - `FlowActivityBadge({ flowName, agentsDone, agentsTotal, status })` requires explicit flow-state props that today are plucked from `session` by `SessionCard.tsx` and passed through.
   - `SessionFlowActions({ flows, hasFlowsNew, hasFlowsEdit, hasFlowsDelete, onFlowAction })` requires app-level state and callbacks (the `flows` array and the `onFlowAction` dispatcher) which today live in `App.tsx` and are threaded down via `SessionList → SessionCard`.
   - Result: feeding `{session}` into either component produces undefined required props, so wiring the slot would visibly break the badge and crash the action bar.

2. **The vite-plugin does not emit the `predicate` field into the generated registry.**
   - flows-plugin's `session-card-badge` claim has `"predicate": "hasActiveFlow"`.
   - `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts → generateRegistryContent` emits only `pluginId, priority, slot, tab, toolName, command, Component` per claim — no `predicate`.
   - Without a predicate, `forSession(claims, session)` would render the badge for **every** session, not only those with an active flow.

`wire-plugin-registry-into-shell` resolved this by **temporarily emptying** flows-plugin's manifest claims (preserved under `//pi-dashboard-plugin-deferred-claims`) and **keeping the legacy direct JSX** in `SessionCard.tsx`. flows now bypasses the slot system entirely, while jj-plugin (whose components self-gate and accept `{session}`) ships through slots cleanly.

This proposal closes the loop: adapt the two flows components to the slot prop contract, fix the predicate emission gap once and for all, restore the flows-plugin claims, and remove the legacy direct JSX.

## What Changes

### Component shape

- **MODIFY** `packages/flows-plugin/src/client/FlowActivityBadge.tsx`:
  - Add an overload (or wrapper) accepting `{ session }: { session: DashboardSession }`. Self-gate on `session.activeFlowName`; return `null` when absent.
  - Internally derive `flowName, agentsDone, agentsTotal, status` from `session`.
  - Keep the existing explicit-prop signature available **only if** another caller still uses it (otherwise drop). Default export becomes the session-shaped form.

- **MODIFY** `packages/flows-plugin/src/client/SessionFlowActions.tsx`:
  - Switch to `{ session }: { session: DashboardSession }` shape.
  - Pull `flows` and `onFlowAction` from a new React context (`FlowsActionsContext`) provided at the App level. `hasFlowsNew/Edit/Delete` come from a `commands` array also surfaced via context (or via `session.commands` if available).
  - Self-gate: return `null` when `flows.length === 0 && !hasFlowsNew`.

- **ADD** `packages/flows-plugin/src/client/FlowsActionsContext.tsx`:
  - `FlowsActionsContext` carrying `{ flows, commands, onFlowAction }`. `App.tsx` becomes the provider.
  - Hooks: `useFlowsActions()` returning the context value; throws (or returns a safe empty default) when consumed outside the provider.

### Predicate emission (one-shot fix to the generated registry)

- **MODIFY** `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts`:
  - Emit the `predicate` token from each claim into the generated `ClaimEntry`. Two viable shapes:
    - **Token + lookup**: emit `predicate: "hasActiveFlow"` as a string and have a runtime resolver in `slot-registry.ts` look up the function on the plugin's client export. Requires a registration step at startup.
    - **Direct named import**: emit `predicate: hasActiveFlow` referencing a named export from the plugin's client entry (analogous to how `Component` is already emitted). Cleaner; no extra resolver step.
  - Recommended: **direct named import** — it mirrors the existing `Component` emission and stays tree-shake-friendly.
  - Validate at generation time that the named export exists; fail loudly with a clear message if not.

- **MODIFY** `packages/dashboard-plugin-runtime/src/slot-registry.ts`:
  - `ClaimEntry.predicate` already exists as `(props: unknown) => boolean`. No change needed; the vite-plugin output now binds it to a real function reference.
  - `forSession` / `forFolder` already filter by predicate — already correct.

### Manifest restoration

- **MODIFY** `packages/flows-plugin/package.json`:
  - Restore the two claims under `pi-dashboard-plugin.claims`:
    - `{ slot: "session-card-badge", component: "FlowActivityBadge", predicate: "hasActiveFlow" }`
    - `{ slot: "session-card-action-bar", component: "SessionFlowActions" }`
  - Remove the `//pi-dashboard-plugin-deferred-claims` comment field.

### Shell cleanup

- **MODIFY** `packages/client/src/components/SessionCard.tsx`:
  - Remove the two direct `<FlowActivityBadge>` JSX sites (mobile-compact list at line ~434 and desktop card at line ~615).
  - Remove the direct `<SessionFlowActions>` JSX site (line ~660).
  - Remove the now-unused `FlowActivityBadge`/`SessionFlowActions` imports from `@blackbelt-technology/pi-dashboard-flows-plugin/client`.
  - The flow JSX moves entirely to slots — `<SessionCardBadgeSlot>` and `<SessionCardActionBarSlot>` are already mounted in the file.

- **MODIFY** `packages/client/src/App.tsx`:
  - Wrap the relevant subtree in `<FlowsActionsContext.Provider value={{ flows, commands, onFlowAction }}>` so `<SessionFlowActions>` can pull state.

### Tests

- **ADD** `packages/flows-plugin/src/client/__tests__/FlowActivityBadge-session-shape.test.tsx`:
  - Renders the badge with sessions of varying `activeFlowName` / `flowStatus` shapes; asserts gating + content.

- **ADD** `packages/flows-plugin/src/client/__tests__/SessionFlowActions-context.test.tsx`:
  - Renders the actions inside a `FlowsActionsContext.Provider`; asserts the buttons behave; asserts `null` when context's `flows` is empty and no `flows:new` command.

- **MODIFY** `packages/client/src/__tests__/plugin-registry-populated.test.ts`:
  - Drop the "tolerates empty-claim entries" easing: every entry MUST now have ≥1 claim again (since flows is restored).

- **ADD** `packages/dashboard-plugin-runtime/src/__tests__/vite-plugin-predicate-emission.test.ts`:
  - Run `generateRegistryContent` against a synthetic manifest set; assert the output contains the `predicate` named import + binding.

- **ADD** `packages/client/src/__tests__/session-card-no-double-flow.test.tsx`:
  - Renders a flow-active session through both the legacy code path (with all imports intact) and the new path; asserts only one `FlowActivityBadge` DOM node.

### Spec deltas

- **MODIFIED** `dashboard-plugin-loader` capability:
  - The "Vite plugin generates a static plugin registry" requirement gains a sub-clause covering predicate emission: claims with a `predicate` field in the manifest SHALL emit a named-import binding + `predicate: <Fn>` entry into the generated `ClaimEntry`.

## Capabilities

### Modified Capabilities

- `dashboard-plugin-loader` — clarifies predicate emission in the generated registry.

### New Capabilities

None. This is a follow-up that completes the wiring established by `wire-plugin-registry-into-shell`.

## Impact

**Code touched (estimated):**

- `packages/flows-plugin/src/client/FlowActivityBadge.tsx` — refactor signature, ~20 LOC.
- `packages/flows-plugin/src/client/SessionFlowActions.tsx` — refactor signature + context consumption, ~30 LOC.
- `packages/flows-plugin/src/client/FlowsActionsContext.tsx` — new file, ~20 LOC.
- `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts` — predicate emission, ~10 LOC.
- `packages/flows-plugin/package.json` — restore 2 claims, remove deferral comment.
- `packages/client/src/components/SessionCard.tsx` — remove 3 JSX sites + 1 import line, ~15 LOC delta.
- `packages/client/src/App.tsx` — wrap with FlowsActionsContext.Provider, ~5 LOC.
- `packages/client/src/__tests__/plugin-registry-populated.test.ts` — re-tighten assertion.
- 3 new test files, ~100 LOC total.
- `openspec/specs/dashboard-plugin-loader/spec.md` — text edits.

**Behavior changes:**

- `FlowActivityBadge` rendered on flow-active session cards via `<SessionCardBadgeSlot>` exactly once. Position moves from above OpenSpec actions (where direct JSX rendered it today) to below, into the slot area — same visual position the jj badges adopted in `wire-plugin-registry-into-shell`.
- `SessionFlowActions` rendered via `<SessionCardActionBarSlot>` exactly once.
- All future plugins that declare `predicate` in their manifest get session/folder filtering for free, without per-component self-gating.

## Migration Risks

- **Context boundary leaks.** `SessionFlowActions` is rendered inside `<SessionCardActionBarSlot>`, which is itself rendered inside `SessionCard`. The provider must wrap a parent of `SessionList` (where session cards are mounted). If misplaced, every flow action button silently no-ops. **Mitigation:** unit test asserts the action bar throws (or renders a clear empty state) when consumed outside the provider, and a runtime sanity assert in `App.tsx` ensures the provider wraps the slot consumer tree.
- **Predicate name resolution.** Emitting `predicate: hasActiveFlow` as a named import requires the plugin's client entry to export `hasActiveFlow`. If a typo ships, vite generation fails — caught at build time, no runtime regression. **Mitigation:** validate at `generateRegistryContent` time and emit `console.error` + non-zero exit on missing named export.
- **Double-render during migration.** If the manifest claims are restored BEFORE the direct JSX is removed (or vice versa), users see two badges briefly. **Mitigation:** the tasks order ships both edits in the same PR; `session-card-no-double-flow` regression test guards against drift.
- **Test environment for context.** `SessionCard.test.*` files must wrap their renders in `FlowsActionsContext.Provider`. **Mitigation:** add a test util `renderWithFlowsContext(...)` to keep call sites concise.
- **Legacy callers of explicit-prop FlowActivityBadge.** If any non-shell file imports the explicit form, refactor breaks them. **Mitigation:** a quick `rg` sweep for `FlowActivityBadge` use sites; the only known consumer is `SessionCard.tsx`.

## References

- Parent change (this proposal closes its deferred items): `openspec/changes/wire-plugin-registry-into-shell/proposal.md` + `tasks.md` (sections 5.1, 5.2 marked DEFERRED).
- Slot consumer prop contract: `packages/dashboard-plugin-runtime/src/slot-consumers.tsx → SessionCardBadgeSlot, SessionCardActionBarSlot`.
- Generated registry shape: `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts → generateRegistryContent`.
- Predicate spec (already exists, unbound today): `packages/dashboard-plugin-runtime/src/slot-registry.ts → ClaimEntry.predicate`, `forSession`, `forFolder`.
- Co-tenancy guarantee + visual-regression rule: `openspec/changes/archive/2026-04-26-add-dashboard-shell-slots-runtime/tasks.md`.
- Slot fallback hardening lint: `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts`.
