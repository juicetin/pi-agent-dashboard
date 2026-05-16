# Plugin Activation UI (Layer 1 + 1.5)

## Why

Today every discovered dashboard plugin is enabled-by-default and there is no UI to turn one off. The only override is hand-editing `~/.pi/dashboard/config.json#plugins.<id>.enabled = false`. Worse, disabling a plugin that way produces **broken UI** — the server skips its routes but the client still renders every claim, so buttons fire against routes that don't exist and silently fail.

Separately, every plugin that depends on a pi extension or external tool today **reimplements its own probe**. `honcho-plugin` hand-polls `/api/packages/installed` looking for `pi-memory-honcho`, caches the result in a module-level `let`, and gates `shouldRender` on it. `jj-plugin` rides a per-session bridge probe for the `jj` binary. Both swallow the "dep missing" signal — the plugin shows as `enabled: true, loaded: true` while its UI silently does nothing, and the user gets no diagnostic.

Meanwhile the dashboard already ships a complete package installer: `UnifiedPackagesSection`, `PackageBrowser`, `RecommendedExtensions`, the full `POST /api/packages/{install,remove,update,move}` pipeline behind a singleton `PackageManagerWrapper`, live progress over `package_progress` / `package_operation_complete`, a 60-second-cached `RECOMMENDED_EXTENSIONS` manifest, and an Electron-bundled first-run preload. **Nothing about plugin install needs to be built — it already exists.** What's missing is the binding between the two metadata worlds: `RECOMMENDED_EXTENSIONS` (which lists `pi-memory-honcho`) and `pi-dashboard-plugin` manifests (which list `honcho-plugin`) describe the same pairing in two unconnected places.

This change adds the **smallest coherent surface** that fixes the broken-disabled-UI bug and lets plugins declaratively express what they need from the existing installer.

## What Changes — Layer 1: Activation

### Manifest (additive, backward compatible)

- **MODIFY** `packages/shared/src/dashboard-plugin/manifest-types.ts`: no new fields in Layer 1. (Manifest gains `requires` in Layer 1.5 below.)

### Server runtime

- **MODIFY** `packages/shared/src/dashboard-plugin/plugin-status.ts` (`PluginStatus`): add `displayName: string`. Existing fields unchanged.
- **MODIFY** `packages/dashboard-plugin-runtime/src/server/plugin-status-store.ts`: accept and emit `displayName`.
- **MODIFY** `packages/dashboard-plugin-runtime/src/server/loader.ts`: populate `displayName` from manifest.
- **ADD** `packages/server/src/routes/plugin-activation-routes.ts`:
  - `GET /api/plugins` — every discovered plugin's manifest summary + status, intended for the activation UI.
  - `POST /api/plugins/:id/toggle` — body `{ enabled: boolean }`.
    - 200 `{ restartRequired: true }` on success (writes `plugins.<id>.enabled`, broadcasts `plugin_config_update`).
    - 404 when the id is not in the discovered set.
  - Auth-gated through the same chain as `POST /api/config/plugins/:id`.

### Client runtime — slot-registry enable filter

- **MODIFY** `packages/dashboard-plugin-runtime/src/slot-registry.ts`:
  - Add `setEnabledSet(ids: ReadonlySet<string>)` and an internal filter on every `getClaims(slotId)`. Default state (no enabled set yet) keeps the legacy "all claims" behaviour to preserve current tests; once `setEnabledSet` is called the filter is active.
  - Add `getAllPluginsForActivationUi()` returning the unfiltered manifest summary plus status, used only by the Plugins tab.
- **MODIFY** `packages/client/src/App.tsx`: on first `/api/health` response and on every `plugin_config_update` broadcast, call `registry.setEnabledSet(...)`.
- **CONSEQUENCE**: every existing slot consumer (`SettingsSectionSlot`, `SessionCardBadgeSlot`, `ContentViewSlot`, command-route, tool-renderer, …) automatically renders zero contributions for disabled plugins. The broken-disabled-UI bug disappears without touching any existing slot consumer.

