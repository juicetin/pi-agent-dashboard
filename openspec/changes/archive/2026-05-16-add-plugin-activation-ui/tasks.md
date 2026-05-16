# Tasks

## 1. PluginStatus: add `displayName` (Layer 1)

- [x] 1.1 Extend `PluginStatus` in `packages/shared/src/dashboard-plugin/plugin-status.ts` with `displayName: string` (existing fields unchanged).
- [x] 1.2 Update `plugin-status-store.ts` to accept and emit `displayName`.
- [x] 1.3 Update `loader.ts` to populate `displayName` from each manifest at discovery time.
- [x] 1.4 Update existing loader tests for the enriched payload.

## 2. Server routes — toggle (Layer 1)

- [x] 2.1 Add `packages/server/src/routes/plugin-activation-routes.ts` with:
  - `GET /api/plugins` — returns every discovered plugin's manifest summary + status (no ghost rows in V1; only discovered ids).
  - `POST /api/plugins/:id/toggle` — body `{ enabled: boolean }`; writes `plugins.<id>.enabled`, broadcasts `plugin_config_update`, returns 200 `{ restartRequired: true }`. Returns 404 when id is not in the discovered set.
- [x] 2.2 Auth-gate both endpoints through the same Fastify chain as `POST /api/config/plugins/:id`.
- [x] 2.3 Wire the routes module into `packages/server/src/server.ts` next to the existing plugin-config route.
- [x] 2.4 Route-level tests: toggle persists + broadcasts; 404 on unknown id; auth gating.

## 3. Client — slot registry enable filter (Layer 1)

- [x] 3.1 Extend `packages/dashboard-plugin-runtime/src/slot-registry.ts` with `setEnabledSet(ids: ReadonlySet<string>)` and `getAllPluginsForActivationUi()`. Internal filter applied in `getClaims`.
- [x] 3.2 Unit tests: default state shows all claims; after `setEnabledSet`, disabled plugin's claims are filtered from every slot id; `getAllPluginsForActivationUi` bypasses the filter.
- [x] 3.3 Wire `packages/client/src/App.tsx` to call `setEnabledSet` on `/api/health` response and on every `plugin_config_update` broadcast.
- [x] 3.4 Add `/api/health.startedAt` (ISO timestamp) to the health payload if not already present.

## 4. Settings UI — Plugins tab (Layer 1)

- [x] 4.1 Add `packages/client/src/lib/plugins-api.ts` with `listPlugins`, `togglePlugin`.
- [x] 4.2 Add `packages/client/src/components/PluginsSection.tsx`: table with name, id, status pill, toggle, expand chevron when the plugin has a `settings-section` claim; expanded row renders the plugin's settings section.
- [x] 4.3 Add `packages/client/src/components/PluginSettingsHost.tsx` rendering all `settings-section` claims for a given `pluginId`, used by `PluginsSection`'s expanded row body. Sort claims by descending priority then registration order.
- [x] 4.4 Add a new "Plugins" tab to `SettingsPanel` rendering `PluginsSection`.
- [x] 4.5 Leave every existing `<SettingsSectionSlot tab="..." />` invocation in `SettingsPanel.tsx` UNCHANGED. Plugin-contributed sections that set `claim.tab` continue to render in their chosen tab (additive, backward compatible).
- [x] 4.6 Restart-required banner that fires whenever any toggle has been issued since the last server start. Use `/api/health.startedAt` as the comparison key, not `uptime` seconds.
- [x] 4.7 Component tests with React Testing Library: toggle round-trip, expanded row renders the plugin's settings section, banner appears after first toggle, banner clears after a restart (mocked `startedAt` change).

## 5. Manifest — `requires` field (Layer 1.5)

- [x] 5.1 Extend `PluginManifest` in `packages/shared/src/dashboard-plugin/manifest-types.ts` with optional `requires?: PluginRequirements` (with `piExtensions?`, `binaries?`, `services?` string arrays).
- [x] 5.2 Add validation in `packages/dashboard-plugin-runtime/src/manifest-validator.ts`: array entries are non-empty strings, no duplicates, no whitespace-only.
- [x] 5.3 Manifest validator unit tests for valid + invalid `requires` shapes.

## 6. Probe runtime (Layer 1.5)

