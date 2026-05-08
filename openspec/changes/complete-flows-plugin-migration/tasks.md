## 1. Phase 0 — Vite plugin predicate emission (unblocker)

- [x] 1.1 Read `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts::generateRegistryContent` and confirm current emission shape (component-only).
- [x] 1.2 In `generateRegistryContent`, collect `claim.predicate` names alongside `claim.component` names; merge into the per-plugin named-import list with deduplication.
- [x] 1.3 In the per-claim emitted literal, append `, predicate: <name>` whenever `claim.predicate` is set, alongside the existing `Component: <name>`.
- [x] 1.4 Add build-time validation: read the plugin's resolved client entry source (text-based regex extraction — lighter than dynamic import); verify every named ref (component AND predicate) exists in its exports; fail loudly with plugin id, slot, missing name, entry path, and exported names list. Soft-skip when source unreadable.
- [x] 1.5 Create `packages/dashboard-plugin-runtime/src/__tests__/vite-plugin-predicate-emission.test.ts` with cases: predicate emitted; predicate-typo build failure; component-typo build failure; no-predicate emission omits the field; soft-skip on unreadable entry; deduplication when same name used across claims.
- [x] 1.6 Run tests via `HOME=$(mktemp -d) npx vitest run --project @blackbelt-technology/dashboard-plugin-runtime` — 9 files / 64 tests pass, including 6 new predicate-emission tests.
- [x] 1.7 `npm run build` regenerated `packages/client/src/generated/plugin-registry.tsx`. Verified jj-plugin's three predicates (`isInJjWorkspace`, `isInJjRepo`, `isInGitRepoButNotJj`) appear as named imports AND as `predicate:` fields on the matching ClaimEntry literals; flows-anthropic-bridge claim correctly omits predicate.

## 2. Phase 0 — sync-versions.js hardening

- [x] 2.1 Read `scripts/sync-versions.js` and identify the rewrite loop (lines ~85–115 in the original).
- [x] 2.2 Extracted classifier `isRewritableSemverSpec` into `scripts/sync-versions-spec.js` (importable without side effects); regex `/^[\^~]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/` accepts plain/caret/tilde + prerelease/build forms.
- [x] 2.3 In the rewrite loop, non-rewritable specifiers are preserved and `console.warn` emits a line naming the dependent `package.json`, the dep, and the preserved value. Final summary reports preserved count separately from rewritten count.
- [x] 2.4 Updated header docblock with a "Specifier preservation" section explaining the rule and the rationale.
- [x] 2.5 Created `packages/shared/src/__tests__/sync-versions-spec.test.ts` covering: rewritable forms (plain/caret/tilde/prerelease/build/multi-digit); preserved forms (`*`, `latest`, dist-tag, `workspace:*`, `workspace:^X`, github URL, github tarball, `git+ssh`, `file:`, `http:` tarball, `>=1.0.0`, `||` union, `1.x`, empty, whitespace-only, partial caret); non-string inputs (undefined/null/number/object). 30 cases all pass.
- [x] 2.6 Smoke test: seeded `"@blackbelt-technology/pi-dashboard-flows-plugin": "*"` in `packages/client/package.json`, ran `node scripts/sync-versions.js`. The `*` pin was preserved with a warning; the script restored existing `^0.5.0` deps untouched (already in sync). Snapshot reverted clean.

## 3. Layer 1 — Create client-utils workspace

- [ ] 3.1 `mkdir -p packages/client-utils/src`.
- [ ] 3.2 Create `packages/client-utils/package.json` with: name `@blackbelt-technology/pi-dashboard-client-utils`, version matching root, `"type": "module"`, `publishConfig.access: "public"`, `peerDependencies` for react/react-dom (`>=18.0.0`), `dependencies` for the markdown stack + MDI + `pi-dashboard-shared`, `files: ["src/"]`.
- [ ] 3.3 Create `packages/client-utils/tsconfig.json` extending `tsconfig.base.json` with `compilerOptions.jsx: "react-jsx"` and `outDir` matching workspace convention.
- [ ] 3.4 Add `"packages/client-utils"` to root `package.json#workspaces`.
- [ ] 3.5 Run `npm install` to wire the workspace symlink; verify `node_modules/@blackbelt-technology/pi-dashboard-client-utils` resolves to `packages/client-utils/`.

## 4. Layer 1 — Move source files (preserve git history)

