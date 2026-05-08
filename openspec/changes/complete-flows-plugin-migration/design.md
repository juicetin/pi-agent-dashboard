## Context

`flows-plugin` is currently a half-extracted package: physically relocated to `packages/flows-plugin/` in April but functionally still entangled with the dashboard shell on three independent axes (CI fragility, broken predicate emission, content-slot architectural block). The proposal collapses three previously-separate proposals (`extract-client-utils-package`, `migrate-flows-jsx-to-slots`, `migrate-flows-content-slots`) plus two unblocker fixes into one coordinated landing.

### Current state (2026-05-08)

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  flows-plugin/                                                    │
   │    ├─ src/client/*.tsx          ◄── 13 deep relative imports     │
   │    │                                from "../../../client/src/..." │
   │    │                                (works in monorepo, breaks   │
   │    │                                in node_modules tarball)     │
   │    │                                                              │
   │    ├─ src/flow-reducer.ts       ◄── still imported by shell's    │
   │    ├─ src/architect-reducer.ts      event-reducer.ts (workspace  │
   │    │                                import; this stays as-is)    │
   │    │                                                              │
   │    └─ package.json#claims: []   ◄── manifest claims deferred;    │
   │                                     direct JSX in App.tsx and    │
   │                                     SessionCard.tsx fills the    │
   │                                     gap                          │
   │                                                                   │
   │  packages/client/src/App.tsx                                     │
   │    ├─ FlowDashboard rendered 2× (lines 1053, 1094)               │
   │    ├─ FlowArchitect rendered 3× (lines 1020, 1040, 1081)        │
   │    └─ ~250 LOC of flow-related conditionals + callbacks          │
   │                                                                   │
   │  vite-plugin (dashboard-plugin-runtime)                           │
   │    └─ generates plugin-registry.tsx WITHOUT predicate field      │
   │       → manifest predicates are decorative metadata              │
   │       → jj-plugin works only because each component self-gates   │
   └──────────────────────────────────────────────────────────────────┘
```

Three operational pains compound: (a) any release that runs `npm ci` after publish risks the deep-import resolution failure, (b) restoring `flows-plugin`'s manifest claims today would render the badge for every session because predicates aren't filtered, (c) `FlowDashboard`/`FlowArchitect` need `flowState`/`architectState` which aren't on `DashboardSession` so the frozen slot consumer can't reach them.

### Constraints

- **Frozen slot prop contracts (v0.x).** `dashboard-shell-slots` spec freezes the slot prop contracts at minor-version. Adding fields to `DashboardSession` is *not* a slot-contract change (it's session-shape evolution, already minor by precedent). Extending slot prop signatures *would* be — explicitly avoided.
- **Single repo.** Everything in `pi-agent-dashboard`. Cross-repo move to `pi-flows` is out of scope (separate change).
- **No protocol breakage.** New session fields must be optional. Older browser tabs reconnecting to a newer server must continue to work without crashing.
- **Bridge process owns flow-state truth.** The flow event listener already runs in the bridge (`packages/extension/src/flow-event-wiring.ts`) and produces `FlowState`/`ArchitectState`. The shell's reducer (`event-reducer.ts`) currently re-derives this from forwarded events — but the bridge can carry the computed state directly via the existing session payload.

### Stakeholders

- Dashboard release process (CI breakage on every post-release `develop` push).
- Plugin authors (jj-plugin gets retroactive predicate filtering; future plugins inherit a clean slot contract).
- Future cross-repo move to pi-flows (leaves flows-plugin in a state where Layer 3 is a `git mv` of working code, not a refactor of broken code).

## Goals / Non-Goals

**Goals:**

- End the CI publish/republish hazard caused by deep relative imports across the plugin/client boundary. Permanent fix, not another quickfix pin.
- Make `flows-plugin`'s manifest claims fully wired and rendered through the slot system, including the heavy components (`FlowDashboard`, `FlowArchitect`, `FlowAgentDetail`, `FlowArchitectDetail`, `FlowSummary`).
- Retire the duplicated flow JSX in `App.tsx` (3× FlowArchitect, 2× FlowDashboard) so a single slot consumer call replaces N conditional branches.
- Fix the vite plugin's predicate emission so manifest predicates filter claims as designed. Side-effect: `jj-plugin`'s existing predicates start working as designed (defensive self-gating becomes redundant but is left in place).
- Reach a state where the only blocker between this repo and the pi-flows cross-repo move is the React build pipeline in pi-flows itself — not architectural debt in the plugin code.

**Non-Goals:**

- Cross-repo move to pi-flows (Layer 3). pi-flows has zero React tooling; standing that up is independently large.
- Pluggable reducer registry. The shell's `event-reducer.ts` keeps importing `reduceFlowEvent` / `reduceArchitectEvent` from `flows-plugin` (workspace import, no runtime extension point). Making the reducer dispatch table dynamic is a separate concern.
- Hard-cut elimination of `packages/client/src/components/{12 files}.tsx`. They become re-export shims pointing at `client-utils`; downstream client imports keep working without churn.
- Slot prop contract changes. The frozen v0.x contracts (`{session}` for session-scoped, `{session, routeParams, onClose}` for content-view) are preserved exactly. The augmentation rides through `DashboardSession`.
- Protocol-level changes. No new gateway message types, no new REST endpoints. The augmented session object reuses existing `sessions_snapshot` / `session_register` paths.

## Decisions

### Decision 1: Bundle three proposals into one coordinated landing

**Choice:** Land Layer 1 (client-utils) + Layer 2 (slot wiring) + Phase-0 unblockers (vite-plugin predicate fix) in a single change.

**Rationale:** They have hard dependencies on each other:
- Predicate emission must land before flows-plugin claims are restored, or the badge renders for every session.
- Slot wiring must land before flows-plugin's deep imports are removed, or the shell can't render flows at all.
- Client-utils extraction must precede slot wiring's "remove direct flow JSX" step, or the deep-import bug bites again at the next release.

Splitting them across releases recreates each individual failure mode in turn. Single landing is mechanically cheaper than multiple staged landings.

**Alternatives considered:**

- *Three sequential changes* — viable but each release between landings is fragile. Rejected: cycle time is short (~2 weeks for the bundle vs ~3-4 weeks split with retest gates between each).
- *Phase-0 as its own change, then Layers 1+2 as a second change* — the unblocker fix is small enough (4-line vite-plugin edit + 1 test) that a separate change for it is heavier than its actual content. Rejected: ceremony exceeds value.

### Decision 2: Add flow state to `DashboardSession` (Path A from exploration)

**Choice:** Bridge populates optional `flowState`, `flowStates`, `architectState` fields on the session object. Components self-derive from `session.flowState` etc.

**Rationale:** Three paths were identified:

```
   PATH A — extend DashboardSession                  ✅ chosen
     - bridge fills flowState/architectState         
     - components read session.flowState            
     - slot props unchanged (still {session})       
     - additive: new fields are optional             

   PATH B — extend slot prop contracts              ❌ rejected
     - slot consumers pass extra typed payloads     
     - breaks frozen v0.x slot contract             
     - every plugin re-validates against new shape  
     - cascades across all plugins                   

   PATH C — keep direct JSX                          ❌ rejected
     - "give up" on Layer 2 for content slots       
     - eternal hard-coded conditional in App.tsx    
     - Layer 3 cross-repo move blocked              
```

Path A is the smallest invasive change with the cleanest contract. The bridge already computes `FlowState` per session (it owns the event stream); folding it into the session payload is plumbing, not architecture. Older browser tabs ignore the new fields gracefully (optional).

**Alternatives considered:** Path B and Path C above.

### Decision 3: Two contexts, not one, for callbacks

**Choice:** Two React contexts — `FlowsActionsContext` (per-session-card, carries `flows[]`/`commands[]`/`onFlowAction`) and `FlowActionsContext` (per-active-session, carries `onAbort`/`onToggleAutonomous`/`onDismissSummary`/`onSendPrompt`/`onViewYaml`/`onViewAgentSource`/`onAgentClick`).

**Rationale:** They have **different lifecycles and scopes**:

- `FlowsActionsContext` data is bulk (all flows defined for the session, command catalog) and per-session-card. The provider wraps `SessionList`/`SessionCard`.
- `FlowActionsContext` is per-active-session-content (callbacks only fire for the active session's flow). The provider wraps the per-session content area.

Combining them into a single context forces the inactive session cards to re-render whenever the active session's flow control callbacks change identity (closures over `selectedId`/`send`). Two contexts → React's `useContext` only invalidates consumers that actually subscribe.

**Alternatives considered:**

- *One unified `FlowsContext`* — simpler API, worse render performance. Rejected on the perf footprint when 50+ session cards are mounted.
- *No context, pass via slot props* — would require breaking the slot prop contract (Path B in Decision 2). Already rejected.

### Decision 4: Re-export shims, not hard-cut, for client-utils

**Choice:** When 12 files move from `packages/client/src/{components,hooks}/...` to `packages/client-utils/src/...`, the original location becomes a thin re-export shim:

```typescript
// packages/client/src/components/AgentCardShell.tsx (post-migration)
export * from "@blackbelt-technology/pi-dashboard-client-utils/AgentCardShell";
```

**Rationale:**

- 42 client-side import sites today (`MarkdownContent` 14, `DialogPortal` 14, `useMobile` 10, others 1–7). A hard-cut is 58 import-line edits across 42 files in one PR — mechanical but adds review surface to a change already touching ~30 files.
- The re-export shims are **stable contracts** — once written, they don't churn unless the underlying signature changes. They are 1-line files. The "12 forever-shims" objection is real but the cost is minimal (12 × 1-line files vs 58 import rewrites).
- Removes review pressure: the shell's import paths stay the same, so reviewers focus on the new package + plugin re-imports, not on confirming 58 unrelated import rewrites.

**Alternatives considered:**

- *Hard-cut* — cleaner end state, but doubles the diff surface and risks merge conflicts with parallel work. Rejected: the shim approach is what the original `extract-client-utils-package` proposal recommends, and the cost of shims is genuinely small.
- *Mixed* — hard-cut the high-volume imports (MarkdownContent, DialogPortal, useMobile = 38 sites), keep shims for the low-volume ones. Rejected: introduces an inconsistent rule that future plugin authors have to learn.

### Decision 5: Predicate emission via named import + build-time validation

**Choice:** Vite plugin emits predicate names as named imports from the plugin's client entry, alongside the existing component named imports. Validates at build time that the named export exists; fails the build with a clear error if it doesn't.

**Rationale:** Currently the vite plugin emits:

```typescript
import { JjWorkspaceBadge, JjActionBar } from ".../jj-plugin/.../client/index";
// ...
{ pluginId: "jj", slot: "session-card-badge", Component: JjWorkspaceBadge },
//                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^ component ref
//                                            but no predicate ref
```

The fix is mechanically small: collect predicate names alongside component names, emit them in the same named-import line, and add `predicate: <name>` next to `Component: <name>` in the literal. Then the slot consumer's `forSession` filter can call `c.predicate(session)` with a real function.

Build-time validation prevents a typo (e.g., `predicate: "isInJjWorkspac"`) from silently making the badge render for every session — instead the build fails with `"jj-plugin claims predicate 'isInJjWorkspac' but client entry does not export it. Did you mean 'isInJjWorkspace'?"`.

**Alternatives considered:**

- *Lazy resolution at runtime* — read the manifest at app startup, look up predicate names via dynamic import. Rejected: defeats Vite tree-shaking, adds runtime failure modes, can't fail the build.
- *Inline predicate as JSON* — the manifest could declare `predicate: { type: "session-prop", path: "flowState" }` instead of a name. Rejected: forces every plugin to encode its filter logic in a tiny DSL; breaks the "predicates are real functions exported from the plugin" model.

### Decision 6: Deduplicate flow JSX before extracting to slots

**Choice:** First commit deduplicates the 3× FlowArchitect / 2× FlowDashboard rendering in App.tsx into single conditional rendering blocks. Second commit replaces those blocks with slot consumer calls.

**Rationale:** The three FlowArchitect call sites have **subtle differences**:

```
   App.tsx:1020 (architect-detail-open branch)
     onDismiss = () => { selectedId && send(...dismiss...) }

   App.tsx:1040 (flow-detail-agent-open branch, nested)
     onDismiss = () => { setFlowDetailAgent(null); selectedId && send(...) }

   App.tsx:1081 (default branch, neither open)
     onDismiss = () => { selectedId && send(...) }
```

Slot-migrating each branch separately would carry the divergence into the plugin layer (slot consumer renders three times conditionally, each with a different props closure). Dedup-first means a single FlowArchitect render with a single closure that reads the same state used in the conditionals — simpler component, simpler slot consumer.

A parity test (`packages/client/src/__tests__/flow-rendering-parity.test.tsx`) must run before and after dedup to confirm rendering output matches.

**Alternatives considered:**

- *Migrate slots first, dedup later* — risky, duplicates the deferred-cleanup pattern that left flows-plugin half-extracted in the first place. Rejected.
- *Skip dedup* — three slot consumer calls with different gating conditions is functionally OK but contradicts Layer 2's "remove the conditional rendering" goal. Rejected: dedup is cheap once the architecture supports it.

### Decision 7: Keep flow reducers as workspace import; do not pluggable-ize

**Choice:** `event-reducer.ts` continues to do `import { reduceFlowEvent, isFlowEvent } from "@blackbelt-technology/pi-dashboard-flows-plugin/reducer"`. The shell statically depends on flows-plugin's reducer.

**Rationale:** A pluggable reducer registry (where plugins register their reducers at runtime) is a major architectural change that this migration does not need. The shell's reducer dispatch is `if (isFlowEvent(e)) state = reduceFlowEvent(state, e)` — a static workspace import keeps that working with zero runtime indirection. If `flows-plugin` is later removed (e.g., via the cross-repo move), the shell-side import fails at build time, surfacing the dependency cleanly. That's the right failure mode.

The bridge populates `session.flowState` from the same reducer, so the rendering side has the data it needs via `DashboardSession`. The reducer dispatch and rendering layers are decoupled even though both reference the plugin package.

**Alternatives considered:**

- *Plugin reducer registry* — flows-plugin registers its reducer at startup; shell calls registry.dispatch(event). Architecturally cleaner but adds an indirection layer with its own correctness story. Rejected for this change: out of scope.
- *Move reducers into shared* — they aren't really "shared", they're flow-specific. Rejected: wrong boundary.

### Decision 8: Sync-versions.js learns to preserve non-semver specifiers

**Choice:** `scripts/sync-versions.js` skips dependency entries whose specifier isn't a parseable semver range (e.g., `"*"`, `"workspace:*"`, `"latest"`).

**Rationale:** Today the script unconditionally rewrites every inter-package dependency to `^<newVersion>`. If a future hotfix needs `"*"` again (the old quickfix), the next release would silently overwrite it back to `^<version>`, re-breaking CI. Defensive: this change shouldn't *need* `"*"` again because the deep imports are gone, but the script must never undo a deliberate non-semver pin.

**Alternatives considered:**

- *Allow-list specific packages* — brittle; requires a list update for every new package. Rejected.
- *Do nothing* — relies on humans never re-introducing `"*"`, which contradicts the lesson the team learned with `fdb8593`. Rejected.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|---|---|---|
| **Triple-rendering dedup breaks edge cases.** The three FlowArchitect call sites have subtle prop differences (different `onDismiss` reset behavior). Collapsing them could regress UX in a specific workflow (e.g., agent detail open → user dismisses summary → expects flowDetailAgent to clear). | Medium | Parity test (`flow-rendering-parity.test.tsx`) renders all three states before dedup, snapshots output, then re-runs after dedup. Plus a manual gate task for "open flow detail, then dismiss summary, verify drill-down clears". |
| **Bridge augmentation lost on reconnect.** A flow active on session X must still appear when the browser reconnects mid-flow. If the bridge sends `session_register` once at connect and the augmentation is missing from a subsequent `sessions_snapshot`, the session appears flow-less briefly. | Medium | Server's `sessions_snapshot` rebuilds the session object from `MemorySessionManager` (which holds the latest bridge push). Test: kill browser → bridge keeps running with active flow → reconnect → first snapshot must contain `session.flowState`. |
| **Predicate emission fix changes jj-plugin behavior.** Today jj-plugin's predicates are decorative; every component self-gates. After the fix, predicates filter at the slot consumer level — meaning a typo in a predicate name now fails the build (was silent before). Existing jj-plugin tests must keep passing. | Low | jj-plugin's `predicates.ts` exports already match the manifest names (verified via grep). The component-side self-gates are left as defense-in-depth. The new build-time validation catches typos before they ship. |
| **Re-export shims hide the layering shift.** A future contributor sees `import { MarkdownContent } from "../../components/MarkdownContent"` in client code and doesn't realize MarkdownContent now lives in another package. They might "fix" it back into client/ if asked to. | Low | The shim files contain a 1-line comment: `// Moved to @blackbelt-technology/pi-dashboard-client-utils. This shim preserves internal client imports.` The new lint test (`no-cross-package-deep-imports`) catches the inverse error (plugins importing back into client). |
| **CI publish ordering misconfigured.** A single misconfigured workflow step republishes flows-plugin before client-utils, breaking the registry for new installs. | Medium | The contract test (`publish-workflow-contract.test.ts`) pins the order: client-utils MUST appear before any plugin that depends on it. Failing test = failing PR. |
| **DashboardSession size grows.** Three new optional fields → larger WS payloads, more JSON to serialize on every session update. For typical usage (1-3 active flows × tens of agents × small state) the impact is sub-KB, but a 100-agent flow's state could be tens of KB on every reconnect. | Low | The new fields are optional and only populated when a flow is active. Snapshot delta diffing on the client side already exists for session updates — no per-update broadcast cost. Worst case on reconnect is bounded by flow state size, which is bounded by agent count. |
| **Markdown stack travels into client-utils as runtime deps.** `MarkdownContent` brings `react-markdown`, `rehype-katex`, `remark-math`, `remark-gfm`, `react-syntax-highlighter` (~600KB resolved). Plugins that depend on `client-utils` for any reason now ship the markdown tree by default (resolved at install). | Low | Per-subpath exports (`@blackbelt-technology/pi-dashboard-client-utils/AgentCardShell` vs `/MarkdownContent`) let Vite tree-shake unused symbols. Bundle size at runtime is unaffected. Install-size cost is mentioned in the package README. |
| **flows-anthropic-bridge-plugin coexistence.** That plugin currently uses `ctx.events.on(...)` to listen for `flows-anthropic-bridge:*` events forwarded by the bridge. The forwarding mechanism is unchanged by this work, but a parallel proposal (`skip-rpc-probes-in-event-forwarder`) could classify some events as RPC and drop them. | Low | Out of scope here. The proposal author of `skip-rpc-probes-in-event-forwarder` must add explicit tests for `flows-anthropic-bridge:*` channels. Cross-referenced in this design as a known parallel concern, not a blocker. |

## Migration Plan

### Sequencing inside this change

```
   1. Phase-0 unblocker (no behavioral change)
      ├─ Fix vite-plugin predicate emission
      ├─ Add build-time validation
      └─ Add test
   
   2. Layer 1 (no UI change, but unblocks plugins for npm)
      ├─ Create packages/client-utils/ with package.json + tsconfig
      ├─ git mv 12 files + 4 tests (preserve history)
      ├─ Replace original locations with re-export shims
      ├─ Add `pi-dashboard-client-utils` dep to flows-plugin + jj-plugin
      ├─ Rewrite 13 deep relative imports in flows-plugin to package name
      ├─ Add no-cross-package-deep-imports lint
      ├─ Update sync-versions.js to preserve non-semver specifiers
      └─ Update publish.yml ordering + contract test
   
   3. Layer 2 — bridge augmentation (no UI change yet)
      ├─ Add optional flowState/flowStates/architectState to DashboardSession
      ├─ Bridge folds these into session payloads
      ├─ Server replays via sessions_snapshot
      └─ Verify reconnect-mid-flow integration test passes
   
   4. Layer 2 — flow JSX dedup (UI invariant)
      ├─ Collapse 3× FlowArchitect → 1× with combined gating
      ├─ Collapse 2× FlowDashboard → 1× with combined gating
      ├─ Run parity test before + after; snapshots must match
      └─ Manual gate: open flow detail, dismiss summary, drill-down clears
   
   5. Layer 2 — slot wiring
      ├─ Adapt 7 components to {session} entry signature
      ├─ Create FlowsActionsContext + FlowActionsContext
      ├─ Add provider wrapping in App.tsx
      ├─ Restore manifest claims with predicates
      ├─ Remove direct flow JSX from App.tsx + SessionCard.tsx + SessionHeader.tsx
      ├─ Add no-double-flow regression test
      └─ Extend no-jsx-slot-nullish-fallback SCAN_FILES to include MobileShell.tsx
   
   6. Verification
      ├─ Full test suite green
      ├─ Build clean (no TS errors)
      ├─ Manual gate: spawn a flow, verify identical UX before/after
      ├─ Manual gate: kill+reattach browser mid-flow, flow state survives
      └─ pnpm pack of flows-plugin → tarball has no deep relative paths
```

### Rollback strategy

The change is divided into **independently revertible commits** by phase. If Phase 5 breaks production, revert commits 4–7 (slot wiring + dedup) to return to direct-JSX behavior, leaving Phase 1–3 (which are pure plumbing improvements) in place. The bridge augmentation (Phase 3) is additive: components that don't read the new fields are unaffected.

The Layer 1 (client-utils) split is harder to revert mechanically (12 file moves), but the package is a pure factor — any commit-revert returns the symbols to their original locations. CI would catch a partial revert immediately because the deep imports would re-fail.

### Coordination with concurrent work

- **`migrate-flows-jsx-to-slots`, `migrate-flows-content-slots`, `extract-client-utils-package`** — these proposals are obsoleted by this change. After this lands, archive them (no implementation under their names).
- **`wire-plugin-registry-into-shell`** — depends on this for the predicate emission fix. Its remaining tasks (manual gates) become trivial once this lands.
- **`extract-flows-as-plugin`** — its deferred tasks (§7 in tasks.md) are folded into this change.
- **`extract-{git,openspec,subagents}-as-plugin`** — future plugin extractions inherit the patterns established here. No coordination needed in this change; they reference this one.
- **pi-flows#expose-as-dashboard-plugin** — out of scope here. After this lands, that work becomes a `git mv` of working code, not a refactor.

## Open Questions

- **Should the no-cross-package-deep-imports lint also forbid `import "../../../../packages/..."` style escapes?** Today no plugin does this, but future ones might. Recommendation: yes, fail on any path escape that crosses package boundaries. Decision to defer to spec phase.
- **Should the bridge fold `flowState` into the session payload only when it changes, or every time the session is registered?** First-pass: every register/snapshot includes the latest known `FlowState`. Differential pushing is an optimization that can come later.
- **Is `hasActiveArchitect` predicate the right name?** It mirrors `hasActiveFlow`, but the architect lifecycle is different (it shows up during flow design, not flow execution). May want `hasArchitectState` to avoid implying "running". Defer to spec phase.
- **Do we keep the parity tests around long-term?** `flow-rendering-parity.test.tsx` exists to guard the dedup; once the dedup ships and stabilizes, the test loses signal. Recommendation: keep for one minor version then archive.
