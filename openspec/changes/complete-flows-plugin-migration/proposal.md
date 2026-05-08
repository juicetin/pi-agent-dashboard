## Why

`flows-plugin` was physically extracted into `packages/flows-plugin/` in April but its migration is **half-finished and currently broken in three independent ways**:

1. **CI/release fragility.** `packages/flows-plugin/src/client/*.tsx` contains 13 deep relative imports of the form `from "../../../client/src/components/AgentCardShell.js"`. These resolve via workspace symlink in the monorepo but resolve to nothing once the published tarball lands in `node_modules/`. The previous quickfix (`fdb8593`, pin specifiers to `"*"` so the symlink wins) was reverted to `^0.5.0` for v0.5.0 — meaning the next release that runs `npm ci` after publishing will fail the client build with `Could not resolve "../../../client/src/components/AgentCardShell.js"`. `sync-versions.js` would re-overwrite any future `"*"` revert, so the issue cannot be patched without a real fix.

2. **Plugin claims are unwirable.** `packages/flows-plugin/package.json` ships with `"claims": []` and a deferred-claims comment. Even if claims were restored, the vite plugin at `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts` does not emit the manifest's `predicate` field into the generated `plugin-registry.tsx`. The slot consumer's `forSession()` filter therefore receives `c.predicate === undefined`, returns `true` for every claim, and the badge renders for every session. `jj-plugin` works today only because every component defensively self-gates inside React (e.g. `if (!session.jjState?.isJjRepo) return null;`) — predicates are decorative metadata. Without the emission fix, restoring `flows-plugin`'s claims would visibly break the badge (renders for every session) and the action bar (crashes on missing `flows`/`onFlowAction` props).

3. **Slot wiring is structurally blocked for "rich" components.** `FlowActivityBadge` and `SessionFlowActions` (the two session-card claims) can be adapted to accept `{ session }` and self-derive — `FlowActivityBadge` self-gates, `SessionFlowActions` reads `flows`/`commands`/`onFlowAction` from a new React context. But `FlowDashboard`, `FlowArchitect`, `FlowAgentDetail`, `FlowArchitectDetail`, and `FlowSummary` need `flowState`/`architectState` objects that exist only in App.tsx local state (`SessionState`, derived by event-reducer) and **are not on `DashboardSession`**. The frozen v0.x slot consumer passes only `{ session }`. Migrating these "content slot" components requires either (a) adding `flowState`/`architectState` to `DashboardSession`, (b) extending the frozen slot prop contracts, or (c) keeping them as direct JSX. This change picks **(a)**: bridge populates these on the session object so components can self-derive uniformly with the session-card claims.

A side-effect of the half-finished migration is that `App.tsx` renders `<FlowArchitect>` at three call sites and `<FlowDashboard>` at two (overlapping conditional branches). Any slot migration must deduplicate these first or the duplication is carried into the plugin layer.

This change consolidates the Phase-0 unblockers + Layer 1 (`extract-client-utils-package`) + Layer 2 (`migrate-flows-jsx-to-slots` + `migrate-flows-content-slots`) into a single coordinated landing because they have hard dependencies on each other. Splitting them across releases re-introduces every CI failure mode they each individually fix.

The cross-repo move (Layer 3 — moving source to `pi-flows`) is **out of scope**: it requires standing up React tooling in pi-flows and is independently large.

## What Changes

