# Tasks

## 1. Preconditions

- [ ] 1.1 Confirm `wire-plugin-registry-into-shell` is **archived** (or at minimum merged). This change builds on its wiring; it doesn't make sense to start otherwise.
- [ ] 1.2 `rg "FlowActivityBadge|SessionFlowActions" packages/` — confirm `SessionCard.tsx` is the only consumer. If others exist, they need migration too (out-of-scope but flag it).
- [ ] 1.3 Verify `FlowsActionsContext.Provider` placement in `App.tsx` will wrap every `<SessionList>` mount (mobile + desktop).

## 2. Context module + provider

- [ ] 2.1 Create `packages/flows-plugin/src/client/FlowsActionsContext.tsx` per design Decision 2:
  - `FlowsActionsValue` interface (`flows`, `commands`, `onFlowAction`).
  - `FlowsActionsContext` with `null` default.
  - Named exports: `FlowsActionsProvider`, `useFlowsActions`.
  - `useFlowsActions` throws a clear "must be inside provider" error.
- [ ] 2.2 Add `FlowsActionsContext` and `FlowsActionsProvider` exports to `packages/flows-plugin/src/client/index.tsx`.
- [ ] 2.3 In `packages/client/src/App.tsx`, import `FlowsActionsProvider` and wrap the subtree containing `<SessionList>` (and any other `<SessionCard>` mount) with `<FlowsActionsProvider value={{ flows, commands, onFlowAction }}>`. Make sure mobile + desktop branches both inherit it.

## 3. Component refactors

- [ ] 3.1 `packages/flows-plugin/src/client/FlowActivityBadge.tsx`:
  - Change signature from `({ flowName, agentsDone, agentsTotal, status })` to `({ session }: { session: DashboardSession })`.
  - Self-gate: `if (!session.activeFlowName) return null;`.
  - Derive `flowName, status, agentsDone, agentsTotal` from `session`.
  - Keep render JSX unchanged.
- [ ] 3.2 `packages/flows-plugin/src/client/SessionFlowActions.tsx`:
  - Change signature to `({ session }: { session: DashboardSession })`.
  - `const { flows, commands, onFlowAction } = useFlowsActions();`
  - Compute `hasFlowsNew = commands.some(c => c.name === "flows:new")` (and the `Edit/Delete` variants).
  - Self-gate: `if (flows.length === 0 && !hasFlowsNew) return null;`.
  - Render JSX unchanged.
- [ ] 3.3 Type-check the change clean: `npx tsc --noEmit -p tsconfig.json`.

## 4. Vite-plugin predicate emission

- [ ] 4.1 In `packages/dashboard-plugin-runtime/src/vite-plugin/index.ts → generateRegistryContent`:
  - Collect predicate names alongside component names.
  - Emit a single combined named-import line.
  - Append `, predicate: <name>` to each `ClaimEntry` literal that has a predicate.
- [ ] 4.2 Add a build-time validation step: read the plugin's client entry source, check that every claimed `component` and `predicate` name appears as a named export. Fail with a clear message identifying the offending plugin + missing name on mismatch.
- [ ] 4.3 Regenerate after manual `vite build`; inspect `packages/client/src/generated/plugin-registry.tsx` and confirm predicate bindings appear.

## 5. Manifest restoration

- [ ] 5.1 In `packages/flows-plugin/package.json`:
  - Restore the two claims under `pi-dashboard-plugin.claims`:
    - `{ slot: "session-card-badge", component: "FlowActivityBadge", predicate: "hasActiveFlow" }`
    - `{ slot: "session-card-action-bar", component: "SessionFlowActions" }`
  - Remove the `//pi-dashboard-plugin-deferred-claims` informational field added by `wire-plugin-registry-into-shell`.

## 6. Shell cleanup

- [ ] 6.1 In `packages/client/src/components/SessionCard.tsx`:
  - Remove the two direct `<FlowActivityBadge>` JSX render sites (mobile-compact list + desktop card).
  - Remove the direct `<SessionFlowActions>` JSX render site.
  - Drop the `FlowActivityBadge, SessionFlowActions` named imports from `@blackbelt-technology/pi-dashboard-flows-plugin/client`.