### Settings UI

- **ADD** a new **Plugins** tab to `SettingsPanel`. The tab renders `PluginsSection` followed by, inline within each row, the plugin's own settings section.
- **ADD** `packages/client/src/components/PluginsSection.tsx`.
  - Table: name, id, status pill (`enabled` / `disabled` / `error`), toggle, expand chevron (when the row has a `settings-section` contribution).
  - Expanding a row reveals the plugin's own `settings-section` rendered inline beneath the row (via `PluginSettingsHost`).
  - "Restart required" banner appears whenever any toggle has been issued since the last server start (compared against `/api/health.startedAt`).
- **ADD** `packages/client/src/components/PluginSettingsHost.tsx` rendering each enabled plugin's `settings-section` claim grouped by `pluginId`, used by `PluginsSection`'s expandable row body.
- **ADD** `packages/client/src/lib/plugins-api.ts` (`listPlugins`, `togglePlugin`).

### Plugin-contributed settings consolidate under the owning plugin's row

- **REMOVE** every `<SettingsSectionSlot tab="..." />` invocation from `SettingsPanel.tsx` (previously fired from the General, Servers, Providers, and Security tabs). Drop the matching import. The legacy dual-render is gone.
- **ADD** rendering of every `settings-section` claim inside the Plugins tab, beneath its owning plugin's row in `PluginsSection`, via `PluginSettingsHost(pluginId)`. The Plugins tab is the **sole** canonical home for per-plugin configuration.
- **PRESERVE** the `claim.tab` manifest field as an inert hint — the validator still accepts it for backwards-compat manifests; no consumer reads it. Plugin authors can omit `tab` going forward.
- The slot-registry enable filter still gates rendering uniformly: a disabled plugin's section disappears.

### Errors are visible and copyable

The Plugins tab surfaces three distinct error channels inline beneath each row, each wrapped in a `CopyableErrorBlock` (icon + monospaced pre + `[Copy]` button using `navigator.clipboard.writeText`):

- **`PluginStatus.error`** — server-reported failures (bridge-probe failures, id conflicts, server-entry import crashes). Replaces the prior hover-tooltip-only surface.
- **`toggleError`** — transient `POST /api/plugins/:id/toggle` failures.
- **Section-level fetch failure** — same block, top of section.

All three use the same theme-aware Tailwind colour pairs so they remain readable on light and dark themes:

```
warning text: amber-700 (light) / amber-300 (dark)
error text:   red-700   (light) / red-300   (dark)
enabled:      emerald-700 (light) / emerald-400 (dark)
```

### Settings affordance is a gear icon

The per-row expand affordance is `mdiCogOutline` rather than a chevron. The button is disabled (40% opacity, `cursor-not-allowed`, tooltip "No settings for this plugin") when the plugin has no `settings-section` claim, and gains an active-bg highlight when expanded (`aria-pressed=true`, tooltip "Hide plugin settings" ↔ "Open plugin settings"). The gear icon mirrors the small gear in the expanded "Plugin settings" header for consistency.

## What Changes — Layer 1.5: Declarative requirements

### Manifest (additive)

- **MODIFY** `packages/shared/src/dashboard-plugin/manifest-types.ts`: add optional `requires?: PluginRequirements` field, where:

  ```ts
  interface PluginRequirements {
    /** pi extension package identifiers (matched via the same logic
        RECOMMENDED_EXTENSIONS uses: name / id / source / displayName). */
    piExtensions?: string[];
    /** Binaries that must resolve on PATH via the tool-registry. */
    binaries?: string[];
    /** Named service probes (registered by plugins or built-in). */
    services?: string[];
  }
  ```

- **MODIFY** `packages/dashboard-plugin-runtime/src/manifest-validator.ts`: validate that `requires.*` arrays contain only kebab-case-or-simple strings, no duplicates, no empty entries.

### Probe runtime

