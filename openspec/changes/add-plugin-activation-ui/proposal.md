## Why

Today every discovered plugin is enabled-by-default and there is no UI to turn one off. The only override is a hand-edited `~/.pi/dashboard/config.json#plugins.<id>.enabled = false`. As the plugin set grows (`flows`, `openspec`, `git`, `jj`, `subagents`, `honcho`, demo fixture, …) users need:

- a single place in Settings to see what is installed and what is on,
- a safe way to toggle plugins, including ones that depend on other plugins,
- a guarantee that disabling a plugin makes its UI vanish completely (not just its server routes),
- the ability to install / uninstall plugins from npm without hand-editing the monorepo.

The runtime already has the load-time half of this: `loadServerEntries` skips plugins where `plugins.<id>.enabled === false`, and `/api/health.plugins[]` reports per-plugin status. The UI half, the dependency model, and the client-side slot-filtering are missing.

## What Changes

### Manifest (additive, backward compatible)

- **MODIFY** `packages/shared/src/dashboard-plugin/manifest-types.ts`: add optional `dependsOn?: string[]` (hard, transitive deps; cycles rejected) and `essential?: boolean` (cannot be toggled off via UI).
- **MODIFY** `packages/dashboard-plugin-runtime/src/manifest-validator.ts`: validate the new fields (string[] of kebab-case ids, no self-reference, no cycles across the discovered set).

### Server runtime

- **MODIFY** `packages/dashboard-plugin-runtime/src/server/loader.ts`:
  - Compute a topological order from `dependsOn` (priority remains the tiebreaker).
  - Before loading, check that every dep is enabled AND discovered. If a dep is missing or disabled, mark the plugin `loaded: false, error: "missing/disabled dep: <id>"` and skip its server entry.
- **MODIFY** `packages/shared/src/dashboard-plugin/plugin-status.ts` (`PluginStatus`): add `displayName: string`, `essential: boolean`, `dependsOn: string[]`, `dependents: string[]`, `missingDeps?: string[]`. Existing fields unchanged.
- **MODIFY** `packages/dashboard-plugin-runtime/src/server/plugin-status-store.ts`: persist the new fields.
- **ADD** `packages/server/src/routes/plugin-activation-routes.ts`:
  - `GET /api/plugins` — full registry (manifest summary + status + computed dep graph).
  - `POST /api/plugins/:id/toggle` — body `{ enabled: boolean }`.
    - 200 `{ restartRequired: true, cascade: { enable?: string[]; disable?: string[] } }` on success (writes `plugins.<id>.enabled` plus any cascaded ids in one config write).
    - 403 `{ reason: "essential" }` when target is essential and `enabled: false`.
    - 409 `{ reason: "blockers", blockers: string[] }` when enabling a plugin whose deps cannot be satisfied (missing from registry).
  - Auth-gated through the same chain as `POST /api/config/plugins/:id`.
- **ADD** `packages/dashboard-plugin-runtime/src/dependency-graph.ts` (pure): `computeToggleImpact(graph, id, target) → { cascadeEnable, cascadeDisable, blockers }`. Used by both the route handler and the UI confirmation dialog (re-exported through the runtime barrel).

### Ghost / orphan handling

- **MODIFY** `GET /api/plugins` to include rows for every plugin id present in `config.plugins.*` even when no manifest is currently discovered. Each ghost row carries `installed: false`, no claims, no manifest fields beyond `id`.
- **MODIFY** `POST /api/plugins/:id/toggle` to accept ghost ids only for the operation `{ enabled: false }` plus an explicit `{ remove: true }` form that strips the entry from `config.plugins`.

### Client runtime — client-side enable filter

- **MODIFY** `packages/dashboard-plugin-runtime/src/slot-registry.ts`:
  - Registry retains every claim from the build-time generated file (unchanged).
  - Add `setEnabledSet(ids: ReadonlySet<string>)` and an internal filter on every `getClaims(slotId)`. Default state (no enabled set yet) keeps the legacy "all claims" behaviour to preserve current tests; once `setEnabledSet` is called the filter is active.
  - Add `getAllPluginsForActivationUi()` that returns the unfiltered manifest summary + status (used only by the activation page).
- **MODIFY** `packages/client/src/App.tsx`: on first `/api/health` response and on every `plugin_config_update` broadcast, call `registry.setEnabledSet(...)`.
- **CONSEQUENCE**: every existing slot consumer (`SettingsSectionSlot`, `SessionCardBadgeSlot`, `ContentViewSlot`, …) automatically renders zero contributions for disabled plugins — including their settings sections, command routes, badges, and tool renderers.

### Settings UI

