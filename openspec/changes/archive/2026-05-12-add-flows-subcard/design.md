## Context

The dashboard's desktop session card is composed of subcards introduced in
`session-card-subcards`:

```
+- SessionCard -----------------------+
|  (header: status icon, name, time)  |
|  +- SessionSubcard "OPENSPEC" -+    |
|  +- SessionSubcard "WORKSPACE" -+   |
|  +- SessionSubcard "PROCESS" -+     |
|  +- SessionSubcard "MEMORY" -+      |
|  <SessionCardActionBarSlot/> (loose)|
+-------------------------------------+
```

Robert's recent change `auto-hide-empty-session-subcards` made MEMORY (and
the WORKSPACE badge/actions sub-region) hide cleanly when no plugin has
anything to contribute. The mechanism is twofold:

1. `useSlotHasClaimsForSession(slotId, session)` — a wrapper-gate hook that
   counts claims **after** applying both `predicate(session)` and
   `shouldRender(session)`. The wrapper subcard hides when count is `0`.
2. `ClaimEntry.shouldRender?(input)` — a sync predicate declared at the
   manifest level, resolved by the vite plugin to a real function. Runs
   alongside `predicate` but at the wrapper-gate layer so claims whose
   component would render `null` count as absent.

Today, flow controls live in `flows-plugin` at the
`session-card-action-bar` slot and render directly below the subcard
stack (not inside a subcard). The original `session-card-subcards` spec
*does* enumerate FLOWS as the fifth subcard, but no implementation has yet
wired it as such — the FLOWS row inside `SessionCard.tsx` was previously
removed in change `pluginize-flows-via-registry` and replaced by the loose
action bar.

This change closes that gap by minting a dedicated slot for flow
contributions and re-introducing the FLOWS subcard as a thin
wrapper-gated panel, mirroring MEMORY 1:1.

## Goals / Non-Goals

**Goals:**

- Re-introduce a FLOWS subcard with the same visual treatment as the
  other subcards, populated entirely by `flows-plugin`.
- Hide the FLOWS subcard cleanly when the session has no flows AND no
  `flows:new` command (matching legacy `SessionFlowActions` null-guard).
- Free up `session-card-action-bar` to be the generic future-plugins
  slot its runtime comment already describes.
- Preserve every existing flow button (Run / New / Edit / Delete) and
  their dialogs unchanged.
- Mechanical change only — no new patterns, no new infrastructure.

**Non-Goals:**

- Migrating `SessionFlowActions` to the server-driven intent renderer.
  The existing claim-component path continues to handle flow buttons;
  intent path remains dormant (tracked by the wider follow-up in
  `adopt-server-driven-intent-rendering` §29 FOLLOW-UP).
- Adding any new flow capability, button, dialog, or interaction.
- Touching `session-card-action-bar`'s spec or runtime — only its
  occupancy by `flows-plugin` changes.
- Migrating the mobile session card. Mobile retains its flat row layout
  per the existing `session-card-subcards` requirement.

## Decisions

### D1. Add a dedicated slot id `session-card-flows` (vs. reusing `session-card-action-bar`)

**Choice:** Mint a new slot `session-card-flows`.

**Why:** A subcard title implies semantic ownership — "FLOWS" belongs in
a slot named `session-card-flows`, not in a generic `action-bar` slot
that could in principle host any plugin's contribution. Reusing the
action-bar slot would force a misleading title onto future co-tenant
plugins, or force the subcard's title to be data-driven and fragile.

**Alternative considered:** Keep the claim on `session-card-action-bar`
and wrap that slot consumer in a `<SessionSubcard title="FLOWS">`. The
slot is already known to have no other claimers today. Rejected because
it permanently couples the slot's *generic future* purpose to a *flow-
specific* title; any new plugin contributing to it would inherit a
FLOWS header.

**Cost:** Six files vs. three. Manageable, all mechanical.

### D2. `shouldRender` cache scope: per-session

**Choice:** Module-level `Map<sessionId, boolean>` (not a single global
boolean).

**Why:** Honcho's gate is global — the extension is installed or it
isn't, system-wide. Flow availability is per-session — session A may
have `flowsList` populated, session B may have none. The cache must
therefore be keyed by session id.

```ts
const flowsAvailability = new Map<string, boolean>();
export function getFlowsAvailabilitySync(sessionId: string): boolean {
  return flowsAvailability.get(sessionId) ?? false;
}
export function setFlowsAvailability(sessionId: string, has: boolean): void {
  flowsAvailability.set(sessionId, has);
}
```

Default-on-miss is `false` (closed-by-default), matching the cache
contract documented in `dashboard-plugin-loader` for `shouldRender`.

### D3. Cache population: module-level subscriber at plugin registration

