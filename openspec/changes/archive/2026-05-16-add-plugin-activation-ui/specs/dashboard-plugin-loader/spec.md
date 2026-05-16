# dashboard-plugin-loader Delta

## ADDED Requirements

### Requirement: The Plugins tab SHALL surface plugin errors visibly and copyably

For every plugin row whose `PluginStatus.error` is a non-empty string, the Plugins tab SHALL render the error message inline beneath the row in a panel that satisfies all of:

- the error text is visible without hover, mouse-over, or expansion (no tooltip-only surfaces),
- the text content is rendered in a monospace block preserving whitespace,
- a clearly labelled copy button writes the error text to the clipboard via `navigator.clipboard.writeText`,
- the panel's foreground / background / border colours use Tailwind class pairs that resolve to readable contrast on both light and dark themes (e.g. `text-red-700 dark:text-red-300` plus matching background and border).

Transient errors from `POST /api/plugins/:id/toggle` and section-level fetch failures from `GET /api/plugins` SHALL use the same panel component and colour pairs.

#### Scenario: status.error renders inline with a copy button

- **WHEN** `/api/plugins` returns a plugin row with `status.error = "Bridge path conflict: existing=/a, new=/b"`
- **THEN** the row in the Plugins tab SHALL render the full message in a monospace block beneath the row header, AND a `[Copy]` button that copies the message to the clipboard when clicked.

#### Scenario: error panel is readable on light themes

- **WHEN** the dashboard is rendered with a light theme (no `.dark` class on the root)
- **THEN** the error panel's text colour SHALL be `text-red-700` (or equivalent), and the warning pills SHALL use `text-amber-700`, ensuring the foreground/background contrast is readable.

### Requirement: Plugin manifests SHALL support an optional `dependsOn` field

The `PluginManifest` type SHALL accept an optional `dependsOn?: string[]` field that declares other plugin ids this plugin requires to be present AND enabled. Dependencies SHALL be treated as **hard** and **transitive**. The manifest validator SHALL reject:

- non-string entries,
- empty / whitespace-only strings,
- self-references (the plugin's own `id` appearing in its `dependsOn`),
- duplicate entries.

Dependency cycles SHALL NOT be rejected at validate time — they are detected at discovery time by `detectCycles(graph)` and reported via `PluginStatus.error` for every plugin in the cycle. Discovery itself SHALL NOT throw on a cycle (one broken third-party manifest must not brick the dashboard).

#### Scenario: Self-reference rejected

- **WHEN** plugin `foo` declares `dependsOn: ["foo"]`
- **THEN** the manifest validator SHALL throw `ManifestValidationError` and the plugin SHALL NOT be discovered.

#### Scenario: Cycle soft-fails the involved plugins

- **WHEN** plugin `a` declares `dependsOn: ["b"]` and plugin `b` declares `dependsOn: ["a"]`
- **THEN** discovery SHALL NOT throw; it SHALL mark both `a` and `b` with `loaded: false, error: "cycle: a→b→a"` (or the equivalent rotation) and SHALL skip both server entries; other discovered plugins SHALL load normally.

### Requirement: The loader SHALL skip plugins whose dependencies are missing or disabled

When loading server entries, the loader SHALL evaluate each plugin's `dependsOn` against the current enabled set. If any dependency is either absent from discovery OR disabled in config, the loader SHALL:

- record `loaded: false`, `error: "missing/disabled dep: <id>[, <id>...]"`, and `missingDeps: string[]` in the plugin status store,
- skip the plugin's server entry import.

The loader SHALL process plugins in a topologically-sorted order (deps before dependents). Within one topological tier, the existing priority key (ascending priority, ties broken by id) SHALL be the secondary order.

#### Scenario: Plugin with disabled dependency is not loaded

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are discovered, `a` is disabled in config
- **THEN** the loader SHALL skip `b`'s server entry and SHALL set `b`'s status to `{ enabled: true, loaded: false, error: "missing/disabled dep: a", missingDeps: ["a"], ... }`.

#### Scenario: Plugin with missing dependency is not loaded

- **WHEN** plugin `b` declares `dependsOn: ["nonexistent"]`
- **THEN** the loader SHALL set `b`'s status to `{ enabled: true, loaded: false, error: "missing/disabled dep: nonexistent", missingDeps: ["nonexistent"], ... }`.

### Requirement: `POST /api/plugins/:id/toggle` SHALL honour the dependency graph

The toggle endpoint SHALL apply `computeToggleImpact(graph, id, target)` (from `dashboard-plugin-runtime`) to the discovered set + current config enabled state:

- When `enabled: true` is requested AND `impact.blockers.length > 0`, the endpoint SHALL return 409 with body `{ success: false, reason: "blockers", blockers: string[] }` and SHALL NOT modify config.
- When `enabled: true` is requested AND `impact.cascadeEnable.length > 0`, the endpoint SHALL set every cascaded id's `enabled = true` in the SAME config write as the target, broadcast `plugin_config_update` once per affected id, and return 200 `{ success: true, restartRequired: true, cascade: { enable: string[] } }`.
- When `enabled: false` is requested AND `impact.cascadeDisable.length > 0`, the endpoint SHALL set every cascaded id's `enabled = false` in the SAME config write as the target, broadcast `plugin_config_update` once per affected id, and return 200 `{ success: true, restartRequired: true, cascade: { disable: string[] } }`.
- When no cascade is needed, the endpoint SHALL behave as before and return 200 `{ success: true, restartRequired: true }`.

#### Scenario: Enabling a plugin with a missing dep returns 409

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, `a` is not in the discovered set, and a request is made with `{ enabled: true }` for `b`
- **THEN** the server SHALL return 409 with body `{ success: false, reason: "blockers", blockers: ["a"] }` and SHALL NOT modify config.

#### Scenario: Cascade enable writes both ids atomically

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are disabled, and a request is made with `{ enabled: true }` for `b`
- **THEN** the server SHALL set both `plugins.a.enabled = true` and `plugins.b.enabled = true` in a single config write, broadcast `plugin_config_update` once for each of `a` and `b`, and SHALL return 200 with `cascade.enable: ["a"]`.

#### Scenario: Cascade disable writes both ids atomically

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are enabled, and a request is made with `{ enabled: false }` for `a`
- **THEN** the server SHALL set both `plugins.a.enabled = false` and `plugins.b.enabled = false` in a single config write and SHALL return 200 with `cascade.disable: ["b"]`.

### Requirement: `GET /api/plugins` SHALL include computed `dependents` per row

For every row in the response, the server SHALL include:

- `dependsOn: string[]` — verbatim from the manifest (empty when absent),
- `dependents: string[]` — the set of plugin ids that transitively depend on this row, computed by inverting the discovered graph.

#### Scenario: Computed dependents populated

- **WHEN** plugin `b` declares `dependsOn: ["a"]` and both are discovered
- **THEN** `GET /api/plugins` SHALL return the `a` row with `dependents: ["b"]` and the `b` row with `dependsOn: ["a"]`, `dependents: []`.

### Requirement: PluginStatus SHALL include a manifest-derived display name

`PluginStatus` SHALL include `displayName: string`, populated by the loader from `manifest.displayName`. The plugin status store SHALL accept the field and `/api/health.plugins[]` SHALL expose it.

#### Scenario: Status payload includes displayName

- **WHEN** plugin `jj` declares `displayName: "Jujutsu Workspaces"` in its manifest
- **THEN** `/api/health.plugins[]` SHALL include an entry whose `id = "jj"` and `displayName = "Jujutsu Workspaces"`.

### Requirement: `GET /api/plugins` SHALL list every discovered plugin

The endpoint `GET /api/plugins` SHALL return every plugin returned by `discoverPlugins()` with full manifest summary and status (id, displayName, enabled, loaded, error, claims, requirements, missingRequirements, bridgeLoadedFrom, lastProbe). The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.

The endpoint SHALL NOT return entries for ids that are absent from `discoverPlugins()` results (ghost handling is out of scope for this change).

#### Scenario: Endpoint returns every discovered plugin

- **WHEN** discovery finds four plugins `builtins`, `flows`, `honcho`, `jj`
- **THEN** `GET /api/plugins` SHALL return all four entries with their manifest summary and status.

#### Scenario: Endpoint requires authentication

- **WHEN** an unauthenticated request is made to `GET /api/plugins` on a non-loopback bind
- **THEN** the server SHALL reject the request with the same auth response `POST /api/config/plugins/:id` returns under the same conditions.

### Requirement: `POST /api/plugins/:id/toggle` SHALL persist enable/disable

The endpoint `POST /api/plugins/:id/toggle` SHALL accept a body `{ enabled: boolean }` and SHALL:

- write `plugins.<id>.enabled` to `~/.pi/dashboard/config.json`,
- broadcast `plugin_config_update` for the affected id,
- return 200 `{ restartRequired: true }`,
- return 404 when the id is not present in `discoverPlugins()` results.

The endpoint SHALL NOT take effect on the running process; the new enabled set takes effect on the next server start. The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.

#### Scenario: Toggle persists and broadcasts

- **WHEN** an authenticated client posts `{ "enabled": false }` to `/api/plugins/jj/toggle` and `jj` is in the discovered set
- **THEN** the server SHALL set `plugins.jj.enabled = false` in `~/.pi/dashboard/config.json`, SHALL broadcast a `plugin_config_update` message with `id = "jj"`, and SHALL return 200 `{ restartRequired: true }`.

#### Scenario: Toggle of unknown id returns 404

- **WHEN** an authenticated client posts `{ "enabled": false }` to `/api/plugins/nonexistent/toggle` and `nonexistent` is not in the discovered set
- **THEN** the server SHALL return 404 and SHALL NOT modify config.

### Requirement: Slot registry SHALL filter claims of disabled plugins on the client

The client-side `SlotRegistry` SHALL accept `setEnabledSet(ids: ReadonlySet<string>)`. After it is called at least once, every `getClaims(slotId)` SHALL omit claims whose `pluginId` is not in the enabled set. Before it is called, `getClaims` SHALL return all claims (preserving existing behaviour for default / SSR-style use).

The registry SHALL also expose `getAllPluginsForActivationUi()` that returns the unfiltered manifest summary plus current status, used only by the Plugins tab.

The client SHALL call `setEnabledSet` from the value of `/api/health.plugins[]` on first connect and on every `plugin_config_update` broadcast.

#### Scenario: Disabled plugin contributes no slot

- **WHEN** plugin `demo` is in the build-time registry but `setEnabledSet` was last called with a set that does not include `demo`
- **THEN** every `getClaims(slotId)` call SHALL return zero entries for `demo`, including but not limited to `settings-section`, `session-card-badge`, `command-route`, and `tool-renderer`.

#### Scenario: Activation UI sees disabled plugins

- **WHEN** plugin `demo` is disabled via `setEnabledSet`
- **THEN** `getAllPluginsForActivationUi()` SHALL still include `demo` in its result so the Plugins tab can render it.

#### Scenario: Default behaviour shows all claims

- **WHEN** `setEnabledSet` has never been called on the registry
- **THEN** `getClaims(slotId)` SHALL return every registered claim regardless of plugin id.

### Requirement: Plugin-contributed `settings-section` claims SHALL render ONLY under the owning plugin's row

Every `settings-section` claim SHALL be rendered inside the Plugins tab of `SettingsPanel`, beneath the contributing plugin's row in the activation list. No other `SettingsPanel` tab SHALL render plugin-contributed `settings-section` content.

`SettingsPanel.tsx` SHALL NOT import or render `SettingsSectionSlot` from `dashboard-plugin-runtime`. The legacy `<SettingsSectionSlot tab="..." />` invocations previously fired from the General / Servers / Providers / Security tabs SHALL be removed.

The `claim.tab` field SHALL remain accepted by the manifest validator (preserving backwards-compat for existing manifests) but SHALL be inert at runtime — no consumer SHALL read it. The validator SHALL NOT emit any warning when `tab` is present.

A plugin's row in the Plugins tab SHALL display a settings-gear affordance for every plugin. The affordance SHALL be clickable only when at least one `settings-section` claim is registered for that plugin id; otherwise the affordance SHALL be rendered disabled (reduced opacity, `cursor-not-allowed`, tooltip indicating no settings are available). Clicking the affordance toggles inline rendering of the plugin's `settings-section` claim(s), sorted by descending priority then registration order.

The slot-registry enabled-set filter SHALL apply to `getClaims("settings-section")` for this single render path, so disabling a plugin removes its section from the Plugins tab.

#### Scenario: Plugin settings render under their plugin row only

- **WHEN** plugin `jj` declares a `settings-section` claim and is enabled
- **THEN** opening the Plugins tab and clicking the gear affordance on the `jj` row SHALL render the plugin's settings section component beneath the row, and SHALL NOT render it inside the General, Servers, Providers, or Security tab.

#### Scenario: `tab` field is inert

- **WHEN** plugin `jj` declares `{ slot: "settings-section", tab: "general", component: "JjSettings" }` and is enabled
- **THEN** the validator SHALL accept the manifest without warning, the `JjSettings` component SHALL render only beneath the `jj` row in the Plugins tab, and the General tab SHALL NOT contain any plugin-contributed `settings-section` content.

#### Scenario: Disabled plugin has a non-clickable gear and no settings rendering

- **WHEN** plugin `demo` declares `{ slot: "settings-section" }` but is disabled in config
- **THEN** the `demo` row in the Plugins tab SHALL render a disabled-state gear affordance, the slot-registry filter SHALL exclude `demo`'s claims, and no `settings-section` content SHALL render anywhere in `SettingsPanel`.

#### Scenario: SettingsPanel does not import SettingsSectionSlot

- **WHEN** the repo-lint test reads `packages/client/src/components/SettingsPanel.tsx`
- **THEN** the file SHALL NOT contain the string `SettingsSectionSlot`.

### Requirement: Plugin manifests SHALL support an optional `requires` field for declarative requirements

The `PluginManifest` type SHALL accept an optional `requires?: PluginRequirements` field, where `PluginRequirements` declares three optional string arrays: `piExtensions` (pi extension package identifiers), `binaries` (executables that must resolve on PATH), and `services` (named service probes from a closed built-in registry). The manifest validator SHALL reject duplicate, empty, or whitespace-only entries in any of the three arrays.

The closed built-in service-probe registry SHALL ship with exactly one entry in this change: `pi-model-proxy`. Plugins SHALL NOT register additional service-probe names.

#### Scenario: Valid requires field accepted

- **WHEN** a plugin declares `requires: { piExtensions: ["pi-memory-honcho"], services: ["pi-model-proxy"] }`
- **THEN** the validator SHALL accept the manifest.

#### Scenario: Empty string entries rejected

- **WHEN** a plugin declares `requires: { binaries: [""] }`
- **THEN** the validator SHALL throw `ManifestValidationError`.

#### Scenario: Unknown service name rejected at probe time but not at validate time

- **WHEN** a plugin declares `requires: { services: ["unknown-service"] }` and that name is not registered in the built-in service-probe registry
- **THEN** the validator SHALL accept the manifest (string shape is valid), and the probe runtime SHALL record the service as `{ name: "unknown-service", satisfied: false, error: "unknown service name" }`.

### Requirement: The loader SHALL run requirement probes for every discovered plugin

After loading server entries, the loader SHALL invoke `runRequirementProbes(manifest)` for each discovered plugin (including plugins whose server entry failed to load and including plugins disabled in config). The probe result SHALL be written to the plugin status store as `requirements: PluginRequirementReport` plus a flat `missingRequirements: string[]` listing every unsatisfied requirement name.

The loader SHALL NOT block on probe outcome. Probe execution SHALL NOT affect whether `status.loaded` is set to `true`.

Probe results SHALL be refreshed:

- once at server start, after `loadServerEntries`,
- on every successful `package_operation_complete` broadcast (a package operation may have changed requirement satisfaction),
- on demand when `/api/health` is fetched and the cached report is older than 30 seconds.

When any plugin's `missingRequirements` changes between two consecutive refreshes, the server SHALL broadcast `plugin_config_update` for the affected id.

#### Scenario: Probe report populated on first boot

- **WHEN** plugin `honcho` declares `requires: { piExtensions: ["pi-memory-honcho"] }` and `pi-memory-honcho` is installed in pi
- **THEN** after server start `/api/health.plugins[]` SHALL include `honcho` with `requirements.piExtensions = [{ name: "pi-memory-honcho", satisfied: true }]` and `missingRequirements = []`.

#### Scenario: Missing requirement surfaces in the status

- **WHEN** plugin `honcho` declares `requires: { piExtensions: ["pi-memory-honcho"] }` and `pi-memory-honcho` is NOT installed in pi
- **THEN** `/api/health.plugins[]` SHALL include `honcho` with `requirements.piExtensions = [{ name: "pi-memory-honcho", satisfied: false }]` and `missingRequirements = ["pi-memory-honcho"]`. The plugin's `loaded` field SHALL remain `true` and routes SHALL still register.

#### Scenario: Successful install refreshes probes and broadcasts

- **WHEN** a `POST /api/packages/install` for `pi-memory-honcho` completes successfully and `honcho` previously reported `missingRequirements = ["pi-memory-honcho"]`
- **THEN** the `package_operation_complete` listener SHALL trigger a probe refresh, the new report SHALL show `missingRequirements = []` for `honcho`, and the server SHALL broadcast `plugin_config_update` with `id = "honcho"`.

#### Scenario: Binary probe resolves via the tool registry

- **WHEN** plugin `jj` declares `requires: { binaries: ["jj"] }` and `jj` resolves on PATH via `ToolRegistry`
- **THEN** the probe SHALL report `{ name: "jj", satisfied: true, resolvedPath: "<absolute-path>" }`.

### Requirement: First-party monorepo plugins SHALL ship inside the Electron bundle

`bundle-server.mjs` SHALL copy every first-party `pi-dashboard-plugin` package under `packages/*-plugin/` into `<bundle>/resources/plugins/<id>/`, EXCEPT plugins whose manifest declares `fixture: true`. The runtime `findBundledPluginsDir()` SHALL locate the resulting directory at `~/.pi-dashboard/resources/plugins/` after extraction.

The bundled set in this change SHALL include at minimum: `roles-plugin`, `jj-plugin`, `flows-plugin`, `honcho-plugin`, `flows-anthropic-bridge-plugin`. Fixture-only plugins (e.g. `demo-plugin`) SHALL be excluded.

#### Scenario: Bundled plugins land under resources/plugins

- **WHEN** `npm run electron:bundle-server` completes
- **THEN** `packages/electron/resources/server/resources/plugins/` SHALL contain a subdirectory per bundled plugin id, each with a valid `package.json` carrying a `pi-dashboard-plugin` manifest.

#### Scenario: Fresh Electron install discovers bundled plugins

- **WHEN** a fresh `~/.pi-dashboard/` is populated from the bundle and the server starts
- **THEN** `discoverPlugins()` SHALL return at least the bundled set, AND `/api/plugins` SHALL list them with their manifest summaries.

### Requirement: The client-side enable filter SHALL default-allow build-time-known plugin ids

The client hook that drives `registry.setEnabledSet(...)` from `/api/health.plugins[]` SHALL compute the enabled set as:

```
enabled = (every plugin id present in registry.getAllPluginsForActivationUi())
          ∪ (server-reported plugin ids with enabled !== false)
          \ (server-reported plugin ids with enabled === false)
```

This prevents a misconfigured or incomplete server-side discovery (empty `/api/health.plugins[]`) from hiding every claim the build-time `PLUGIN_REGISTRY` embedded into the client.

#### Scenario: Empty server discovery does not hide build-time claims

- **WHEN** the build-time `PLUGIN_REGISTRY` contains claims for plugin `flows` and `/api/health.plugins[]` returns `[]`
- **THEN** `registry.getClaims(slotId)` SHALL still return `flows`'s claims (the build-time id is not on the explicitly-disabled list).

#### Scenario: Server-disabled plugin remains hidden

- **WHEN** the build-time `PLUGIN_REGISTRY` contains claims for plugin `flows` and `/api/health.plugins[]` reports `{ id: "flows", enabled: false }`
- **THEN** `registry.getClaims(slotId)` SHALL exclude `flows`'s claims for every slot id.

### Requirement: PluginStatus SHALL include requirements and missingRequirements

`PluginStatus` SHALL include optional `requirements?: PluginRequirementReport` and `missingRequirements?: string[]`. The plugin status store SHALL accept and emit both fields. The `/api/health.plugins[]` payload SHALL expose them.

`PluginRequirementReport` SHALL include three arrays: `piExtensions: { name: string; satisfied: boolean }[]`, `binaries: { name: string; satisfied: boolean; resolvedPath?: string }[]`, `services: { name: string; satisfied: boolean; error?: string }[]`.

The flat `missingRequirements` SHALL list the `name` of every unsatisfied entry across all three categories. When every requirement is satisfied or the plugin declares no `requires`, `missingRequirements` SHALL be `[]` (not undefined).

#### Scenario: Mixed-satisfaction report

- **WHEN** plugin `honcho` declares `requires: { piExtensions: ["pi-memory-honcho"], services: ["pi-model-proxy"] }`, `pi-memory-honcho` is installed, and `pi-model-proxy` is not reachable
- **THEN** `/api/health.plugins[]` SHALL include `honcho` with `requirements.piExtensions = [{ name: "pi-memory-honcho", satisfied: true }]`, `requirements.services = [{ name: "pi-model-proxy", satisfied: false, error: <reason> }]`, and `missingRequirements = ["pi-model-proxy"]`.

### Requirement: `RecommendedExtension` SHALL support a companion-plugin field

The `RecommendedExtension` type in `packages/shared/src/recommended-extensions.ts` SHALL accept an optional `dashboardPlugin?: string` naming the companion dashboard plugin id. The recommended-extensions enricher in `packages/server/src/routes/recommended-routes.ts` SHALL propagate the field and additionally compute `dashboardPluginInstalled: boolean` by looking the id up in the plugin status store.

The shipped `RECOMMENDED_EXTENSIONS` const SHALL set `dashboardPlugin: "honcho"` on the `pi-memory-honcho` entry. No other entries SHALL set the field in this change.

#### Scenario: pi-memory-honcho carries dashboardPlugin field

- **WHEN** a client fetches `GET /api/packages/recommended`
- **THEN** the entry with `id: "pi-memory-honcho"` SHALL include `dashboardPlugin: "honcho"`.

#### Scenario: Enricher reports companion-plugin install state

- **WHEN** `pi-memory-honcho` is queried and the `honcho` plugin is present in the plugin status store
- **THEN** the enriched entry SHALL include `dashboardPluginInstalled: true`; when `honcho` is not present, it SHALL include `dashboardPluginInstalled: false`.

### Requirement: The Plugins tab SHALL surface missing requirements with one-click install via the existing installer

For each plugin row in the Plugins tab whose `missingRequirements` is non-empty, the UI SHALL render a warning pill per missing requirement. For unsatisfied `piExtensions` requirements where the missing name matches a `RECOMMENDED_EXTENSIONS.id`, the UI SHALL render an inline `[Install]` button that invokes the existing `usePackageOperations("global").install(source)` with the matching entry's `source` string.

The change SHALL NOT introduce a new install endpoint, a new install hook, or any new browser-protocol message. Plugin requirement installs ride exclusively on the existing `POST /api/packages/install` and the existing `package_progress` / `package_operation_complete` listeners.

For unsatisfied requirements with no matching recommended-extensions entry, the UI SHALL render a `[Install via Packages tab]` link pointing at `/settings?tab=packages`.

#### Scenario: Missing pi-memory-honcho renders inline Install button

- **WHEN** plugin `honcho` reports `missingRequirements = ["pi-memory-honcho"]` and `RECOMMENDED_EXTENSIONS` contains an entry with `id: "pi-memory-honcho"` and `source: "npm:pi-memory-honcho"`
- **THEN** the `honcho` row in the Plugins tab SHALL render a warning pill and an inline `[Install]` button; clicking the button SHALL invoke `usePackageOperations("global").install("npm:pi-memory-honcho")`.

#### Scenario: Missing requirement without a recommended-extensions match falls back to a link

- **WHEN** plugin `foo` reports `missingRequirements = ["bar-extension"]` and no `RECOMMENDED_EXTENSIONS` entry has `id: "bar-extension"`
- **THEN** the row SHALL render `[Install via Packages tab]` linking to `/settings?tab=packages` and SHALL NOT render an inline `[Install]` button.

#### Scenario: No new browser-protocol message types are introduced

- **WHEN** the build runs the protocol-completeness test
- **THEN** the `ServerToBrowserMessage` union in `packages/shared/src/browser-protocol.ts` SHALL NOT contain any new variant added by this change; plugin toggles ride on the existing `plugin_config_update` and requirement installs ride on the existing `package_progress` / `package_operation_complete`.