- [ ] 4.1 `git mv packages/client/src/components/AgentCardShell.tsx packages/client-utils/src/AgentCardShell.tsx`
- [ ] 4.2 `git mv packages/client/src/components/MarkdownContent.tsx packages/client-utils/src/MarkdownContent.tsx`
- [ ] 4.3 `git mv packages/client/src/components/DialogPortal.tsx packages/client-utils/src/DialogPortal.tsx`
- [ ] 4.4 `git mv packages/client/src/components/ConfirmDialog.tsx packages/client-utils/src/ConfirmDialog.tsx`
- [ ] 4.5 `git mv packages/client/src/components/SearchableSelectDialog.tsx packages/client-utils/src/SearchableSelectDialog.tsx`
- [ ] 4.6 `git mv packages/client/src/components/ZoomControls.tsx packages/client-utils/src/ZoomControls.tsx`
- [ ] 4.7 `git mv packages/client/src/components/agent-card-utils.ts packages/client-utils/src/agent-card-utils.ts`
- [ ] 4.8 `git mv packages/client/src/hooks/useZoomPan.ts packages/client-utils/src/useZoomPan.ts`
- [ ] 4.9 `git mv packages/client/src/hooks/useMobile.tsx packages/client-utils/src/useMobile.tsx`
- [ ] 4.10 `mkdir -p packages/client-utils/src/extension-ui` and `git mv` AgentMetricSlot/BreadcrumbSlot/GateSlot from `packages/client/src/components/extension-ui/`.
- [ ] 4.11 Move co-located tests: `packages/client/src/components/__tests__/{MarkdownContent,DialogPortal}.test.tsx` → `packages/client-utils/src/__tests__/`. Move `packages/client/src/hooks/__tests__/{useZoomPan,useMobile}.test.tsx` likewise.
- [ ] 4.12 Update intra-package imports inside the moved files (any `from "../hooks/..."` etc. that now points to a stale relative location must be rewritten to a same-package path within client-utils).
- [ ] 4.13 Verify `git log --follow packages/client-utils/src/MarkdownContent.tsx` shows pre-move history.

## 5. Layer 1 — Per-subpath exports map

- [ ] 5.1 In `packages/client-utils/package.json`, add an `exports` map entry for each of the 12 moved files plus 4 test moves: paths under the keys listed in spec `client-utils-package` (one subpath per symbol; no barrel `.` entry).
- [ ] 5.2 Run a quick smoke import in a temporary scratch file to verify each subpath resolves under both Node and Vite.
- [ ] 5.3 Build the production bundle for `packages/client/` and verify (via grep) that the markdown stack appears only in chunks that consumed `MarkdownContent`.

## 6. Layer 1 — Re-export shims at original locations

- [ ] 6.1 Create `packages/client/src/components/AgentCardShell.tsx` as a single re-export line: `export * from "@blackbelt-technology/pi-dashboard-client-utils/AgentCardShell";` plus a one-line comment.
- [ ] 6.2 Repeat 6.1 for each of the other 11 moved files at their original locations.
- [ ] 6.3 Verify TypeScript still compiles by running `npm run build -w @blackbelt-technology/pi-dashboard-web`.
- [ ] 6.4 Verify the existing client tests (e.g. `MarkdownContent.test.tsx` re-import path, if any test still lives in client) resolve through the shims.

## 7. Layer 1 — Update plugin imports + cross-package deep import lint

- [ ] 7.1 Add `@blackbelt-technology/pi-dashboard-client-utils` as a dependency in `packages/flows-plugin/package.json` and `packages/jj-plugin/package.json` (caret-range matching root version).
- [ ] 7.2 Rewrite the 13 deep relative imports in `packages/flows-plugin/src/client/` to use package-name paths.
- [ ] 7.3 Rewrite all deep relative imports in `packages/jj-plugin/src/client/` (verify with grep first; some plugins may already be clean).
- [ ] 7.4 Create `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts`: scan every `*.ts`/`*.tsx` under `packages/*/src/`; fail when an import specifier starts with `..` and resolves outside the importing package's directory.
- [ ] 7.5 Run `npm test -w @blackbelt-technology/pi-dashboard-shared` and confirm the lint passes against the migrated repo.
- [ ] 7.6 Manually verify by `pnpm pack --dry-run -F flows-plugin` (or `npm pack --workspaces=false -w flows-plugin`) and grepping the inspected tarball for `../../../`.