- **ADD** a new **Plugins** tab to `SettingsPanel`. The new tab renders, in order: the activation list (`PluginsSection.tsx`), the per-plugin settings host (`PluginSettingsHost.tsx`), and the install surface (`PluginsInstallSection.tsx`).
- **ADD** `packages/client/src/components/PluginsSection.tsx` (activation list).
  - Table: name, id, source pill (`built-in` / `installed` / `not installed`), status pill (`enabled` / `disabled` / `error`), `dependsOn` chips, toggle, expand chevron (when the row has a `settings-section` contribution), Uninstall button (only for `installed` rows; never for `built-in`).
  - Expanding a row reveals the plugin's own `settings-section` rendered inline beneath the row.
  - Disabled toggle for `essential: true` plugins, with tooltip.
  - Toggle handler calls `computeToggleImpact` locally to drive a confirm dialog when cascade is non-empty, then `POST /api/plugins/:id/toggle`.
  - "Restart required" banner appears whenever any toggle, install, or uninstall has been issued since the last server start.
- **ADD** `packages/client/src/components/PluginSettingsHost.tsx` rendering each enabled plugin's `settings-section` claim grouped by `pluginId`, used by `PluginsSection`'s expandable row body.
- **ADD** `packages/client/src/components/PluginsInstallSection.tsx` (install + browse).
  - Browse mode: search box backed by `GET /api/plugins/search?q=...` (filter `keywords:pi-dashboard-plugin`).
  - Each search result shows name, description, version, downloads, an "also-extension" badge when the package's npm keywords additionally contain `pi-extension`, and an Install button.
  - Direct-source mode: a single text input that accepts any of the four source forms (npm name, tarball URL, git URL, local path — see install section below) plus an Install button.
  - Install actions call `POST /api/plugins/install`, capture the returned `operationId` in local state, then render progress / completion via the **existing** `PackageOperationsList`-style consumer of `package_progress` and `package_operation_complete` WS events, filtered to the captured operationIds. The Extensions tab does the analogous filtering with its own captured operationIds. **No new WS message types and no new progress endpoint are introduced.**
- **ADD** `packages/client/src/lib/plugins-api.ts` (`listPlugins`, `togglePlugin`, `removeGhostPlugin`, `searchPlugins`, `installPlugin`, `uninstallPlugin`).

### Plugin-contributed settings appear under the Plugins tab (legacy `tab` field still honoured)

