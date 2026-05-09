# Tasks

## 1. Manifest + validator

- [ ] 1.1 Extend `PluginManifest` with optional `dependsOn?: string[]` and `essential?: boolean` in `packages/shared/src/dashboard-plugin/manifest-types.ts`.
- [ ] 1.2 Validate the new fields in `packages/dashboard-plugin-runtime/src/manifest-validator.ts`: kebab-case ids, no self-reference, type-correct.
- [ ] 1.3 Add a discovery-level cycle check that runs after `discoverPlugins()` and marks every plugin in the cycle with `loaded: false, error: "cycle: a→b→…→a"`. Discovery itself MUST NOT throw; one broken manifest cannot brick startup. Cover with a unit test asserting non-cycle plugins still load.

## 2. Dependency graph

- [ ] 2.1 Add `packages/dashboard-plugin-runtime/src/dependency-graph.ts` exporting `Graph`, `buildGraph(plugins, configEnabled)`, and `computeToggleImpact(graph, id, target)`.
- [ ] 2.2 Re-export from the runtime barrel `packages/dashboard-plugin-runtime/src/index.ts`.
- [ ] 2.3 Unit tests: cascade enable / cascade disable / blockers / essential refusal / ghost handling.

## 3. PluginStatus enrichment

- [ ] 3.1 Extend `PluginStatus` in `packages/shared/src/dashboard-plugin/plugin-status.ts` with `displayName`, `essential`, `dependsOn`, `dependents`, `missingDeps?`, `installed`.
- [ ] 3.2 Update `plugin-status-store` to accept and emit the new fields.
- [ ] 3.3 Update `loader.ts` to populate them and to mark `loaded: false, error: "missing dep"` when a dep is disabled or missing.
- [ ] 3.4 Update existing loader tests for the enriched payload.

## 4. Server routes

- [ ] 4.1 Add `packages/server/src/routes/plugin-activation-routes.ts` with `GET /api/plugins` and `POST /api/plugins/:id/toggle` (auth-gated through the same chain as `/api/config/plugins/:id`).
- [ ] 4.2 Toggle handler calls `computeToggleImpact`, returns 403 / 409 / 200 per proposal, performs a single atomic config write for the cascade, broadcasts `plugin_config_update` for every affected id.
- [ ] 4.3 Ghost-removal branch: `{ enabled: false, remove: true }` strips the entry from `config.plugins`.
- [ ] 4.4 Wire the routes module into `packages/server/src/server.ts` next to the existing plugin-config route.
- [ ] 4.5 Route-level tests covering essential refusal, cascade write, blocker 409, ghost removal, auth gating.

## 5. Client runtime — slot registry filter

- [ ] 5.1 Extend `slot-registry.ts` with `setEnabledSet(ids)` and `getAllPluginsForActivationUi()`. Internal filter applied in `getClaims`.
- [ ] 5.2 Unit tests: default state shows all; after `setEnabledSet`, disabled plugin's claims are filtered from every slot.
- [ ] 5.3 Wire `App.tsx` to call `setEnabledSet` on `/api/health` response and on every `plugin_config_update` broadcast.

## 6. Settings UI

- [ ] 6.1 Add `packages/client/src/lib/plugins-api.ts` with `listPlugins`, `togglePlugin`, `removeGhostPlugin`, `searchPlugins`, `installPlugin`, `uninstallPlugin`.
- [ ] 6.2 Add `packages/client/src/components/PluginsSection.tsx`: table, source/status pills, dependsOn chips, toggle, expand chevron when the plugin has a `settings-section` claim, cascade confirm dialog, essential tooltip, ghost rows with Remove button, Uninstall button on `installed` rows.
- [ ] 6.3 Add `packages/client/src/components/PluginSettingsHost.tsx` rendering all `settings-section` claims for a given `pluginId`, used by `PluginsSection`'s expanded row body.
- [ ] 6.4 Add `packages/client/src/components/PluginsInstallSection.tsx`: npm search input + result rows with Install button + `alsoExtension` hint badge; AND a direct-source input that accepts any `parseSourceKind`-recognised string (npm spec, git URL, https tarball, abs/rel path). On Install, capture the returned `operationId` in a local `Set<string>` and render progress via a shared `PackageOperationsList`-style consumer (filtered to captured ids) listening to the existing `package_progress` and `package_operation_complete` WS events. **No new WS message types are introduced.**
- [ ] 6.5 Add a new "Plugins" tab to `SettingsPanel` rendering, in order: `PluginsSection`, `PluginsInstallSection`.
- [ ] 6.6 Leave every existing `<SettingsSectionSlot tab="..." />` invocation in `SettingsPanel.tsx` UNCHANGED. Plugin-contributed sections that set `claim.tab` continue to render in their chosen tab (additive, backward compatible).
- [ ] 6.7 Restart-required banner that fires whenever any toggle, install, or uninstall has been issued since the last server start. Use `/api/health.startedAt` (ISO timestamp; add to the health payload if not already present) as the comparison key, not `uptime` seconds. Ghost-removal does NOT trigger the banner.
- [ ] 6.8 Component tests with React Testing Library: cascade dialog, essential disabled, ghost remove flow, install + uninstall happy paths, install rollback when manifest invalid, expanded row renders the plugin's settings section.

