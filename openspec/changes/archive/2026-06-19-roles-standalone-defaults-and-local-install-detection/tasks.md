## 1. Fix canonical source matching (npm ↔ raw)

- [x] 1.1 Add an `npm ↔ raw` branch to `sourcesMatch` in `packages/shared/src/source-matching.ts`: when one side is `npm` and the other `raw`, compare `localPathBasename(raw)` to the unscoped npm name; return `true` on match
- [x] 1.2 Write unit tests in `packages/shared/src/__tests__/` covering: local-path matches npm name, scoped npm name vs unscoped basename, unrelated path no-match, and regression coverage that all existing `npm↔npm`/`git↔git`/`git↔raw`/`git↔npm` matches still pass
- [x] 1.3 Run `npm test 2>&1 | tee /tmp/pi-test.log` and confirm source-matching tests green

## 2. Requirement probe detects git/local installs

- [x] 2.1 In `packages/dashboard-plugin-runtime/src/server/requirement-probes.ts`, confirm `installedMatchesName` delegates its source comparison to the fixed `sourcesMatch` (keep `id/name/displayName` checks)
- [x] 2.2 Add a probe test: a `piExtensions` requirement whose extension is installed from a local path (source = filesystem path) reports `satisfied: true`
- [x] 2.3 Verify `/api/health.plugins[]` no longer reports the subagents pi-extension as missing when installed globally from a local build

## 3. Default role names + seeding (role-manager)

- [x] 3.1 Define `DEFAULT_ROLE_NAMES = ["planning","coding","compact","fast","vision","research"]` in `packages/extension/src/role-manager.ts` (exported) + `overlayDefaultRoles` helper
- [x] 3.2 Overlay defaults in the `flow:role-get-all` response so the reported roles map always includes default names (unassigned where unset)
- [x] 3.3 DECISION (overlay-only): no auto-write. Defaults populate the table via read-time overlay; disk only gets a role on `flow:role-set`. `seedDefaultRoles` dropped; persist spec requirement removed
- [x] 3.4 Update tests in `packages/extension/src/__tests__/role-manager.test.ts`: `flow:role-get-all` overlays defaults on fresh/assigned/malformed config; overlay does not create/modify `providers.json`; assigned roles win over defaults

## 4. `role:resolve-model` structured not-configured error

- [x] 4.1 In the `role:resolve-model` handler, when the role is unconfigured (absent or empty model) set `probe.reason` to a structured "role '<name>' not configured yet" message; keep `probe.resolved` unset and `probe.available` = current roles map
- [x] 4.2 Add tests: assigned role resolves with no `reason`; unconfigured role leaves `resolved` unset and sets a non-empty `reason`; handler stays read-only and does not throw on malformed input

## 5. Roles settings UI — shadow-disabled state

- [x] 5.1 In `packages/roles-plugin/src/RolesSettingsSection.tsx`, render one row per effective role (persisted ∪ defaults); each unassigned role shows a "— set a model —" placeholder
- [x] 5.2 Replace the legacy `data-testid="roles-settings-empty"` empty-state (pi-flows copy) with a single "No roles have been set up — set up now" banner shown only when no role has an assigned model
- [x] 5.3 Keep the plugin enabled/loaded (shadow-disabled) — do not gate rendering on a non-empty persisted map
- [x] 5.4 Update `packages/roles-plugin/src/__tests__/RolesSettingsSection.test.tsx`: default rows render on fresh config, setup banner shows when unconfigured and hides once a role is assigned, no pi-flows copy present

## 6. Decouple Subagents from Roles

- [x] 6.1 Remove `dependsOn: ["roles"]` from the Subagents plugin manifest (package.json `pi-dashboard-plugin`)
- [x] 6.2 Regenerate `packages/client/src/generated/plugin-registry.tsx` (NODE_ENV=production) — subagents entry no longer lists `dependsOn`, no fixture leakage
- [x] 6.3 Update the inline disclaimer in `packages/subagents-plugin/src/client/SubagentsSettings.tsx` to "configure Roles so `@fast` resolves; unconfigured roles report not-configured at spawn; Subagents still loads"
- [x] 6.4 No subagents-plugin test asserts the dependency/disclaimer copy — nothing to update

## 7. Verification & rebuild

- [x] 7.1 Full test suite: my added/modified tests all pass; the only failures (4 in recommended-extensions.test.ts) are PRE-EXISTING (confirmed via stash) and unrelated to this change
- [x] 7.2 Type-check: no new errors from this change (the lone WhatsNewPackageRow.tsx error pre-exists on clean tree)
- [x] 7.3 Built client (`npm run build`) + restarted server (`POST /api/restart`, healthy). Reload deferred per user choice — extension (`role-manager.ts`) change activates on next session reload
- [x] 7.4 Manual QA (after session reload): Roles panel shows default rows + setup banner; assigning a model hides banner; Subagents loads with Roles empty/disabled; global-from-local-build extension shows as installed
- [x] 7.5 Updated `docs/file-index-{shared,extension,plugins,client}.md` rows (delegated to subagent, caveman style); AGENTS.md untouched

## 8. Roles UI redesign (Variant A) — follow-on

- [x] 8.1 Build mock HTMLs (`mocks/roles-ui.html` 3 variants, `mocks/roles-ui-final.html`) with real dark-theme tokens; user picked Variant A
- [x] 8.2 Ported Variant A, then REVERTED per user feedback ("looks worse"): removed role-initial icons, purpose blurbs (`ROLE_DESCRIPTIONS`), per-role color palette, and header progress meter. Back to compact 2-col pill grid
- [x] 8.3 Kept from Variant A: "+ Add model" accent affordance for unconfigured roles + setup error banner (small "set up now" message)
- [x] 8.4 Fixed cramped preset `×`: load button `pr-2` + delete `mr-1.5` gives real gap between name and `×` (earlier fix had reduced the gap); circular hover target, red on hover
- [x] 8.5 Update `RolesSettingsSection.test.tsx` (unassigned label "Add model"); 27 tests pass; client rebuilt + server restarted