- [x] 6.1 Add `packages/dashboard-plugin-runtime/src/server/requirement-probes.ts` exporting `probePiExtension`, `probeBinary`, `probeService`, `runRequirementProbes`, and a 30s-TTL cache.
- [x] 6.2 `probePiExtension(name)` consults `packageManagerWrapper.listInstalled("global")` via a callback (no direct dependency from the runtime package on the server package). Match using `sourcesMatch` from `recommended-routes.ts` lifted to a shared helper if needed.
- [x] 6.3 `probeBinary(name)` consults the existing `ToolRegistry` (`packages/shared/src/tool-registry/`). Return `resolvedPath` when satisfied.
- [x] 6.4 `probeService(name)` dispatches against a closed registry of built-in service names. Ship `pi-model-proxy` only; implementation lifts `detectPiModelProxy` out of honcho-plugin into the shared runtime.
- [x] 6.5 `runRequirementProbes(manifest)` orchestrates the three and returns `PluginRequirementReport`.
- [x] 6.6 Modify `loader.ts` to invoke `runRequirementProbes` after each plugin's `loadServerEntry` (or skip), writing the result to the status store. Loader does NOT block on probe outcome.
- [x] 6.7 Hook `refreshRequirementProbes()` into the existing `packageManagerWrapper.setCompleteListener` in `server.ts:931` so a successful install/uninstall/move refreshes every plugin's requirement report and broadcasts `plugin_config_update` for any plugin whose `missingRequirements` changed.
- [x] 6.8 Unit tests: each probe in isolation; report-level test covering mixed satisfied/unsatisfied; TTL behaviour.

## 7. PluginStatus enrichment (Layer 1.5)

- [x] 7.1 Extend `PluginStatus` with `requirements?: PluginRequirementReport` and `missingRequirements?: string[]`.
- [x] 7.2 Update `plugin-status-store.ts` to accept and emit the new fields; refresh entries on probe completion.
- [x] 7.3 Repo-lint: every `PluginStatus` field is exercised by `plugin-status-store` tests.

## 8. Cross-reference with `RECOMMENDED_EXTENSIONS` (Layer 1.5)

- [x] 8.1 Extend `RecommendedExtension` in `packages/shared/src/recommended-extensions.ts` with optional `dashboardPlugin?: string`.
- [x] 8.2 Set `dashboardPlugin: "honcho"` on the `pi-memory-honcho` entry. Leave the other five entries unchanged.
- [x] 8.3 Update the existing `recommended-extensions.test.ts` schema check to allow the new optional field.
- [x] 8.4 Modify `packages/server/src/routes/recommended-routes.ts` `enrichEntry` to propagate `dashboardPlugin` and additionally compute `dashboardPluginInstalled: boolean` from `getPluginStatusStore().listAll()`.
- [x] 8.5 Update `packages/client/src/components/RecommendedExtensions.tsx` to render a small "+plugin: <id>" badge next to the status pill when `dashboardPlugin` is set.

## 9. Plugins tab — surface missing requirements (Layer 1.5)

- [x] 9.1 In `PluginsSection.tsx`, for each row whose `missingRequirements` is non-empty, render a warning pill per missing requirement.
- [x] 9.2 For unsatisfied `piExtensions` requirements where the name matches a `RECOMMENDED_EXTENSIONS.id`: render an inline `[Install]` button that calls the existing `usePackageOperations("global").install(source)` with the matching entry's `source` string. No new install endpoint; no new WS message types.
- [x] 9.3 For unsatisfied requirements with no matching recommended entry: render `[Install via Packages tab]` linking to `/settings?tab=packages`.
- [x] 9.4 Component tests: missing-requirement warning visible; inline `[Install]` button triggers the existing package-operations install path; row updates when `plugin_config_update` arrives with empty `missingRequirements`.

## 10. Refactor honcho-plugin onto requirements (Layer 1.5)

- [x] 10.1 Add `requires: { piExtensions: ["pi-memory-honcho"], services: ["pi-model-proxy"] }` to `packages/honcho-plugin/package.json#pi-dashboard-plugin`.
- [x] 10.2 Delete `checkExtensionInstalled`, `extensionInstalledCache`, `primeExtensionInstalledCache`, `useExtensionInstalled`, and `getHonchoExtensionInstalledSync` from `packages/honcho-plugin/src/client/hooks.ts` and `client/api.ts`.
- [x] 10.3 Replace `shouldRenderHonchoMemory` body with a check against the plugin's `missingRequirements` (read via the existing plugin context).
- [x] 10.4 Update `routes-lifecycle.ts`: drop the inline `detectPiModelProxy` gate. Keep service-unavailable error paths but source the truth from `PluginStatus.requirements.services`.
- [x] 10.5 Update `server/doctor.ts` to read off the cached requirement report; keep its existing API but make the underlying check the shared probe.
- [x] 10.6 Existing honcho tests (`shouldRender.test.ts`, `routes-lifecycle.test.ts`, `doctor.test.ts`) pass against the new source of truth with minimal changes; update mocks to seed `PluginStatus.requirements` instead of the probe endpoint.

## 11. Refactor jj-plugin onto requirements (Layer 1.5)