## 8. Layer 1 — Publish workflow ordering

- [ ] 8.1 Identify the package-publish ordering list in `.github/workflows/publish.yml` (the `PACKAGES` env var inside the electron→publish job).
- [ ] 8.2 Add `@blackbelt-technology/pi-dashboard-client-utils` to that list, BEFORE `pi-dashboard-flows-plugin` and `pi-dashboard-jj-plugin`.
- [ ] 8.3 Update `packages/shared/src/__tests__/publish-workflow-contract.test.ts` to assert the ordering: client-utils precedes flows-plugin and jj-plugin in the parsed list.
- [ ] 8.4 Run the contract test and verify it passes.

## 9. Layer 2 — Extend DashboardSession type

- [ ] 9.1 In `packages/shared/src/types.ts`, add three optional fields to the `DashboardSession` interface: `flowState?: FlowState | null`, `flowStates?: ReadonlyMap<string, FlowState>`, `architectState?: ArchitectState | null`. Import `FlowState` and `ArchitectState` from `@blackbelt-technology/pi-dashboard-flows-plugin/reducer` (already a workspace dep transitively; verify the import works without circular).
- [ ] 9.2 If the import in 9.1 introduces a circular dependency at the type level (likely fine, types-only), confirm by running `tsc --noEmit` on shared. If circular, define minimal local versions of `FlowState` / `ArchitectState` in shared OR re-export them from a dedicated `flow-types.ts` in flows-plugin.
- [ ] 9.3 Run `npm run build` and confirm no TS errors.

## 10. Layer 2 — Bridge populates flow state on session payloads