### New `client-utils` workspace package
- **NEW**: `packages/client-utils/` workspace package, published as `@blackbelt-technology/pi-dashboard-client-utils`. Houses the 12 components/hooks shared between the dashboard shell and external plugins (`MarkdownContent`, `AgentCardShell`, `DialogPortal`, `ConfirmDialog`, `SearchableSelectDialog`, `ZoomControls`, `agent-card-utils`, `useZoomPan`, `useMobile`, plus three `extension-ui/*` slot components).
- `git mv` (preserving history) from `packages/client/src/{components,hooks}/...` into `packages/client-utils/src/`. Sibling `__tests__/*.test.tsx` files move with them (4 test files).
- `packages/client/src/{...}/<file>.tsx` becomes a thin re-export shim pointing at the new package, so internal client imports keep compiling without churn. (Hard-cut alternative explicitly rejected — see design.md.)
- Per-subpath exports map (`./AgentCardShell`, `./MarkdownContent`, etc.) so Vite tree-shakes the markdown stack for plugins that don't use it.
- `flows-plugin` and `jj-plugin` rewrite their 13 deep relative imports to use the published package name.
- New repo-lint test (`packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts`) fails CI when any `packages/*-plugin/src/` file contains `from "../../../client/`.
- `scripts/sync-versions.js` updated to preserve non-semver specifiers (defensive: should never re-introduce `"*"`, but if a future hotfix needs to, the script must not undo it).

### Vite plugin emits predicates
- **MODIFIED**: `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts::generateRegistryContent` collects predicate names alongside component names; emits them as named imports from the plugin's client entry; emits `predicate: <name>` alongside `Component: <name>` in the inline `ClaimEntry` literal.
- Build-time validation: if a manifest claim references a `predicate` (or `component`) name not exported from the plugin's client entry, the build SHALL fail with an error naming the plugin id, the claim slot, and the missing export.
- New test (`packages/dashboard-plugin-runtime/src/__tests__/vite-plugin-predicate-emission.test.ts`) covers the emission and the validation failure.
- This retroactively makes `jj-plugin`'s existing `predicate: isInJjWorkspace` etc. work as designed (today they are decorative; jj-plugin self-gates inside its components).

### Bridge populates flow state on `DashboardSession`
- **MODIFIED**: `packages/shared/src/types.ts` `DashboardSession` adds optional fields:
  - `flowState?: FlowState | null`
  - `flowStates?: ReadonlyMap<string, FlowState>`
  - `architectState?: ArchitectState | null`
- The bridge — specifically the bridge-side flow event listener already wired in `packages/extension/src/flow-event-wiring.ts` — folds the per-session `FlowState` / `ArchitectState` it already tracks into the next `session_register` / model-tracker push, so the server's `MemorySessionManager` ends up with the full state on each `session` object.
- Server replays this state on every browser `bootstrap_request` and on every reconnect (no new gateway message types needed; existing `sessions_snapshot` carries the augmented session object).
- **No protocol-level breaking change**: the new fields are optional. Older browser clients ignore them gracefully.

### flows-plugin claims fully wired
- **MODIFIED**: `packages/flows-plugin/package.json#pi-dashboard-plugin.claims` populated with the full set:
  - `session-card-badge` → `FlowActivityBadge` w/ predicate `hasActiveFlow`
  - `session-card-action-bar` → `SessionFlowActions`
  - `content-header-sticky` → `FlowDashboard` w/ predicate `hasActiveFlow`
  - `content-header-sticky` → `FlowArchitect` w/ predicate `hasActiveArchitect`
  - `content-view` → `FlowAgentDetail` (route `flow-agent-detail`)
  - `content-view` → `FlowArchitectDetail` (route `flow-architect-detail`)
  - `content-inline-footer` → `FlowSummary` w/ predicate `hasActiveFlow`
- **NEW**: `packages/flows-plugin/src/client/FlowsActionsContext.tsx` (action-bar callbacks + commands list) and `FlowActionsContext.tsx` (flow-control callbacks for `onAbort`, `onToggleAutonomous`, `onDismissSummary`, `onSendPrompt`, `onViewYaml`, `onViewAgentSource`, `onAgentClick`). Two contexts because they have different lifecycles (action-bar is per-session-card, flow-control is per-active-session).
- **NEW exported predicates** in `packages/flows-plugin/src/client/index.tsx`: `hasActiveFlow(session)`, `hasActiveArchitect(session)`. Both return `Boolean(session.flowState)` / `Boolean(session.architectState)` — required because the predicate names referenced in the manifest must be exported from the client entry (see vite-plugin validation above).
- All seven flow components refactor to accept `{ session }` (or `{ session, routeParams, onClose }` for content-view claims) and pull state + callbacks from session + context. Component internals unchanged below the entry signature.