- [x] 11.1 Add `requires: { binaries: ["jj"] }` to `packages/jj-plugin/package.json#pi-dashboard-plugin`.
- [x] 11.2 Keep the per-session `Session.jjState` predicates (they answer a different question — whether *this cwd* is a jj repo).
- [x] 11.3 If `JjPluginSettings` currently surfaces "jj not installed" diagnostics, switch the source of truth to `PluginStatus.missingRequirements`.

## 12. Lift `detectPiModelProxy` into the runtime (Layer 1.5)

- [x] 12.1 Move `packages/honcho-plugin/src/server/pi-model-proxy-detect.ts` into `packages/dashboard-plugin-runtime/src/server/service-probes/pi-model-proxy.ts` (or equivalent path) and re-export from `requirement-probes.ts`.
- [x] 12.2 Update honcho-plugin to import the shared helper.
- [x] 12.3 Existing `pi-model-proxy-detect.test.ts` continues to pass against the lifted module.

## 13. Repo-lint (both layers)

- [x] 13.1 Test asserting `SettingsPanel.tsx` STILL calls `<SettingsSectionSlot tab="general" />` (and the other legacy `tab` values) so backward compat is preserved.
- [x] 13.2 Test asserting `/api/health` payload always includes `startedAt` (ISO 8601).
- [x] 13.3 Test asserting `browser-protocol.ts` introduces no new message types in this change — toggles ride on the existing `plugin_config_update`; installs ride on the existing `package_progress` / `package_operation_complete`.

## 14. Docs

- [x] 14.1 Update `docs/file-index-shared.md`, `docs/file-index-server.md`, `docs/file-index-client.md`, `docs/file-index-plugins.md` with the new files (caveman style, alphabetical insertion). Delegate to a general-purpose subagent per the Documentation Update Protocol.
- [x] 14.2 Add entries to AGENTS.md "Key Files" only for the load-bearing additions: `plugin-activation-routes.ts`, `requirement-probes.ts`, `PluginsSection.tsx`. ≤ 200 chars per row.
- [x] 14.3 Note the toggle workflow + requirements model + restart-required model in `docs/architecture.md` under the existing plugin section.

## 15. Layer 2 — plugin-to-plugin dependency graph (resumed from Robert's original)

- [x] 15.1 Extend `PluginManifest` with optional `dependsOn?: string[]`.
- [x] 15.2 Manifest validator rejects non-string entries, empty/whitespace, self-references, duplicates.
- [x] 15.3 Add `packages/dashboard-plugin-runtime/src/dependency-graph.ts`: `buildGraph`, `transitiveDependents`/`transitiveDependencies`, `computeToggleImpact`, `detectCycles`, `topologicalSort`.
- [x] 15.4 Re-export `dependency-graph` from `dashboard-plugin-runtime/server` (server callers avoid the React-y main barrel).
- [x] 15.5 Loader: detect cycles after `discoverPlugins()` and mark every plugin in a cycle with `loaded: false, error: "cycle: a→b→...→a"`. Discovery does NOT throw.
- [x] 15.6 Loader: process plugins in topologically-sorted order (deps before dependents; priority tiebreak).
- [x] 15.7 Loader: if any `dependsOn` entry is missing from discovery OR disabled in config, skip the server entry and set `missingDeps: string[]` + matching error.
- [x] 15.8 `PluginStatus` gains `dependsOn`, `dependents`, optional `missingDeps`; populated by loader via inverse-graph walk.
- [x] 15.9 `GET /api/plugins` adds `dependsOn` and computed `dependents` to every row.
- [x] 15.10 `POST /api/plugins/:id/toggle` honours the graph: 409 `{ reason: "blockers", blockers }` when enabling with missing deps; cascade enable/disable in a single atomic config write; broadcast `plugin_config_update` per affected id; response carries `cascade.enable[]` or `cascade.disable[]`.
- [x] 15.11 Client `togglePlugin` recognises 409 → throws `TogglePluginBlockedError(blockers)`; result type carries `cascade`.
- [x] 15.12 `PluginsSection.tsx` renders depends-on / required-by chip strip per row.
- [x] 15.13 `PluginsSection.tsx` shows a cascade confirm dialog before POST when `previewCascade` reports a non-empty cascade.
- [x] 15.14 `PluginsSection.tsx` renders blocker errors via the existing `CopyableErrorBlock`.
- [x] 15.15 Pure tests for the graph module: dependents/dependencies, impact (cascadeEnable/cascadeDisable/blockers), cycle detection, topological sort.
- [x] 15.16 Validator tests for `dependsOn` (non-array, empty, non-string, self-ref, duplicate).
- [x] 15.17 Route tests: blocker 409, cascade enable atomic, cascade disable atomic.