- **ADD** rendering of every `settings-section` claim inside the Plugins tab, beneath its owning plugin's row in `PluginsSection`. The Plugins tab is the new canonical home for per-plugin configuration.
- **PRESERVE** the `claim.tab` field and the existing `SettingsSectionSlot` consumer. When a plugin sets `tab` on a `settings-section` claim, the section continues to render in the chosen tab via the existing `<SettingsSectionSlot tab="..." />` calls in `SettingsPanel`. No existing plugin breaks.
- **CONVENTION** going forward: plugin authors who want only the canonical Plugins-tab rendering omit `tab`. Plugin authors who want backward-compat dual rendering (their section in both their chosen tab and inside the plugin row) set `tab` as before.
- The Plugins-tab render is gated by enabled-state (disabled plugin's section disappears via the slot-registry filter). The legacy-tab render is similarly gated, so `tab`-targeted sections also disappear when their plugin is disabled.
- No legacy `<SettingsSectionSlot tab="..." />` invocations are removed. The change is purely additive on the consumer side.

### Install / uninstall — delegated to pi's package manager (full source-format compat)

- **ADD** `~/.pi/dashboard/plugins/.pi-scope/` as a private dashboard plugin scope. It contains a private `settings.json` whose `packages[]` array records every dashboard-installed plugin. The actual package payloads live wherever pi's `DefaultPackageManager` resolves them (npm cache, git cache, etc.) — the dashboard never installs into a flat `<scope>/<id>/` layout. This file is scoped to the dashboard; pi sessions never read it. The directory is created on first install.
- **REUSE** the **singleton** `PackageManagerWrapper` instance constructed in `server.ts` (the same one that backs `/api/packages/install` for pi extensions today). Plugin install and uninstall acquire its `busy` lock just like extension install does, so plugin and extension operations share **one server-wide install queue**, **one progress channel**, and **one completion channel**. Plugin install attempted while another op is in-flight SHALL return 409 with the same `PackageOperationBusyError` shape `/api/packages/install` already returns. The dashboard does NOT construct a second wrapper. Pi's `DefaultPackageManager` is invoked through the wrapper, with `cwd` pointing at the private dashboard scope, and handles every source form exactly as it does for extensions:
  - `npm:<name>` or `npm:<name>@<version>` — npm,
  - `git:<url>` or `git:<url>@<ref>` — git clone + build,
  - `https://...` / `http://...` / `ssh://` / `git://` — protocol URL (tarball or git),
  - absolute or relative filesystem path — local checkout.
  Pi's existing caching, resolution, build hooks, and identity dedup (`computeIdentity`) all apply unchanged. There are no separate strategy modules in the dashboard.
- **MODIFY** `packages/dashboard-plugin-runtime/src/server/loader.ts` `discoverPlugins()` to scan three sources in order:
  1. monorepo `packages/*/package.json` (source: `built-in`, default priority 100),
  2. every entry in the private dashboard scope's `packages[]`, resolved via pi's package manager to its on-disk path (source: `installed`, default priority ≥ 1000),
  3. (already covered) ghost rows from `config.plugins.*` not present in 1 or 2.
  On id collision, the built-in wins; the user-installed copy is recorded with `status=error("id conflict with built-in: <id>")` and `loaded: false`.
- **EXTEND** `PluginStatus` with `source: "built-in" | "installed" | "ghost"`, `installPath?: string` (absolute path resolved by pi's package manager when `source = "installed"`), and `installSpec?: string` (the original source string used to install, for display + reinstall).
- **ADD** `packages/server/src/routes/plugin-install-routes.ts`:
  - `GET /api/plugins/search?q=` — proxies the existing `npm-search-proxy` with the `pi-dashboard-plugin` keyword filter; results carry an `alsoExtension: boolean` flag computed from each package's keywords.
  - `POST /api/plugins/install` — body `{ source: string }`. The handler:
    1. ensures the private scope dir exists,
    2. calls the **shared** `wrapper.run({ action: "install", source, scope: "local", cwd: <private-scope-dir> })` — same singleton wrapper, same queue, same progress / complete listeners as `/api/packages/install`,
    3. returns 200 `{ success: true, data: { operationId } }` immediately (same shape and code `/api/packages/install` returns), THEN proceeds asynchronously: resolves the package path, validates the manifest, on success registers the bridge if `manifest.bridge` is present, sets `config.plugins.<id>.enabled = true`, records `installSpec`, broadcasts `plugin_config_update`. The post-install steps run inside the wrapper's `setCompleteListener` flow so the standard `package_operation_complete` event fires when everything is done.
    4. on validation failure, calls `wrapper.run({ action: "remove", ... })` to roll back; the rollback emits its own `package_operation_complete` carrying the validation error.
    Returns 409 with the same `PackageOperationBusyError` shape when another package operation (extension or plugin) is in flight.
  - `POST /api/plugins/:id/uninstall` — only valid for `source="installed"`. Calls the shared `wrapper.run({ action: "remove", source: <installSpec>, scope: "local", cwd: <private-scope-dir> })`, scrubs `dashboardPluginBridges.dashboard-<id>`, removes `config.plugins.<id>`, broadcasts `plugin_config_update`, returns 200 `{ restartRequired: true }`. Returns 409 `{ reason: "cannot uninstall built-in" }` when the target id resolves to a built-in plugin. Idempotent: missing artifacts are not errors. Returns 409 with `PackageOperationBusyError` shape when the wrapper is busy.
  - All three endpoints auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.
- **CONSEQUENCE**: the user-facing source-string contract for plugin install is **identical** to pi's extension install. Anything that works in `pi pkg install <source>` works in the Plugins tab Install field. New source forms pi adds in the future are picked up automatically.

### Cooperation with pi extension mechanism

- The dashboard SHALL continue to manage only the `dashboardPluginBridges` namespace inside `~/.pi/agent/settings.json`. It SHALL NOT add, remove, or modify entries under `packages[]`.
- When an npm package carries **both** `pi-dashboard-plugin` and `pi-extension` keywords:
  - Install via the Plugins tab installs the package into `~/.pi/dashboard/plugins/<id>/` and registers only the bridge (under `dashboardPluginBridges`). The pi-extension side of the package is *not* added to `packages[]`; the user can install it separately through the existing pi extensions UI if they want pi to load it as a normal extension as well.
  - Disabling the plugin in the Plugins tab SHALL remove only the bridge entry from `dashboardPluginBridges` and SHALL leave any pi-managed `packages[]` entry untouched.
  - Uninstalling the plugin SHALL remove the install directory and the bridge entry, but SHALL NOT touch `packages[]`. The activation row records `alsoExtension: true` so the UI can hint at the parallel extension installation.

### Tests

- Repo-lint: every `PluginStatus` field is exercised by `plugin-status-store` tests.
- Pure: dependency-graph cycle/blocker/cascade test matrix.
- Server: route handler — essential refusal, cascade write, ghost removal, blocker 409.
- Client: registry filter (claims hidden after `setEnabledSet`), activation list shows everything including disabled and ghost rows.

## Out of Scope

- **Hot reload.** Toggles, installs, and uninstalls are persisted immediately but only take effect on the next server restart, matching how pi extensions already behave.
- **Capability-based deps** (`provides` / `requires`). Stays an id-based graph for V1; revisit if multiple plugins legitimately implement the same capability.
- **Per-plugin config UI beyond enable/disable.** Each plugin keeps owning its own `settings-section` slot for richer config; this proposal only adds the activation switch and install/uninstall.
- **Bridge entry hot-toggle.** The auto-register/deregister of `dashboardPluginBridges` in pi's settings already runs on every server boot, so disabling a plugin removes its bridge on the next server + pi-session restart.
- **Cross-managing pi `packages[]`.** Even when a package carries both `pi-dashboard-plugin` and `pi-extension` keywords, the dashboard never edits pi's `packages[]`. Users who want the pi-extension side loaded by pi go through the existing extensions UI.
- **Plugin signing / sandboxing.** V1 trusts npm packages the same way the existing pi extension installer does. A future proposal can add publisher allowlists or a manifest-allowlisted RPC surface.
