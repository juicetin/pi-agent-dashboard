## Why

The redesigned session card groups related controls into translucent subcards
(OPENSPEC, WORKSPACE, PROCESS, MEMORY) with capsule-legend titles. Flow controls
do not yet have a dedicated subcard — `SessionFlowActionsClaim` from
`flows-plugin` is registered against the generic `session-card-action-bar` slot
and renders flat below the subcard stack. That arrangement misses the visual
grouping the new card design establishes, and it occupies a slot whose original
purpose (per its own runtime comment) is generic future plugins.

The MEMORY subcard already demonstrates the correct shape: a dedicated slot
(`session-card-memory`), a parent wrapper gated by `useSlotHasClaimsForSession`,
and a `shouldRender` predicate on the claim that hides the subcard cleanly when
the plugin has nothing to contribute. This change applies the same pattern to
flow controls.

## What Changes

- Add a new dashboard plugin slot id `session-card-flows` with multiplicity
  `many` and payload tier `react-only`. Slot is session-scoped (predicates
  receive `DashboardSession | null | undefined`).
- Add a new slot consumer `SessionCardFlowsSlot({ session })` to
  `packages/dashboard-plugin-runtime/src/slot-consumers.tsx`, mirroring
  `SessionCardMemorySlot`: renders both legacy refs claims and intent-store
  contributions, with `SlotErrorBoundary` per claim.
- Add a `FlowsSubcard` wrapper in `packages/client/src/components/SessionCard.tsx`
  that calls `useSlotHasClaimsForSession("session-card-flows", session)` and
  renders `<SessionSubcard title="FLOWS">` only when truthy.
- Slot the new `FlowsSubcard` into the desktop subcard stack between PROCESS
  and MEMORY (re-introducing the FLOWS subcard at its documented position in
  the existing `session-card-subcards` capability ordering).
- Move the existing `SessionFlowActionsClaim` claim in
  `packages/flows-plugin/package.json` from `session-card-action-bar` to
  `session-card-flows`, and add a `shouldRender: "shouldRenderFlowsSubcard"`
  reference.
- Add `shouldRenderFlowsSubcard` (synchronous, closed-by-default) in a new
  `packages/flows-plugin/src/client/shouldRender.ts`, exported by
  `packages/flows-plugin/src/client/index.tsx`. The predicate reads from a
  module-level per-session availability cache.
- Populate the availability cache from a module-level subscriber attached at
  plugin registration to the same per-session-data store that
  `SessionFlowActionsClaim` already consumes (`flowsList`, `commandsList`).
  This breaks the chicken-and-egg cycle where the predicate would otherwise
  depend on the component it gates being already mounted.

No wire-protocol changes. No breaking changes — adding a slot id is documented
as a minor (non-breaking) version of `pi-dashboard-shared` by
`dashboard-shell-slots`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-shell-slots`: add the `session-card-flows` slot id to the frozen
  taxonomy and the session-scoped predicate-input classification. Add
  `SessionCardFlowsSlot` to the runtime's exported slot consumers. Update the
  "Shell SHALL render all flow content via plugin slot claims" requirement to
  list `session-card-flows` as the new home for `SessionFlowActions` (instead
  of `session-card-action-bar`).
- `session-card-subcards`: re-introduce the FLOWS subcard as a wrapper-gated
  panel populated by the `session-card-flows` slot. Update the "Subcards hide
  when their content is empty" visibility table — FLOWS gate flips from
  `flows && onFlowAction && ...` (shell-owned) to "at least one
  `session-card-flows` claim whose `shouldRender(session)` returns `true`"
  (plugin-owned, matching MEMORY).

## Impact

**Code:**

- `packages/shared/src/dashboard-plugin/slot-types.ts` — add slot id, slot
  definition, predicate-input classification.
- `packages/dashboard-plugin-runtime/src/slot-consumers.tsx` — add
  `SessionCardFlowsSlot` consumer.
- `packages/dashboard-plugin-runtime/src/index.ts` — re-export the new
  consumer.
- `packages/client/src/components/SessionCard.tsx` — add `FlowsSubcard`
  wrapper, slot it between PROCESS and MEMORY, import the new consumer.
- `packages/flows-plugin/package.json` — rewire the claim slot id and add
  `shouldRender`.
- `packages/flows-plugin/src/client/shouldRender.ts` — NEW; sync predicate +
  per-session availability cache module.
- `packages/flows-plugin/src/client/index.tsx` — export the new predicate.
- `packages/flows-plugin/src/client/SessionFlowActions.tsx` — wire the cache
  populator (or attach it at plugin entry via a module-level subscriber).

**Tests:**

- `packages/client/src/components/__tests__/SessionCard.test.tsx` — add cases
  for FLOWS subcard visibility under the new gate.
- `packages/flows-plugin/src/__tests__/manifest-discoverability.test.ts` —
  assert the new slot id, the `shouldRender` reference, and that the claim
  no longer occupies `session-card-action-bar`.
- New repo-lint reassurance: existing `no-flow-references-in-shell.test.ts`
  must continue to pass — shell touches only the slot name string, never
  flow data.

**APIs / dependencies:**

- `pi-dashboard-shared` minor version bump (new slot id is additive).
- `dashboard-plugin-runtime` minor version bump (new exported consumer is
  additive).
- `flows-plugin` patch version bump (claim relocation is a behaviour change
  but the slot it migrates to is new).

**No effect on:** wire protocol, server-side state, intent-renderer code path
(both legacy refs and intent contributions render through the same consumer).