- **ADD** `packages/dashboard-plugin-runtime/src/server/requirement-probes.ts`:
  - `probePiExtension(name): Promise<RequirementStatus>` — queries the existing `/api/packages/installed` data path via `packageManagerWrapper.listInstalled("global")` and matches using the same `sourcesMatch` helper `recommended-routes.ts` already uses. No new I/O surface.
  - `probeBinary(name): Promise<RequirementStatus>` — consults the existing `ToolRegistry` (`packages/shared/src/tool-registry/`). No new strategies.
  - `probeService(name)`: dispatches against a small registry keyed by name; built-in names cover `pi-model-proxy` (already detected by `detectPiModelProxy` in honcho-plugin's server code, lifted into the shared runtime).
  - `runRequirementProbes(manifest): Promise<PluginRequirementReport>` — orchestrates the three probes, returns a structured result.
- **MODIFY** `packages/dashboard-plugin-runtime/src/server/loader.ts`: after each plugin loads (or is skipped), invoke `runRequirementProbes(manifest)` and write the result to the plugin status store. Probes run on a 30-second TTL, refreshed when `/api/health` is fetched or `plugin_config_update` broadcasts.

### PluginStatus enrichment

- **MODIFY** `packages/shared/src/dashboard-plugin/plugin-status.ts`: add

  ```ts
  interface PluginRequirementReport {
    piExtensions: { name: string; satisfied: boolean }[];
    binaries:     { name: string; satisfied: boolean; resolvedPath?: string }[];
    services:     { name: string; satisfied: boolean; error?: string }[];
  }

  interface PluginStatus {
    // …existing fields…
    requirements?: PluginRequirementReport;
    missingRequirements?: string[]; // flat list of unsatisfied names, for badges
  }
  ```

- **MODIFY** `plugin-status-store.ts` to persist and emit the new fields; `/api/health.plugins[]` carries them automatically.

### Cross-reference with the existing installer

- **MODIFY** `packages/shared/src/recommended-extensions.ts` (`RecommendedExtension`): add optional `dashboardPlugin?: string` field naming the companion dashboard plugin id (e.g. `"honcho"` for `pi-memory-honcho`). Populate the field for `pi-memory-honcho` in this change. Leave all other entries unchanged.
- **MODIFY** `packages/server/src/routes/recommended-routes.ts` (`enrichEntry`): propagate `dashboardPlugin` and additionally compute `dashboardPluginInstalled: boolean` by consulting the plugin status store.
- **MODIFY** `packages/client/src/components/RecommendedExtensions.tsx`: when an entry carries `dashboardPlugin`, render an inline "+plugin: <id>" badge next to the status pill.
- **MODIFY** `packages/client/src/components/PluginsSection.tsx`: for each plugin row, if `missingRequirements` is non-empty, render a warning pill listing each missing requirement. For unsatisfied `piExtensions` requirements specifically, render an inline `[Install]` button that calls the existing `usePackageOperations().install(source)` with the matching `RECOMMENDED_EXTENSIONS` entry's source string. Falls back to `[Install via Packages tab]` link when no recommended entry maps to the requirement name.

### Refactor existing plugins onto the requirements model

- **RENAME** `packages/builtins-plugin/` → `packages/roles-plugin/`. Manifest id `"builtins"` → `"roles"`, displayName `"Dashboard Built-ins"` → `"Roles"`, package name `@blackbelt-technology/pi-dashboard-builtins-plugin` → `@blackbelt-technology/pi-dashboard-roles-plugin`. Sole purpose of the plugin is the pi-flows global Roles UI; rename reflects intent and unblocks future common-reusable role-plugin contributions. The `BuiltInRolesSettings` export name is preserved (Vite-plugin named-import generator depends on it).
- **MODIFY** `packages/honcho-plugin/package.json#pi-dashboard-plugin.requires`: declare `{ piExtensions: ["pi-memory-honcho"], services: ["pi-model-proxy"] }`.
- **MODIFY** `packages/honcho-plugin/src/client/hooks.ts`: delete `checkExtensionInstalled`, the module-level `extensionInstalledCache`, `primeExtensionInstalledCache`, and `useExtensionInstalled`. Replace consumers with reads off `PluginStatus.missingRequirements` exposed via the existing plugin context.
- **MODIFY** `packages/honcho-plugin/src/server/routes-lifecycle.ts`: drop the inline `detectPiModelProxy` gate; the loader's requirement probe is the source of truth. Keep the doctor route, but have it read off the cached requirement report instead of re-probing.
- **MODIFY** `packages/jj-plugin/package.json#pi-dashboard-plugin.requires`: declare `{ binaries: ["jj"] }`.
- **MODIFY** `packages/jj-plugin/src/client/predicates.ts`: the existing per-session `jjState` predicate stays (it answers "is *this cwd* a jj repo"), but the broader "is jj available at all" check moves to the requirements model.
- **VERIFY** `flows-anthropic-bridge-plugin` — confirm its existing `lastProbe` mechanism is orthogonal (status events from the bridge) and is preserved unchanged.

## Tests

- Repo-lint: every `PluginStatus` field is exercised by `plugin-status-store` tests.
- Server: route handler — toggle persists + broadcasts; 404 on unknown id.
- Client: registry filter (claims hidden after `setEnabledSet`), activation list shows everything including disabled rows.
- Probe runtime: pure tests for each `probe*` function against mocked installed-list / tool-registry / service registry.
- Honcho / jj refactor: their existing `shouldRender` and predicate tests pass against the new requirements-backed source of truth.
- Cross-reference: `RECOMMENDED_EXTENSIONS` cross-ref renders the `+plugin` badge; missing-requirement rows render the inline `[Install]` button.

## Deployment-fix sub-tasks (Layer 0.5)

While testing the Plugins tab end-to-end on a real Electron install, three deployment-side bugs surfaced. They are scoped into this change because the activation UI is unusable without them.

- **`bundle-server.mjs` SHALL also bundle every first-party `pi-dashboard-plugin` package** into `<bundle>/resources/plugins/<id>/`. The runtime `findBundledPluginsDir()` walks up from `loader.ts` and lands on `~/.pi-dashboard/resources/plugins/` after extraction, which is now non-empty. Fixture-only plugins (`manifest.fixture === true`) SHALL be excluded. Bundled set ships: `roles-plugin`, `jj-plugin`, `flows-plugin`, `honcho-plugin`, `flows-anthropic-bridge-plugin`.
- **The client-side enable-set filter SHALL default-allow build-time-known plugin ids.** `usePluginEnabledSet` now computes the enabled set as `(every id in registry.getAllPluginsForActivationUi()) ∪ (server-reported-enabled ids) \ (server-reported-explicitly-disabled ids)`. This prevents an empty/misconfigured `/api/health.plugins[]` from hiding every claim the build-time `PLUGIN_REGISTRY` embedded into the client.

The Electron `npmGlobal` launch-source mis-detection (the managed install at `~/.pi-dashboard/node_modules/.bin/pi-dashboard` is treated as an external global install, so `extractBundle` never runs on version bumps) is **out of scope** here and tracked separately.

## Out of Scope

- **Plugin install / uninstall via dashboard.** The existing `POST /api/packages/install` already installs pi extensions including any that ship a `pi-dashboard-plugin` manifest. Discovery of those plugins is the subject of a separate proposal (`external-dashboard-plugins`), not this one. Until that lands, only monorepo plugins are visible.
- **Plugin-to-plugin dependencies (`dependsOn`)** and the matching cascade dialog / cycle detection / `essential` flag. None of the current plugins need them. Defer to a future proposal if real demand appears.
- **Ghost rows** (config ids without manifests). No install path means no orphans. Skip until install lands.
- **Hot reload.** Toggles take effect on the next server restart, matching how pi extensions already behave. The Restart-required banner makes this explicit.
- **Per-plugin config UI beyond enable/disable.** Each plugin keeps owning its own `settings-section` slot for richer config; this proposal only adds the activation switch and surfaces missing requirements.
- **A separate plugin search keyword filter.** The existing `/api/packages/search` already filters by package type; dashboard plugins surface there once `external-dashboard-plugins` lands.