**Choice:** Subscribe to the per-session-data store ONCE at plugin
registration (in `flows-plugin`'s client entry), independent of any
component being mounted.

**Why:** If population happens inside `SessionFlowActionsClaim` via a
`useEffect`, the cache is empty until the component mounts — but
`shouldRender` is what decides whether the component mounts. That's a
chicken-and-egg cycle: the subcard hides forever because the cache is
empty, but the cache stays empty because the subcard never lets the
component mount.

`useSessionData` (provided by `dashboard-plugin-runtime`) already exposes
the underlying store. The plan: import the non-hook accessor (a
`subscribe(sessionId, callback)` or equivalent) and register a single
listener at plugin entry. Each `flowsList` / `commandsList` update
recomputes availability for the session and writes to the cache.

**Open question:** the exact non-hook subscription API on the
`PerSessionDataStore` is something we need to confirm during
implementation (see Open Questions §Q1). Worst case, we add a
`subscribe` method to the store.

**Alternative considered:** A hidden always-mounted "FlowsAvailabilityProbe"
component, rendered from the plugin's manifest at the
`hidden-utility` slot — but no such slot exists, inventing one for one
plugin's bookkeeping is the wrong move. Rejected.

### D4. Subcard placement order

**Choice:** Insert FLOWS between PROCESS and MEMORY:

```
OPENSPEC → WORKSPACE → PROCESS → FLOWS → MEMORY
```

**Why:** The original `session-card-subcards` spec enumerates the order
as OPENSPEC / WORKSPACE / PROCESS / MEMORY / FLOWS — FLOWS last. We
deliberately deviate: FLOWS describes *agent activity for this session*,
which thematically clusters with PROCESS (running child processes).
MEMORY (Honcho's persistent state) reads better as the final, more
abstract concern. We will update the `session-card-subcards` spec to
reflect the new order.

**Trade-off:** Diverging from the original recorded order is a small
semantic claim that wants to be defended in the spec update. The
visibility-table row order in that spec moves correspondingly.

### D5. Visibility table row for FLOWS

**Choice:** Mirror MEMORY exactly:

> FLOWS subcard renders only when at least one `session-card-flows`
> claim's `shouldRender(session)` returns `true`. Claims without
> `shouldRender` are treated as always rendering.

**Why:** Identical contract to MEMORY allows shared tests and a single
mental model. No special FLOWS-specific gate, no shell-side flow
introspection.

### D6. Keep the existing `SessionFlowActionsClaim` component intact

**Choice:** Move the claim's slot id; do not modify the component's
React code beyond import-path adjustments.

**Why:** Surgical scope. The component already returns `null` when
unavailable; the new `shouldRender` gate hides the *subcard* without
needing the component to change behaviour. The actual buttons, dialogs,
and `usePluginSend` wiring remain identical.

## Risks / Trade-offs

- **[Risk] Cache flicker on first paint when no subscriber has yet fired.**
  → Mitigation: closed-by-default. First render shows no FLOWS subcard
  even if data is en route. Once the subscriber writes `true`, the
  component re-renders and the subcard appears. This matches honcho's
  approach for its installation probe. The flicker is one direction
  (hidden → visible), never the inverse, which is the user-friendly
  direction.

- **[Risk] The cache subscriber may not be cleaned up if the plugin is
  unloaded / replaced at runtime.**
  → Mitigation: register the subscriber in a module-level
  `setUpFlowsCache()` function that returns the unsubscribe fn; call it
  during the plugin's client-entry initialization (one-time, idempotent
  via a guard flag). Plugin unloading at runtime is not a supported
  scenario today, so we accept the residual leak risk for now.

- **[Risk] Diverging from the spec's recorded subcard order may surprise
  contributors used to MEMORY-last.**
  → Mitigation: update `session-card-subcards` spec in the same change.
  The order is enforced by the spec, not by code, so the source of truth
  moves cleanly.

- **[Trade-off] Adding a slot id requires a `pi-dashboard-shared` minor
  bump.** Cheap; the slot taxonomy already documents this as the
  intended versioning policy.

- **[Trade-off] Six files touched vs. three for the Path-B
  alternative.** The extra cost is worth the taxonomy hygiene; all six
  edits are mechanical and follow MEMORY's pattern verbatim.

## Migration Plan

The change is additive on the slot side and a single-slot relocation on
the plugin side:

1. Ship the new slot id, consumer, and wrapper without modifying
   `flows-plugin`. With no claim on the new slot, `FlowsSubcard` is
   inert. Existing flow buttons continue to render via the old
   action-bar path. Zero user-visible change.

2. Then update `flows-plugin/package.json` to point the claim at the
   new slot id, add the `shouldRender` ref, and ship the cache. The
   FLOWS subcard appears on cards where flows are available.

Steps 1 and 2 can be a single PR because:
- The two halves are in different packages with no circular dep.
- A rollback only needs the `package.json` slot id reverted; the
  shell-side additions are idle.

**Rollback:** revert the `flows-plugin/package.json` claim relocation;
the slot remains defined but empty. The action-bar position is restored.

## Open Questions

**Q1. What's the public API for non-hook subscription to
`PerSessionDataStore`?**

`useSessionData(sessionId, key)` is the React-hook entry point. We need
a counterpart usable from a module-level `setUpFlowsCache()` — something
like `subscribeSessionData(sessionId, key, listener)` plus
`getSessionDataSync(sessionId, key)`. If the store lacks such an API,
the lightest extension is to expose its underlying subscription on the
runtime package's public surface.

To resolve: read `packages/dashboard-plugin-runtime/src/session-data-store.ts`
during implementation. If the surface is private, add a minimal
exported helper as part of this change (still mechanical, no behaviour
change for existing consumers).

**Q2. Should `shouldRender` be plugin-static (depends only on `session.id`)
or session-mutable (re-evaluated on every render)?**

Today's `shouldRender` runs synchronously and *reads* a sync cache; the
cache mutates. The hook (`useSlotHasClaimsForSession`) will not re-run
`shouldRender` unless something else triggers re-render. We need to
confirm that updates to `intentStore` / data store cause card re-render
via the existing event/data subscription chain in `useMessageHandler`.
The existing MEMORY/honcho path works the same way; if it works there,
it will work here. Worth a confirming look during implementation.

**Q3. Subcard order — keep PROCESS → FLOWS → MEMORY, or
revert to the spec's PROCESS → MEMORY → FLOWS?**

Decision is D4 above. Worth re-confirming with the spec maintainer; if
they prefer the original order, the change is a one-line edit in
`SessionCard.tsx` and a one-line edit in the spec delta.