- [ ] 6.2 Verify `<SessionCardBadgeSlot session={s}/>` and `<SessionCardActionBarSlot session={s}/>` are still mounted in both render paths (mobile + desktop). They were left in by the parent change.
- [ ] 6.3 Confirm no orphaned `flows`/`onFlowAction` JSX props are passed into `<SessionCard>` from `<SessionList>`. If so, drop the props from the component signature too — they now flow via context.

## 7. Tests

- [ ] 7.1 Create `packages/flows-plugin/src/client/__tests__/FlowActivityBadge-session-shape.test.tsx`:
  - Render with `session.activeFlowName = undefined` → expect `null` (no DOM).
  - Render with `session.activeFlowName = "build"` and `flowStatus = "running"` → assert content shows `build` + the running spinner.
  - Render with each `flowStatus` variant → assert correct icon class/color.
- [ ] 7.2 Create `packages/flows-plugin/src/client/__tests__/SessionFlowActions-context.test.tsx`:
  - Render outside provider → expect a thrown error from `useFlowsActions`.
  - Render inside provider with empty `flows` and no `flows:new` command → expect `null`.
  - Render with `flows.length > 0` and `flows:new` present → expect the buttons; click one and assert `onFlowAction` called with correct args.
- [ ] 7.3 Create `packages/dashboard-plugin-runtime/src/__tests__/vite-plugin-predicate-emission.test.ts`:
  - Stub a plugin manifest with `predicate: "isThing"` claim and a fake client module that exports `isThing`.
  - Run `generateRegistryContent`; assert output contains `import { …, isThing } from …` and `predicate: isThing` in the literal.
  - Stub another with a predicate name that doesn't exist; assert validation throws with the missing-name error message.
- [ ] 7.4 Create `packages/client/src/__tests__/session-card-no-double-flow.test.tsx`:
  - Mock a flow-active session; render `<SessionCard>` inside `FlowsActionsProvider` and `PluginContextProvider` (with the populated registry).
  - Assert exactly one `[data-testid="flow-activity-badge"]` (add the testid in 3.1 if not present) and one action bar.
- [ ] 7.5 Update `packages/client/src/__tests__/plugin-registry-populated.test.ts`:
  - Restore the per-entry "every entry has ≥1 claim" assertion (Decision 5).
  - Keep the "≥1 claim total" assertion as a defense-in-depth check.

## 8. Spec deltas

- [ ] 8.1 Edit `openspec/changes/migrate-flows-jsx-to-slots/specs/dashboard-plugin-loader/spec.md` (delta file):
  - Modify the existing requirement *"Vite plugin generates a static plugin registry"* to add a sentence about predicate emission and a new scenario covering predicate name resolution + tree-shaking.
- [ ] 8.2 Run `openspec validate migrate-flows-jsx-to-slots --strict`; resolve any errors.

## 9. Documentation update

- [ ] 9.1 Per AGENTS.md → Documentation Update Protocol, delegate updates to a general-purpose subagent in caveman style:
  - Touch `docs/file-index-plugins.md`: update the row for `packages/flows-plugin/src/client/SessionFlowActions.tsx` and add a row for `packages/flows-plugin/src/client/FlowsActionsContext.tsx`.
  - Touch `docs/file-index-client.md`: append to the `App.tsx` row that it now provides `FlowsActionsContext`.

## 10. Verification

- [ ] 10.1 `npx tsc --noEmit -p tsconfig.json` clean.
- [ ] 10.2 `npm run build` clean. Verify generated `plugin-registry.tsx` contains:
  - One entry for `flows` with two claims (badge + action bar).
  - The badge claim has `predicate: hasActiveFlow` (function reference, not string).
- [ ] 10.3 `npm test` — full suite green; new test files all passing.
- [ ] 10.4 `npm run dev` manual smoke test:
  - Open a session with an active flow → exactly one `FlowActivityBadge` renders, in the slot area below OpenSpec actions (same position the jj badge moved to in the parent change).
  - Click a flow action button → it dispatches correctly.
  - Open a session without flows → no badge, no action bar.
- [ ] 10.5 `openspec archive migrate-flows-jsx-to-slots` after merge.