## 6b. Server install / uninstall (delegated to pi)

- [ ] 6b.1 Add `packages/server/src/routes/plugin-install-routes.ts` with `GET /api/plugins/search`, `POST /api/plugins/install` (body `{ source: string }`), `POST /api/plugins/:id/uninstall`. Auth-gated through the same chain as `/api/config/plugins/:id`.
- [ ] 6b.2 Wire `npm-search-proxy` to accept the `pi-dashboard-plugin` keyword filter and to compute `alsoExtension: boolean` from each result's keywords.
- [ ] 6b.3 Bootstrap the private dashboard scope: ensure `~/.pi/dashboard/plugins/.pi-scope/` exists with an empty `settings.json` containing `{ packages: [] }` on first install.
- [ ] 6b.4 Pass the **existing singleton** `PackageManagerWrapper` from `server.ts` into `registerPluginInstallRoutes(...)` (next to `registerPackageRoutes`). Do NOT construct a second wrapper. On `POST /api/plugins/install`, call `wrapper.run({ action: "install", source, scope: "local", cwd: <private-scope> })`; on success resolve the package's on-disk path via pi's package manager and read its `pi-dashboard-plugin` manifest. Surface `PackageOperationBusyError` as 409 in the same shape `/api/packages/install` returns.
- [ ] 6b.5 Manifest validation + rollback: when the install completes but manifest validation fails (cycles, missing fields, id collision with built-in), call `wrapper.run({ action: "remove", source, scope: "local", cwd: <private-scope> })` to roll back; return 4xx with the validation error.
- [ ] 6b.6 On successful install: call `registerBridgeExtension` if `manifest.bridge` is present; set `config.plugins.<id> = { enabled: true, installSpec: <source> }`; broadcast `plugin_config_update`. The route returns 200 `{ success: true, data: { operationId } }` synchronously (mirroring `/api/packages/install` exactly); the post-install steps run inside the wrapper's complete-listener flow so the existing `package_operation_complete` event signals the user-visible end of the operation.
- [ ] 6b.7 Implement uninstall: `wrapper.run({ action: "remove", source: <installSpec>, scope: "local", cwd: <private-scope> })`, scrub `dashboardPluginBridges.dashboard-<id>`, scrub `config.plugins.<id>`, broadcast `plugin_config_update`. Idempotent; missing artifacts not errors.
- [ ] 6b.8 Extend `discoverPlugins()` to also scan the private scope's `packages[]`, resolve each entry to its on-disk path via pi's package manager, and merge with monorepo built-ins. Built-in wins on id collision; user copy recorded with `status=error("id conflict")`.
- [ ] 6b.9 Extend `PluginStatus` with `source`, `installPath`, `installSpec` and update the status store + `/api/health.plugins[]`.
- [ ] 6b.10 Tests: install happy paths for `npm:`, `git:`, protocol-URL tarball, abs path, rel path (each delegating to pi); install rollback when manifest invalid (verify pi `remove` called); install rollback when bridge registration fails; uninstall idempotency; id-collision detection; `alsoExtension` flag in search response; `installSpec` round-trips through status; **shared-queue test**: an extension install in flight makes `POST /api/plugins/install` return 409 with `PackageOperationBusyError` shape (and vice versa); plugin-install progress events fire on the same listener registered for extension installs.

## 7. Repo-lint

- [ ] 7.1 Test asserting that `PluginStatus` field set in shared types matches what `plugin-status-store` writes.
- [ ] 7.2 Test asserting `plugin_config_update` is broadcast for every plugin id in a cascade write.
- [ ] 7.3 Test asserting `SettingsPanel.tsx` STILL calls `<SettingsSectionSlot tab="general" />` (and the other legacy `tab` values) so backward compat is preserved. Plugin-contributed settings flow through both `PluginSettingsHost` and the legacy slot consumer.
- [ ] 7.4 Test asserting `browser-protocol.ts` has NO new message type for plugin installs — plugin progress and completion ride on `package_progress` / `package_operation_complete` exclusively.

## 8. Docs

- [ ] 8.1 Update `docs/file-index-shared.md`, `docs/file-index-server.md`, `docs/file-index-client.md` with the new files (caveman style, alphabetical insertion).
- [ ] 8.2 Add entries to AGENTS.md "Key Files" only for the load-bearing additions: `dependency-graph.ts`, `plugin-activation-routes.ts`, `PluginsSection.tsx`. ≤ 200 chars per row.
- [ ] 8.3 Note the toggle workflow + restart-required model in `docs/architecture.md` under the existing plugin section.
