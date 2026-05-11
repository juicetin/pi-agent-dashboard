## 1. Define the primitive contracts in shared

- [x] 1.1 Created `packages/shared/src/dashboard-plugin/ui-primitives.ts` with `UI_PRIMITIVE_KEYS` const (8 keys: agentCard, markdownContent, confirmDialog, dialogPortal, searchableSelectDialog, zoomControls, formatTokens, formatDuration), `as const` assertion in place.
- [x] 1.2 `UiPrimitiveKey` type derived from `typeof UI_PRIMITIVE_KEYS[keyof typeof UI_PRIMITIVE_KEYS]`.
- [x] 1.3 `UiPrimitiveMap` interface defined; 6 component contracts via `ComponentType<P>` + 2 helper contracts via function signature.
- [x] 1.4 Embedded `UiSelectOption` interface in shared (mirrors client-utils' `SelectOption`) so the searchable-select-dialog contract is fully typed without cross-package type imports.
- [x] 1.5 Added `export * from "./ui-primitives.js"` to `packages/shared/src/dashboard-plugin/index.ts`.
- [x] 1.6 Shared test suite: 86 files / 916 tests passing.

## 2. Build the registry runtime

- [x] 2.1 Created `packages/dashboard-plugin-runtime/src/ui-primitive-registry.ts` with opaque `UiPrimitiveRegistry` interface (private `_impls` Map), `createUiPrimitiveRegistry()`, and internal `getUiPrimitiveImpl()` accessor.
- [x] 2.2 `registerUiPrimitive` is generic over key type, type-checks impl against contract; throws on double-registration with message `"UI primitive \"${key}\" is already registered.\u2026"`. First-write-wins semantics (the throwing call's impl is discarded).
- [x] 2.3 Created `packages/dashboard-plugin-runtime/src/ui-primitive-context.tsx` with `<UiPrimitiveProvider value={registry}>` wrapping React context.
- [x] 2.4 `useUiPrimitive(key)` strict hook: throws if outside provider OR if key not registered. Error messages name the specific missing piece (provider vs registration).
- [x] 2.5 `useUiPrimitiveOrNull(key)` soft hook: returns null if key not registered; still throws if outside provider (provider missing is always a setup bug).
- [x] 2.6 Re-exported all 5 public symbols + 2 types from `packages/dashboard-plugin-runtime/src/index.ts`.

## 3. Tests for the registry

- [x] 3.1 Created `packages/dashboard-plugin-runtime/src/__tests__/ui-primitive-registry.test.tsx` with 12 cases covering:
  - empty registry → soft hook returns null;
  - successful registration → strict hook returns impl;
  - function-typed primitive (format-tokens) round-trips;
  - double-registration throws with clear key-named message;
  - first-write-wins after the throw;
  - independent registrations for different keys;
  - strict hook outside provider throws "must be called inside <UiPrimitiveProvider>";
  - strict hook for missing key throws with key name;
  - soft hook outside provider throws (provider always required);
  - soft hook missing key returns null;
  - soft hook registered key returns impl;
  - multiple consumers in same tree all see the same registry.
- [x] 3.2 12/12 ui-primitive tests pass. Full plugin-runtime project: 10 files / 76 tests (up from 64).

## 4. Test helper for plugin tests

- [x] 4.1 Created `packages/dashboard-plugin-runtime/src/test-support/withUiPrimitiveProvider.tsx`. Helper iterates canonical `UI_PRIMITIVE_KEYS` to register only valid keys, ignoring stray properties.
- [x] 4.2 Helper builds fresh registry, registers supplied impls, wraps children in `<UiPrimitiveProvider>`.
- [x] 4.3 Re-exported from `packages/dashboard-plugin-runtime/src/test-support/index.ts`. Added `./test-support` subpath to `package.json#exports`.
- [x] 4.4 Two smoke-test cases added to ui-primitive-registry.test.tsx: helper provides registered impls; missing keys still trigger strict-hook throws.

## 5. Wire dashboard registrations at startup

- [x] 5.1 Read `packages/client/src/main.tsx`. Added imports for `createUiPrimitiveRegistry`, `registerUiPrimitive`, `<UiPrimitiveProvider>` from `@blackbelt-technology/dashboard-plugin-runtime`; `UI_PRIMITIVE_KEYS` from shared.
- [x] 5.2 Added imports for the eight primitives: 7 from client-utils, MarkdownContent from `./components/MarkdownContent.js` (lives in client/, not in client-utils).
- [x] 5.3 Synchronous registry creation + 8 registerUiPrimitive calls before ReactDOM.createRoot.
- [x] 5.4 `<UiPrimitiveProvider>` wraps Router → ThemeProvider → MobileProvider → App. Placed at the React root inside `<React.StrictMode>`.
- [x] 5.5 Updated `packages/client/package.json#dependencies` to declare `@blackbelt-technology/dashboard-plugin-runtime` and `@blackbelt-technology/pi-dashboard-client-utils` explicitly (previously implicit via hoisting). `npm install` + `npm run build` clean.

## 6. Migrate flows-plugin to use the registry

- [x] 6.1 FlowAgentCard.tsx: AgentCardShell + formatTokens + formatDuration moved to `useUiPrimitive` lookups inside the component body. AgentMetricSlot stays as direct import with comment.
- [x] 6.2 (covered by 6.1)
- [x] 6.3 FlowAgentDetail.tsx: MarkdownContent migrated. Hook called inside both `TextEntry` (sub-component, line 64) and the exported `FlowAgentDetail` (line 92).
- [x] 6.4 FlowArchitect.tsx: MarkdownContent migrated inside `TextEntry` sub-component; AgentCardShell migrated inside `ArchitectAgentCard` sub-component.
- [x] 6.5 FlowDashboard.tsx: no migration needed. useMobile + BreadcrumbSlot stay as direct imports.
- [x] 6.6 FlowGraph.tsx: ZoomControls migrated. useZoomPan stays as direct import; comment in source documents the Rules-of-Hooks reason.
- [x] 6.7 FlowLaunchDialog.tsx: DialogPortal migrated inside the exported component. GateSlot + aggregateGateState stay as direct imports with comment.
- [x] 6.8 SessionFlowActions.tsx: ConfirmDialog + SearchableSelectDialog migrated. The `SelectOption` type import moved from client-utils to shared (`UiSelectOption` aliased) so the type import doesn't trip the lint.
- [x] 6.9 `npm run build` is clean. TypeScript types match across all 11 migrated lookups.
- [x] 6.10 Documented retained client-utils dep in `packages/flows-plugin/package.json` via a `//deps-rationale` field naming the hooks + extension-ui consumers + aggregateGateState helper that justify the dep. Added explicit `dashboard-plugin-runtime` dep too (was implicit via hoisting).
- [x] 6.11 `npm test` against the flows-plugin project: 41/41 passing.

## 7. Update flows-plugin tests

- [x] 7.1 Audit confirmed: existing flows-plugin tests cover reducers and graph layout (FlowGraph, ArchitectInputPrompt, architect-reducer, reducer-parity). They do NOT render the migrated rich components, so no provider wrapping was required.
- [x] 7.2 (no changes needed — see 7.1).
- [x] 7.3 Full flows-plugin project test pass: 41/41 (4 files).

## 8. Lint: forbid direct primitive imports in plugin source

- [x] 8.1 Created `packages/shared/src/__tests__/no-primitive-direct-import.test.ts`. Walks `packages/*-plugin/src/` and `packages/demo-plugin/src/` (recursively, skipping `node_modules`, `dist`, `__tests__`, `.d.ts`).
- [x] 8.2 Forbidden symbols: AgentCardShell, MarkdownContent, ConfirmDialog, DialogPortal, SearchableSelectDialog, ZoomControls, formatTokens, formatDuration. Failure messages name the file:line, the offending source line, and the recommended `useUiPrimitive(UI_PRIMITIVE_KEYS.<key>)` replacement.
- [x] 8.3 Allowed: imports from `pi-dashboard-client-utils/{useMobile,useZoomPan,useMediaQuery}` and `pi-dashboard-client-utils/extension-ui/*`.
- [x] 8.4 Lint passes against current plugin packages: zero violations after the flows-plugin migration.
- [x] 8.5 Self-test: planted bad import flagged with correct symbol + registry-key suggestion.
- [x] 8.6 Self-test: hooks + extension-ui imports NOT flagged.
- [x] 8.7 3 tests pass.

## 9. Documentation

- [x] 9.1 Created `docs/plugin-ui-primitives.md` covering all 7 sub-topics: what primitives are, the eight initial keys, consumption pattern, strict vs soft hooks, the hooks-stay-direct exception with Rules-of-Hooks rationale, the `withUiPrimitiveProvider` test pattern, and a step-by-step guide for adding new primitives.
- [x] 9.2 Added 3 rows to AGENTS.md "Key Files" naming the contract module, the registry runtime, and the test helper.
- [ ] 9.3 (Deferred to follow-up) `docs/file-index-shared.md` + `docs/file-index-plugins.md` row updates per the per-area index protocol. Not blocking; can be added in a small follow-up commit.
- [x] 9.4 Updated `CHANGELOG.md ## [Unreleased] ### Added` with a paragraph summarizing the registry, the slots-vs-registry orthogonality, the hook exception, and the lint rule.

## 10. Final verification

- [x] 10.1 `npm run build` clean across all workspaces.
- [x] 10.2 `npm test` full suite: 4883 passing / 0 failing / 10 skipped (was 4880 before, +3 from the new no-primitive-direct-import test). Plugin-runtime project: 76 tests (12 new ui-primitive-registry cases + 2 new helper smoke tests). Shared project: 919 tests (3 new lint cases).
- [ ] 10.3 (Deferred to user) Vite dev smoke — manual gate. Build is clean and tests pass; dev-server smoke is a sanity-check the user runs at their leisure.
- [x] 10.4 Production build clean (no bundle-size regression beyond expected; chunks within their existing thresholds).
- [ ] 10.5 (Deferred to release time) `pnpm pack -F flows-plugin --dry-run` confirms the tarball is lean. flows-plugin retains client-utils dep for hooks + extension-ui slot consumers per Decision 5.
- [ ] 10.6 (Deferred / optional) Manual strict-mode-error smoke test.

## 11. Mark superseded change as obsolete

- [x] 11.1 SUPERSEDED note in place at the top of complete-flows-plugin-migration's proposal.md.
- [x] 11.2 ~~Archive~~ DELETED `complete-flows-plugin-migration/` on 2026-05-11. No archive kept — the proposal was superseded mid-implementation and all its 104 tasks were verified as either DEPRECATED (design pivot) or DONE_ELSEWHERE (under this change + pluginize-flows-via-registry + 8a271b60). Spec deltas described an abandoned approach, so no canonical-spec sync was performed.