### App.tsx + SessionCard.tsx cleanup
- **REMOVED**: direct imports + JSX for `FlowDashboard`, `FlowArchitect`, `FlowAgentDetail`, `FlowArchitectDetail`, `FlowSummary`, `FlowActivityBadge`, `SessionFlowActions` from `App.tsx` and `SessionCard.tsx`.
- **REMOVED**: the triple-rendering of `FlowArchitect` (App.tsx:1020, 1040, 1081) and double-rendering of `FlowDashboard` (App.tsx:1053, 1094) — replaced by single slot consumer calls.
- **NEW** `<FlowsActionsProvider>` wraps the main app content; **NEW** `<FlowActionsProvider>` wraps the per-session content area. Both fed from existing App.tsx state — no new top-level state.
- **NEW** regression test `packages/client/src/__tests__/session-card-no-double-flow.test.tsx` — fails if both the slot consumer and a direct flow JSX import render in the same SessionCard.
- **MODIFIED** `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts::SCAN_FILES` adds `MobileShell.tsx` to prevent a fallback-chain anti-pattern from creeping in via the mobile path.

### Publish-pipeline updates
- **MODIFIED**: `.github/workflows/publish.yml` — `client-utils` is published BEFORE `flows-plugin` and `jj-plugin` (so they can declare a real semver dep on it).
- **MODIFIED**: `packages/shared/src/__tests__/publish-workflow-contract.test.ts` — pins the new ordering.
- `flows-plugin` and `jj-plugin` keep `^<current-version>` specifiers on `client-utils`. The `"*"` workaround era ends with this change.

## Capabilities

### New Capabilities

- `client-utils-package`: defines the published `@blackbelt-technology/pi-dashboard-client-utils` package, what lives in it, the per-subpath export map, the no-cross-package-deep-import lint, and the rule that any future plugin needing client utilities depends on this package (not deep relative imports).

### Modified Capabilities

- `dashboard-plugin-loader`: vite plugin SHALL emit predicate references alongside component references in the generated registry, and SHALL fail the build at generation time if any claim references a predicate or component name not exported from the plugin's client entry. Existing requirements about plugin runtime workspace package, named imports, manifest validation, etc. are preserved.

- `dashboard-shell-slots`: `DashboardSession` SHALL carry optional `flowState`, `flowStates`, `architectState` fields, populated by the bridge and consumed by flow-related claims (which SHALL self-gate via predicates). Slot prop contracts (`{ session }` for session-scoped slots, `{ session, routeParams, onClose }` for content-view) are NOT changed; the augmentation rides through the `session` object.

- `monorepo-workspace-structure`: SHALL include the new `packages/client-utils/` workspace, SHALL forbid deep relative imports across plugin/client boundary (enforced by lint), and SHALL document `packages/flows-plugin`'s status as a fully-wired dashboard plugin (not a half-extracted package).

- `workspace-publishing`: publish ordering SHALL place `client-utils` before any plugin that depends on it. Cross-package specifiers between published workspaces SHALL use real semver ranges (`^<version>`), not workspace-protocol or `"*"`. The contract test SHALL pin the ordering.

### Specs not modified

`flow-agent-detail`, `flow-architect-view`, `flow-card-grid`, `flow-card-launcher`, `flow-card-status`, `flow-controls`, `flow-summary-view`, `flow-trigger`, `flow-event-bridge`, `flow-server-state`, `flow-list-protocol`, `flow-browser-protocol` — these specs cover **flow behavior** (what happens when a flow runs, what events flow, what UI shows). Their requirements are unchanged: components do the same things they did before, just with new entry signatures and new context providers. Behavior is preserved by parity tests.

## Impact

