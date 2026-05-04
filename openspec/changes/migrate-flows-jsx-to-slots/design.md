# Design

## Decision 1: `FlowActivityBadge` accepts `{ session }` and self-gates

**Why:** The slot consumer renders `<Component session={session} />` (see `packages/dashboard-plugin-runtime/src/slot-consumers.tsx → SessionCardBadgeSlot`). Adapting the component to that shape makes it slot-compatible without runtime gymnastics in the consumer.

**Shape:**

```tsx
// packages/flows-plugin/src/client/FlowActivityBadge.tsx
import type { DashboardSession } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export function FlowActivityBadge({ session }: { session: DashboardSession }) {
  if (!session.activeFlowName) return null;
  const flowName = session.activeFlowName;
  const status = session.flowStatus ?? "running";
  const agentsDone = session.flowAgentsDone;
  const agentsTotal = session.flowAgentsTotal;
  // … existing render logic, unchanged.
}
```

**Alternatives rejected:**

- **Keep explicit-props signature, add a session-shaped wrapper.** Adds a separate component file just to adapt; moves the gating logic into a wrapper that the manifest then claims. Two layers for one purpose. Rejected.
- **Have the slot consumer adapt props per-claim.** Pollutes the runtime with plugin-specific knowledge. Defeats the point of slots.

## Decision 2: `FlowsActionsContext` for `SessionFlowActions` app-state

**Why:** `SessionFlowActions` needs `flows` (workspace flow definitions), `commands` (for `flows:new/edit/delete` gating), and `onFlowAction` (the dispatcher that calls back into the session via the dashboard server). All three live in `App.tsx` today and are passed through `SessionList → SessionCard` via JSX props. After the JSX is removed, the slot consumer cannot pass these — it only knows the session. So we surface them via React context.

**Shape:**

```tsx
// packages/flows-plugin/src/client/FlowsActionsContext.tsx
import { createContext, useContext } from "react";
import type { FlowInfo, CommandInfo } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export interface FlowsActionsValue {
  flows: FlowInfo[];
  commands: CommandInfo[];
  onFlowAction: (action: string, opts?: { flowName?: string; task?: string; description?: string }) => void;
}

const FlowsActionsContext = createContext<FlowsActionsValue | null>(null);
export const FlowsActionsProvider = FlowsActionsContext.Provider;

export function useFlowsActions(): FlowsActionsValue {
  const v = useContext(FlowsActionsContext);
  if (!v) throw new Error(
    "useFlowsActions must be used within <FlowsActionsProvider>. " +
    "Check that App.tsx wraps the slot tree with the provider."
  );
  return v;
}
```

`App.tsx` wraps the subtree that mounts `<SessionList>` (or whatever ancestor renders `<SessionCard>`):

```tsx
<FlowsActionsProvider value={{ flows, commands, onFlowAction }}>
  {/* existing children, including SessionList */}
</FlowsActionsProvider>
```

`SessionFlowActions` consumes:

```tsx
export function SessionFlowActions({ session }: { session: DashboardSession }) {
  const { flows, commands, onFlowAction } = useFlowsActions();
  const hasFlowsNew = commands.some(c => c.name === "flows:new");
  // … existing render logic, unchanged.
}
```

**Alternatives rejected:**

- **Pass flows/commands via session object.** Pollutes `DashboardSession` with plugin-specific state. The session model already overflows; adding more is harmful.
- **Read flows/commands from a global mutable store.** Loses React reactivity guarantees; manual subscriptions needed.
- **Make slots payload-aware (per-slot extra props).** Requires a multi-arg slot taxonomy, breaking the simple `(session) => ReactNode` contract for badges/actions.

## Decision 3: Vite-plugin emits `predicate` as a named-import binding

**Why:** `slot-registry.ts → ClaimEntry.predicate` already accepts `(props: unknown) => boolean`, and `forSession`/`forFolder` already filter by it. The gap is purely on the **generation** side: today the vite-plugin only emits `pluginId, priority, slot, tab, toolName, command, Component`. Restoring flows-plugin's `"predicate": "hasActiveFlow"` claim without emission would render the badge for every session.

The cleanest approach mirrors how `Component` is already emitted: a named import from the plugin's client entry, referenced in the inline `ClaimEntry` literal.

**Shape:**

```ts
// packages/dashboard-plugin-runtime/src/vite-plugin/index.ts → generateRegistryContent

// Step 1: collect all named imports (Components AND predicates)
const componentNames = entry.manifest.claims.map(c => c.component).filter(Boolean);
const predicateNames = entry.manifest.claims.map(c => c.predicate).filter(Boolean);
const named = [...new Set([...componentNames, ...predicateNames])];
if (named.length > 0) {
  lines.push(`import { ${named.join(", ")} } from ${JSON.stringify(importPath)};`);
}

// Step 2: emit predicate binding alongside Component
const predicateRef = claim.predicate ? `, predicate: ${claim.predicate}` : "";
lines.push(
  `      { pluginId: …, slot: …${tabStr}${toolNameStr}${commandStr}${componentRef}${predicateRef} },`,
);
```

**Validation at generation time:**

```ts
// Before emitting, ensure the named export exists.
import * as clientMod from importPath;
for (const name of [...componentNames, ...predicateNames]) {
  if (!(name in clientMod)) {
    throw new Error(
      `[vite-dashboard-plugins] Plugin "${manifest.id}" claims "${name}" but ` +
      `${importPath} does not export it.`
    );
  }
}
```

(Implementation note: the actual export-presence check needs to happen via static AST parse or a dynamic eval — defer to the implementer; the validation requirement is the design point.)

**Alternatives rejected:**

- **Emit `predicate: "hasActiveFlow"` as a string + runtime resolver.** Adds a registration step at app startup, defeats tree-shaking, and makes the contract harder to type. Rejected.
- **Move predicate evaluation server-side.** Slot filtering is a render-time concern; the server doesn't know about slot consumers.

## Decision 4: Restore manifest claims AND remove direct JSX in the same PR

**Why:** Wire-plugin-registry-into-shell took a phased approach (wiring without flows). This change is the second phase. Restoring the manifest claims while leaving direct JSX in `SessionCard.tsx` would render two badges per flow-active session. Removing the JSX without restoring claims would render zero badges. Both edits MUST land together.

**Mitigation:** the regression test `packages/client/src/__tests__/session-card-no-double-flow.test.tsx` asserts exactly one `FlowActivityBadge` DOM node per flow-active session. The lint test `no-jsx-slot-nullish-fallback.test.ts` already includes `SessionCard.tsx` in its scan list.

## Decision 5: Tighten `plugin-registry-populated.test.ts` after restoration

**Why:** During `wire-plugin-registry-into-shell` we loosened the test from "every entry has ≥1 claim" to "≥1 claim across all entries" specifically because flows-plugin's entry temporarily had `claims: []`. After this change restores them, the original stricter assertion catches more regressions.

**Shape:** revert the assertion to the per-entry form, AND keep the total-claims check as a redundant safety net.

```ts
it("every entry has at least one claim", () => {
  for (const entry of PLUGIN_REGISTRY) {
    expect(entry.claims.length, `plugin ${entry.manifest.id} has no claims`).toBeGreaterThan(0);
  }
});

it("at least one claim total (defense in depth)", () => {
  const total = PLUGIN_REGISTRY.reduce((n, e) => n + e.claims.length, 0);
  expect(total).toBeGreaterThan(0);
});
```