- [ ] 10.1 Read `packages/extension/src/flow-event-wiring.ts` and `packages/extension/src/session-sync.ts` to locate where `session_register` payloads are constructed.
- [ ] 10.2 Maintain a per-session-id map of latest `FlowState` (and `flowStates` map, and `architectState`) inside the bridge; update it on every `flow:*` / `architect:*` event the bridge already listens for.
- [ ] 10.3 At every `session_register` and at every model-tracker push (whatever the bridge currently uses to refresh the server's view of a session), include the latest known `flowState`, `flowStates`, `architectState` fields on the outgoing payload.
- [ ] 10.4 Verify `MemorySessionManager` carries the augmented fields through to `sessions_snapshot`. (No code change should be needed there if the manager merges the full session object.)
- [ ] 10.5 Add an integration test: spin up a fake bridge that emits `flow_started` then `session_register`; assert the server's session record contains the `flowState` payload.
- [ ] 10.6 Add a reconnect test: with an active flow on session X, simulate browser disconnect + reconnect; assert the first `sessions_snapshot` after reconnect contains `session.flowState`.

## 11. Layer 2 — Deduplicate flow JSX in App.tsx

- [ ] 11.1 Read `packages/client/src/App.tsx` lines around 1000–1110 and document the three FlowArchitect call sites + two FlowDashboard call sites with their exact gating conditions and prop differences.
- [ ] 11.2 Create `packages/client/src/__tests__/flow-rendering-parity.test.tsx`: render scenarios covering (a) architect detail open, (b) flow detail agent open, (c) neither open. Snapshot the rendered JSX for FlowArchitect and FlowDashboard in each scenario. Run the snapshot test against the current code and commit the baseline.
- [ ] 11.3 Refactor App.tsx to render FlowArchitect at most once with combined gating (`selectedState.architectState && (architectDetailOpen || flowDetailAgent || true)`) — the gating reduces to `selectedState.architectState`. Confirm the unified `onDismiss` accepts the combined reset behavior (`setFlowDetailAgent(null)` + dismiss-summary send) safely; if not, preserve the differences via a single closure over `architectDetailOpen` / `flowDetailAgent`.
- [ ] 11.4 Refactor App.tsx to render FlowDashboard at most once with combined gating. Same approach for `onDismiss`.
- [ ] 11.5 Re-run the parity test; snapshots MUST match.
- [ ] 11.6 Manual gate: open a flow, drill into an agent, dismiss the summary. Confirm the drill-down clears as expected.

## 12. Layer 2 — Create FlowsActionsContext and FlowActionsContext

- [ ] 12.1 Create `packages/flows-plugin/src/client/FlowsActionsContext.tsx` exporting `FlowsActionsContext`, `FlowsActionsProvider`, and `useFlowsActions()` hook. Hook throws when called outside provider.
- [ ] 12.2 Create `packages/flows-plugin/src/client/FlowActionsContext.tsx` exporting the per-active-session counterpart with the eight callbacks.
- [ ] 12.3 Add unit tests for both contexts: hook returns provider value; hook throws outside provider; multiple providers nest correctly.
- [ ] 12.4 Re-export both providers and hooks from `packages/flows-plugin/src/client/index.tsx`.

## 13. Layer 2 — Adapt flow components to {session} entry signatures

- [ ] 13.1 `FlowActivityBadge`: change signature to `({ session }: { session: DashboardSession })`. Self-derive `flowName`/`agentsDone`/`agentsTotal`/`status` from `session.flowState`. Return `null` when `session.flowState` is falsy.
- [ ] 13.2 `SessionFlowActions`: change signature to `({ session }: { session: DashboardSession })`. Pull `flows`/`commands`/`onFlowAction` from `useFlowsActions()`. Self-gate when no flows defined.
- [ ] 13.3 `FlowDashboard`: change signature to `({ session }: { session: DashboardSession })`. Self-derive `flowState`/`flowStates` from session. Pull callbacks from `useFlowActions()`.
- [ ] 13.4 `FlowArchitect`: change signature to `({ session }: { session: DashboardSession })`. Self-derive `architectState` from session. Pull callbacks from `useFlowActions()`.
- [ ] 13.5 `FlowAgentDetail`: change signature to `({ session, routeParams, onClose }: SlotProps<"content-view">)`. Look up agent via `session.flowState?.agents.get(routeParams.agentId)`. Use `onClose` for back action.
- [ ] 13.6 `FlowArchitectDetail`: same shape as 13.5; derive state from `session.architectState`.
- [ ] 13.7 `FlowSummary`: change signature to `({ session }: { session: DashboardSession })`. Pull callbacks from `useFlowActions()`.
- [ ] 13.8 In each adapted component, internal rendering logic stays unchanged below the entry boundary.
- [ ] 13.9 Update existing component tests to render with the new signatures + provider wrappers.

## 14. Layer 2 — Export predicates from flows-plugin

- [ ] 14.1 In `packages/flows-plugin/src/client/index.tsx`, export `hasActiveFlow(session: DashboardSession | null | undefined): boolean` returning `Boolean(session?.flowState)`.
- [ ] 14.2 Export `hasActiveArchitect(session: DashboardSession | null | undefined): boolean` returning `Boolean(session?.architectState)`.
- [ ] 14.3 Add unit tests covering true/false/null/undefined inputs for both predicates.

## 15. Layer 2 — Restore manifest claims

- [ ] 15.1 In `packages/flows-plugin/package.json#pi-dashboard-plugin.claims`, populate the seven claims listed in spec `dashboard-shell-slots` (`session-card-badge`, `session-card-action-bar`, `content-header-sticky` × 2, `content-view` × 2, `content-inline-footer`).
- [ ] 15.2 Remove the `"//pi-dashboard-plugin-deferred-claims"` comment block.
- [ ] 15.3 Run `npm run build -w @blackbelt-technology/pi-dashboard-web` and verify the generated `plugin-registry.tsx` contains the new claim entries with their predicate and Component refs.
- [ ] 15.4 Confirm the build-time validation from Phase 0 (task 1.4) catches if any claim references a missing export.

## 16. Layer 2 — Wire context providers in the shell

- [ ] 16.1 In `packages/client/src/App.tsx`, import `FlowsActionsProvider` and `FlowActionsProvider` from `@blackbelt-technology/pi-dashboard-flows-plugin/client`.
- [ ] 16.2 Wrap the session-list area with `<FlowsActionsProvider value={{ flows: sessionFlows.get(selectedId) || [], commands: sessionCommands.get(selectedId) || [], onFlowAction }}>`. Place above `SessionList` so all session cards are descendants.
- [ ] 16.3 Wrap the per-session content area with `<FlowActionsProvider value={{ onAbort, onToggleAutonomous, onDismissSummary, onSendPrompt, onViewYaml, onViewAgentSource, onAgentClick, onPromptRespond }}>`. Each callback is the same closure used in the hard-coded JSX before this change.
- [ ] 16.4 Verify React DevTools shows the providers wrapping their respective subtrees.

## 17. Layer 2 — Remove direct flow JSX from shell

- [ ] 17.1 Delete the `import { FlowDashboard, FlowAgentDetail, FlowArchitect, FlowArchitectDetail } from "@blackbelt-technology/pi-dashboard-flows-plugin/client"` block from `packages/client/src/App.tsx`. Also delete the FlowLaunchDialog import if it's no longer needed (FlowLaunchDialog migration is preserved separately if still gated by interceptors; verify against `remove-flow-dialog-interceptors` proposal interaction).
- [ ] 17.2 Delete the deduplicated FlowArchitect rendering block from App.tsx, replaced by `<ContentHeaderStickySlot session={selectedSession} />` (or whatever slot consumer the shell already invokes there).
- [ ] 17.3 Delete the deduplicated FlowDashboard rendering block, replaced by the same slot consumer (the slot consumer renders both FlowArchitect and FlowDashboard claims when their predicates match).
- [ ] 17.4 Delete the FlowAgentDetail and FlowArchitectDetail content-view JSX, replaced by `<ContentViewSlot session={…} routeParams={…} onClose={…} />` for the matching view ids.
- [ ] 17.5 Delete the FlowSummary inline-footer JSX (if present), replaced by `<ContentInlineFooterSlot session={…} />`.
- [ ] 17.6 Delete `import { FlowActivityBadge, SessionFlowActions } from "@blackbelt-technology/pi-dashboard-flows-plugin/client"` from `packages/client/src/components/SessionCard.tsx` and remove the inline JSX.
- [ ] 17.7 Delete the FlowLaunchDialog import + JSX from `packages/client/src/components/SessionHeader.tsx` if it no longer renders directly (verify against the remove-flow-dialog-interceptors interaction; preserve if that proposal hasn't landed).
- [ ] 17.8 Run `npm run build` and `npm test`. All tests must pass.

## 18. Layer 2 — Regression tests

- [ ] 18.1 Create `packages/client/src/__tests__/session-card-no-double-flow.test.tsx`: render a SessionCard for a session with active flow; assert exactly one FlowActivityBadge instance and one SessionFlowActions instance in the rendered DOM.
- [ ] 18.2 Update `packages/client/src/__tests__/no-jsx-slot-nullish-fallback.test.ts::SCAN_FILES` to include `components/MobileShell.tsx`.
- [ ] 18.3 Run all client tests; the new and updated tests must pass.

## 19. Verification

- [ ] 19.1 Full test suite: `npm test 2>&1 | tee /tmp/pi-test.log` — all tests pass; no regressions.
- [ ] 19.2 Build: `npm run build` — clean TypeScript, no warnings about missing types.
- [ ] 19.3 Type check: `npm run typecheck` (or equivalent if defined) — zero errors.
- [ ] 19.4 Pack inspection: `pnpm pack -F flows-plugin --dry-run` (or npm equivalent) and grep the inspected tarball file list and TypeScript output for any `../../../client/` substring; must be zero hits.
- [ ] 19.5 Vite dev server smoke: `npm run dev`, open the dashboard, confirm the browser console has no errors; spawn a flow; verify the FlowDashboard renders and is fully interactive.
- [ ] 19.6 Reconnect test (manual): spawn a flow, hard-refresh the browser, confirm the flow UI re-renders with the same state from the bridge's perspective.
- [ ] 19.7 Plugin status: open `/api/health` and confirm `plugins.flows` reports `loaded: true` with `claims: 7` (or matches the populated count).
- [ ] 19.8 Predicate filtering: spawn two sessions, run a flow on one only; the FlowActivityBadge appears on the active-flow session card and is absent from the other.

## 20. Documentation + housekeeping

- [ ] 20.1 Update `AGENTS.md` "Key Files" section: add row for `packages/client-utils/` (≤ 200 chars per the documentation update protocol); update `packages/flows-plugin/` row to reflect "fully wired claims".
- [ ] 20.2 Update `docs/file-index.md` and the matching `docs/file-index-<area>.md` splits with detail rows for the new client-utils package, the new tests, and the bridge augmentation.
- [ ] 20.3 Update `CHANGELOG.md` `## [Unreleased]` with a single Internal entry summarizing the migration. Mark the protocol field additions to `DashboardSession` as additive (not breaking).
- [ ] 20.4 Mark obsolete proposals: in `openspec/changes/extract-client-utils-package/`, `openspec/changes/migrate-flows-jsx-to-slots/`, `openspec/changes/migrate-flows-content-slots/` — append a final note pointing readers at this change. (Do not delete; archive after this lands.)