### Code
- `packages/client-utils/` — new (12 files moved + 4 tests + package.json + tsconfig).
- `packages/client/src/{components,hooks,components/extension-ui}/` — 12 files become re-export shims.
- `packages/client/src/App.tsx` — ~250 LOC removed (flow JSX + duplicated branches), ~30 LOC added (provider wrapping).
- `packages/client/src/components/SessionCard.tsx` — flow imports + JSX removed.
- `packages/client/src/components/SessionHeader.tsx` — flow imports + JSX removed.
- `packages/client/src/lib/event-reducer.ts` — unchanged in this change (reducer dispatch via plugin reducer registry is a separate concern; for now the shell still imports `reduceFlowEvent`/`reduceArchitectEvent` from `flows-plugin`, which is fine because flows-plugin is a workspace package). The change *does* fold the reducer's output into `DashboardSession` — but that's done by the bridge composing the event into the session payload, not by event-reducer.
- `packages/flows-plugin/src/client/*.tsx` — 7 components refactor entry signatures; internals unchanged.
- `packages/flows-plugin/src/client/{Flows,Flow}ActionsContext.tsx` — new.
- `packages/flows-plugin/src/client/index.tsx` — adds `hasActiveFlow`, `hasActiveArchitect` exports.
- `packages/flows-plugin/package.json` — manifest claims populated; `flows-plugin` adds dep on `pi-dashboard-client-utils`.
- `packages/jj-plugin/package.json` — adds dep on `pi-dashboard-client-utils`. (Predicate emission fix retroactively makes its existing predicates work; component self-gating becomes redundant but is left in place as defense-in-depth.)
- `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts` — emits predicates + build-time validation.
- `packages/extension/src/flow-event-wiring.ts` (or sibling) — folds `FlowState`/`ArchitectState` into outgoing session payloads.
- `packages/shared/src/types.ts` — three optional fields added to `DashboardSession`.
- `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts` — new lint.
- `packages/dashboard-plugin-runtime/src/__tests__/vite-plugin-predicate-emission.test.ts` — new test.
- `packages/client/src/__tests__/session-card-no-double-flow.test.tsx` — new regression.
- `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts` — `SCAN_FILES` extended.
- `scripts/sync-versions.js` — preserves non-semver specifiers.
- `.github/workflows/publish.yml` — `client-utils` ordered before plugin packages.

### Protocol / API
- No breaking protocol changes. `DashboardSession.flowState`/`flowStates`/`architectState` are optional — older browsers ignore them.
- No new REST endpoints. No new WS message types.

### Dependencies
- New published package: `@blackbelt-technology/pi-dashboard-client-utils`.
- `flows-plugin` and `jj-plugin` gain a real dependency on it. Markdown stack (`react-markdown`, `rehype-katex`, `remark-math`, etc.) moves with `MarkdownContent` into `client-utils` as runtime deps; plugins that don't import `MarkdownContent` are unaffected at bundle time (per-subpath exports + Vite tree-shaking).
- The `fdb8593` `"*"` quickfix era ends. Specifiers go back to `^<version>` for good.

### Risk surface
- **Triple rendering deduplication**: the three FlowArchitect call sites have subtle differences (`onDismiss` reset behavior). Parity test required.
- **Predicate emission fix is universal**: the change touches a runtime that affects every plugin (jj, flows-anthropic-bridge, demo). Existing plugins must continue to work.
- **DashboardSession augmentation persists across reconnects**: a flow active on session X must still appear when the browser reconnects mid-flow. Verified via `sessions_snapshot` integration test.
- **CI publish ordering**: a single misconfigured workflow step republishes flows-plugin before client-utils, breaking the registry. The contract test pins the order.
- **Cross-repo move (Layer 3) is deferred**: pi-flows still has no React tooling. After this change ships, the dashboard's `flows-plugin` is a clean, fully-wired plugin in this repo. Moving it to pi-flows is a separate change with its own migration story.
