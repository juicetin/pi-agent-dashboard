# dashboard-plugin-loader Delta

## ADDED Requirements

### Requirement: Plugin manifests SHALL support optional hard-dependency and essential fields

The `PluginManifest` type SHALL accept two new optional fields. `dependsOn?: string[]` SHALL declare other plugin ids this plugin requires to be present and enabled; dependencies SHALL be treated as hard and transitive. `essential?: boolean` SHALL mark a plugin as non-disableable; when `true`, the activation UI and the toggle endpoint SHALL refuse to disable the plugin.

The manifest validator SHALL reject:

- non-string entries in `dependsOn`,
- self-references (`id` appearing in its own `dependsOn`),
- any cycle in the discovered set's dependency graph.

#### Scenario: Cycle in dependency graph soft-fails the involved plugins

- **WHEN** plugin `a` declares `dependsOn: ["b"]` and plugin `b` declares `dependsOn: ["a"]`
- **THEN** discovery SHALL NOT throw; it SHALL mark both `a` and `b` with `loaded: false, error: "cycle: a→b→a"` (or the equivalent rotation) and SHALL skip both server entries; other discovered plugins SHALL load normally.

#### Scenario: Self-reference rejected

- **WHEN** plugin `foo` declares `dependsOn: ["foo"]`
- **THEN** discovery SHALL throw `ManifestValidationError` and SHALL NOT load `foo`.

### Requirement: Loader SHALL skip plugins whose dependencies are missing or disabled

When loading server entries, the loader SHALL evaluate each plugin's `dependsOn` against the current enabled set. If any dependency is either absent from discovery or disabled in config, the loader SHALL:

- record `loaded: false` and `error: "missing/disabled dep: <id>"` in the plugin status store,
- skip the plugin's server entry import.

The loader SHALL process plugins in a topologically-sorted order (deps before dependents); priority is the tiebreaker within a topological tier.

#### Scenario: Plugin with disabled dependency is not loaded

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are discovered, `a` is disabled in config
- **THEN** the loader SHALL skip `b`'s server entry and SHALL set `b`'s status to `{ enabled: true, loaded: false, error: "disabled dep: a", missingDeps: ["a"] }`.

#### Scenario: Plugin with missing dependency is not loaded

- **WHEN** plugin `b` declares `dependsOn: ["nonexistent"]`
- **THEN** the loader SHALL set `b`'s status to `{ enabled: true, loaded: false, error: "missing dep: nonexistent", missingDeps: ["nonexistent"] }`.

### Requirement: `/api/plugins` SHALL list every discovered plugin and every ghost id from config

The endpoint `GET /api/plugins` SHALL return the union of:

1. every plugin returned by `discoverPlugins()`, with full manifest summary, status, and computed `dependents` list;
2. every id present under `config.plugins.*` that is NOT in the discovered set, as a ghost row with `installed: false, claims: 0`.

The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.

#### Scenario: Ghost plugin appears in listing

- **WHEN** `config.plugins.foo` exists but no manifest with id `foo` is discovered
- **THEN** `GET /api/plugins` SHALL include `{ id: "foo", installed: false, enabled: <from config>, claims: 0 }` in its response.

#### Scenario: Computed dependents populated

- **WHEN** plugin `b` declares `dependsOn: ["a"]` and both are discovered
- **THEN** `GET /api/plugins` SHALL return `a` with `dependents: ["b"]`.

### Requirement: `POST /api/plugins/:id/toggle` SHALL persist enable/disable with cascade and dep validation

The endpoint `POST /api/plugins/:id/toggle` SHALL accept a body `{ enabled: boolean, remove?: boolean }` and SHALL:

- reject with 403 `{ reason: "essential" }` when the target plugin is `essential: true` and `enabled: false` is requested,
- reject with 409 `{ reason: "blockers", blockers: string[] }` when enabling a plugin whose `dependsOn` includes ids not present in discovery,
- compute the cascade via `computeToggleImpact` (cascade-enable deps when enabling; cascade-disable dependents when disabling),
- write every cascaded `plugins.<id>.enabled` value in a single atomic config write,
- broadcast `plugin_config_update` once per affected id,
- return 200 `{ restartRequired: true, cascade: { enable?: string[]; disable?: string[] } }`.

The endpoint SHALL NOT take effect on the running process; the new enabled set takes effect on the next server start.

When `remove: true` is sent for a ghost id (`installed: false`), the endpoint SHALL strip the entry from `config.plugins`, broadcast `plugin_config_update`, and return 200 `{ restartRequired: false, removed: true }`.

The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.

#### Scenario: Disabling an essential plugin returns 403

- **WHEN** plugin `core` has `essential: true` and a request is made with `{ enabled: false }`
- **THEN** the server SHALL return 403 with body `{ reason: "essential" }` and SHALL NOT modify config.

#### Scenario: Enabling a plugin with a missing dep returns 409

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, `a` is not in the discovered set, and a request is made with `{ enabled: true }` for `b`
- **THEN** the server SHALL return 409 with body `{ reason: "blockers", blockers: ["a"] }` and SHALL NOT modify config.

#### Scenario: Cascade enable writes both ids atomically

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are disabled, and a request is made with `{ enabled: true }` for `b`
- **THEN** the server SHALL set both `plugins.a.enabled = true` and `plugins.b.enabled = true` in a single config write and SHALL return 200 with `cascade.enable: ["a"]`.

#### Scenario: Cascade disable writes both ids atomically

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, both are enabled, and a request is made with `{ enabled: false }` for `a`
- **THEN** the server SHALL set both `plugins.a.enabled = false` and `plugins.b.enabled = false` and SHALL return 200 with `cascade.disable: ["b"]`.

#### Scenario: Ghost removal strips config entry

- **WHEN** `config.plugins.foo` exists but no manifest for `foo` is discovered, and a request is made with `{ enabled: false, remove: true }` for `foo`
- **THEN** the server SHALL remove the `foo` key from `config.plugins`, broadcast `plugin_config_update` for `foo`, and return 200 `{ restartRequired: false, removed: true }`. The client UI SHALL NOT raise the "Restart required" banner in response to this operation.

### Requirement: Plugin-contributed `settings-section` claims SHALL render under the Plugins tab AND any tab the claim explicitly targets

Every `settings-section` claim SHALL be rendered inside the Plugins tab of `SettingsPanel`, beneath the contributing plugin's row in the activation list. In addition, when a claim sets `claim.tab` to a value listed in `VALID_SETTINGS_TABS`, the existing `<SettingsSectionSlot tab="..." />` consumers in `SettingsPanel.tsx` SHALL continue to render that claim inside the chosen legacy tab.

The `claim.tab` field SHALL remain a fully supported, non-deprecated manifest field for `settings-section` claims. The manifest validator SHALL NOT emit any warning when `tab` is present. Plugin authors SHALL NOT be required to add or remove `tab` for their plugin to keep working.

A plugin's row in the Plugins tab SHALL display an expand affordance only when at least one `settings-section` claim is registered for that plugin id. Expanding the row SHALL render every such claim inside the row's body, sorted by the same `priority` key the slot registry already uses (descending priority, ties broken by registration order).

The slot-registry enabled-set filter (separately specified) SHALL apply to `getClaims("settings-section")` in both render paths, so disabling a plugin removes its section uniformly from both the Plugins tab and any legacy tab it previously appeared in.

#### Scenario: Plugin settings render under their plugin row

- **WHEN** plugin `jj` declares a `settings-section` claim with no `tab` field and is enabled
- **THEN** opening the Plugins tab and expanding the `jj` row SHALL render the plugin's settings section component beneath the row, and SHALL NOT render it inside any other Settings tab.

#### Scenario: `tab`-targeted claim renders in both locations

- **WHEN** plugin `jj` declares `{ slot: "settings-section", tab: "general", component: "JjSettings" }` and is enabled
- **THEN** the validator SHALL accept the manifest without warning, the `JjSettings` component SHALL render inside the General tab via the existing `<SettingsSectionSlot tab="general" />` consumer, AND it SHALL also render inside the Plugins tab beneath the `jj` row.

#### Scenario: Disabled plugin has no expandable settings and no legacy-tab section

- **WHEN** plugin `demo` declares `{ slot: "settings-section", tab: "general" }` but is disabled in config
- **THEN** the `demo` row in the Plugins tab SHALL NOT render an expand affordance, and the `<SettingsSectionSlot tab="general" />` consumer SHALL also omit `demo`'s contribution because the slot-registry filter excludes claims of disabled plugins.

### Requirement: Slot registry SHALL filter claims of disabled plugins on the client

The client-side `SlotRegistry` SHALL accept `setEnabledSet(ids: ReadonlySet<string>)`. After it is called at least once, every `getClaims(slotId)` SHALL omit claims whose `pluginId` is not in the enabled set. Before it is called, `getClaims` SHALL return all claims (preserving existing behaviour for default / SSR-style use).

The registry SHALL also expose `getAllPluginsForActivationUi()` that returns the unfiltered manifest summary plus current status, used only by the activation page.

The client SHALL call `setEnabledSet` from the value of `/api/health.plugins[]` on first connect and on every `plugin_config_update` broadcast.

#### Scenario: Disabled plugin contributes no slot

- **WHEN** plugin `demo` is in the build-time registry but `setEnabledSet` was last called with a set that does not include `demo`
- **THEN** every `getClaims(slotId)` call SHALL return zero entries for `demo`, including but not limited to `settings-section`, `session-card-badge`, `command-route`, and `tool-renderer`.

#### Scenario: Activation UI sees disabled plugins

- **WHEN** plugin `demo` is disabled via `setEnabledSet`
- **THEN** `getAllPluginsForActivationUi()` SHALL still include `demo` in its result so the activation page can render it.

### Requirement: PluginStatus SHALL include manifest-derived display fields

`PluginStatus` SHALL include `displayName: string`, `essential: boolean`, `dependsOn: string[]`, `dependents: string[]`, `missingDeps?: string[]`, `installed: boolean`, `source: "built-in" | "installed" | "ghost"`, `installPath?: string` (set only when `source = "installed"`), and `installSpec?: string` (the original source string used to install the plugin, set only when `source = "installed"`). The plugin status store SHALL accept these fields and the `/api/health.plugins[]` payload SHALL expose them. The invariant `installed === (source !== "ghost")` SHALL hold for every emitted entry.

#### Scenario: Status payload contains dependency metadata

- **WHEN** plugin `b` declares `dependsOn: ["a"]`, `essential: false`, and is enabled
- **THEN** `/api/health.plugins[]` SHALL include an entry `{ id: "b", installed: true, enabled: true, loaded: true, dependsOn: ["a"], dependents: [], essential: false, source: "built-in", ... }`.

#### Scenario: Installed plugin reports its install path

- **WHEN** plugin `bar` was installed via `POST /api/plugins/install` and lives at `~/.pi/dashboard/plugins/bar/`
- **THEN** `/api/health.plugins[]` SHALL include an entry whose `source = "installed"` and `installPath` ends with `/.pi/dashboard/plugins/bar`.

### Requirement: Discovery SHALL scan both the monorepo and pi's private dashboard scope

The loader SHALL scan two sources in this order: `<repo>/packages/*/package.json` (recorded with `source = "built-in"`) and every entry in `~/.pi/dashboard/plugins/.pi-scope/settings.json#packages[]` (resolved to its on-disk install path via pi's package manager and recorded with `source = "installed"`). When the same id is discovered in both sources, the built-in entry SHALL be used for slot-claim resolution and the installed entry SHALL be recorded with `loaded: false, error: "id conflict with built-in"` so it remains visible in the activation UI.

#### Scenario: Plugin installed via pi appears in discovery

- **WHEN** an earlier `POST /api/plugins/install` call recorded `npm:@me/foo` in the private scope's `packages[]`, and pi resolves that entry to `<git-cache>/.../foo/`
- **THEN** discovery SHALL include `foo` with `source = "installed"`, `installPath` set to the resolved path, and `installSpec = "npm:@me/foo"`.

#### Scenario: Built-in wins on id collision

- **WHEN** both `<repo>/packages/jj-plugin/package.json` and a user-installed package in the private dashboard scope declare id `jj`
- **THEN** the registry SHALL contain the built-in `jj` claims for slot resolution and the user-installed `jj` entry SHALL appear in `/api/plugins` with `loaded: false, error: "id conflict with built-in: jj"`.

### Requirement: `GET /api/plugins/search` SHALL proxy npm with the dashboard-plugin keyword filter

The endpoint `GET /api/plugins/search?q=<query>` SHALL proxy npm registry search with the keyword filter `pi-dashboard-plugin`. Each returned package SHALL include `alsoExtension: boolean` set to `true` when the package's npm keywords additionally contain `pi-extension`. The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id` and SHALL reuse the existing `npm-search-proxy` cache.

#### Scenario: Search filters by pi-dashboard-plugin keyword

- **WHEN** the client calls `GET /api/plugins/search?q=foo`
- **THEN** the server SHALL call npm registry search with `keywords:pi-dashboard-plugin foo` and return only matching packages.

#### Scenario: alsoExtension flag is computed from package keywords

- **WHEN** an npm package's keywords contain both `pi-dashboard-plugin` and `pi-extension`
- **THEN** the corresponding result SHALL include `alsoExtension: true`.

#### Scenario: Generic extension-related keywords do NOT set alsoExtension

- **WHEN** an npm package's keywords contain `pi-dashboard-plugin` and a generic word like `extension` or `extensions` but NOT `pi-extension`
- **THEN** the corresponding result SHALL include `alsoExtension: false`.

### Requirement: `POST /api/plugins/install` SHALL delegate every install to pi's package manager via a private dashboard scope

The endpoint `POST /api/plugins/install` SHALL accept a body `{ source: string }` where `source` follows the same format pi accepts for extensions (parsed by the existing `parseSourceKind` helper). All source forms supported by pi's `DefaultPackageManager` SHALL be accepted: `npm:<spec>`, `git:<url>` (with optional `@<ref>`), protocol URLs (`https://`, `http://`, `ssh://`, `git://`), absolute filesystem paths, and relative filesystem paths.

The handler SHALL NOT implement its own install strategies. Instead it SHALL:

- ensure the private dashboard scope directory `~/.pi/dashboard/plugins/.pi-scope/` exists with a writable `settings.json`,
- call `PackageManagerWrapper.run({ action: "install", source, scope: "local", cwd: "<private-scope>" })` — the same code path used by `pi pkg install` today,
- after pi's install completes, resolve the just-installed package's on-disk path via the same package manager and read its `pi-dashboard-plugin` manifest,
- reject with 409 `{ reason: "id conflict with built-in", id }` when the manifest's id matches a built-in plugin; on any validation failure, call `PackageManagerWrapper.run({ action: "remove", ... })` against the same source to roll back, then return 4xx,
- when `manifest.bridge` is present, call `registerBridgeExtension` so a `dashboard-<id>` entry is added under `dashboardPluginBridges` only,
- set `config.plugins.<id>.enabled = true`, record `installSpec = <source>`, broadcast `plugin_config_update`,
- return 200 `{ restartRequired: true, id, source: "installed", installSpec }`.

The endpoint SHALL NOT modify pi's user-level `~/.pi/agent/settings.json#packages[]` under any circumstance — every install lands in the private dashboard scope's `packages[]`. The endpoint SHALL be auth-gated through the same Fastify chain as `POST /api/config/plugins/:id`.

The endpoint SHALL use the **same singleton `PackageManagerWrapper` instance** the server already constructs for `/api/packages/install`. Plugin install and plugin uninstall SHALL acquire that wrapper's `busy` lock, sharing one server-wide install queue with pi extension operations. When the wrapper is already busy with another package operation (plugin or extension), the endpoint SHALL return 409 with the same `PackageOperationBusyError` payload shape `/api/packages/install` returns.

The endpoint SHALL return its successful synchronous response in the **same shape** `/api/packages/install` returns: `{ success: true, data: { operationId: string } }`. Progress and completion for the operation SHALL be delivered to clients via the **existing** `package_progress` and `package_operation_complete` browser-protocol messages broadcast by `setProgressListener` / `setCompleteListener` in `server.ts`. The change SHALL NOT introduce any new browser-protocol message type for plugin install or uninstall progress, and SHALL NOT introduce any new REST or SSE progress endpoint.

#### Scenario: Install from npm delegates to pi and registers bridge

- **WHEN** an authenticated client posts `{ "source": "npm:@me/cool-plugin" }` and the package declares `manifest.bridge = "./dist/bridge.js"`
- **THEN** the server SHALL invoke `PackageManagerWrapper.run({ action: "install", source: "npm:@me/cool-plugin", scope: "local", cwd: "<private-scope>" })`, SHALL add `dashboardPluginBridges["dashboard-cool-plugin"]` pointing at the resolved install path, SHALL set `config.plugins["cool-plugin"].enabled = true`, SHALL persist `installSpec: "npm:@me/cool-plugin"`, SHALL NOT modify `packages[]` in `~/.pi/agent/settings.json`, and SHALL return 200 `{ restartRequired: true, id: "cool-plugin", source: "installed", installSpec: "npm:@me/cool-plugin" }`.

#### Scenario: Install from git URL delegates to pi

- **WHEN** the client posts `{ "source": "git:https://github.com/me/cool-plugin@v1.0.0" }`
- **THEN** the server SHALL invoke `PackageManagerWrapper.run({ action: "install", source: "git:https://github.com/me/cool-plugin@v1.0.0", scope: "local", cwd: "<private-scope>" })` so pi performs the clone + ref checkout + build, SHALL validate the resolved manifest, and SHALL persist `installSpec: "git:https://github.com/me/cool-plugin@v1.0.0"`.

#### Scenario: Install from tarball URL delegates to pi

- **WHEN** the client posts `{ "source": "https://registry.example.com/cool-plugin-1.0.0.tgz" }`
- **THEN** the server SHALL invoke `PackageManagerWrapper.run` with that source string, SHALL let pi handle the tarball fetch + install, and SHALL persist `installSpec: "https://registry.example.com/cool-plugin-1.0.0.tgz"`.

#### Scenario: Install from local path delegates to pi

- **WHEN** the client posts `{ "source": "/Users/dev/work/cool-plugin" }`
- **THEN** the server SHALL invoke `PackageManagerWrapper.run` with that source string, SHALL let pi handle the local-checkout install, and SHALL persist `installSpec: "/Users/dev/work/cool-plugin"`.

#### Scenario: Install rollback on invalid manifest

- **WHEN** pi's install completes but manifest validation fails
- **THEN** the server SHALL invoke `PackageManagerWrapper.run({ action: "remove", source, scope: "local", cwd: "<private-scope>" })` to roll back, SHALL NOT register a bridge, SHALL NOT touch `config.plugins`, and SHALL return 400 with the validation error message.

#### Scenario: Install refused for built-in id

- **WHEN** the requested package declares `id` matching an already-discovered built-in plugin
- **THEN** the server SHALL invoke `PackageManagerWrapper.run({ action: "remove", ... })` to roll back the install and return 409 `{ reason: "id conflict with built-in", id }`.

#### Scenario: Plugin install shares the queue with extension install

- **WHEN** an extension install via `/api/packages/install` is in flight (singleton wrapper's `busy` flag is set) and a client calls `POST /api/plugins/install`
- **THEN** the plugin endpoint SHALL return 409 with the same `PackageOperationBusyError` payload shape `/api/packages/install` returns, and SHALL NOT initiate a parallel install.

#### Scenario: Plugin install progress flows on the existing listeners

- **WHEN** `POST /api/plugins/install` invokes the singleton wrapper and pi emits a `ProgressEvent` for the install
- **THEN** the event SHALL be delivered through the same `setProgressListener` callback `server.ts` registers for extension installs, broadcast as a `package_progress` browser-protocol message carrying the operation id assigned by the wrapper.

#### Scenario: No new browser-protocol message types are introduced

- **WHEN** the build runs the protocol-completeness test
- **THEN** the `ServerToBrowserMessage` union in `packages/shared/src/browser-protocol.ts` SHALL NOT contain any new variant whose `type` literal references plugin install or plugin uninstall progress; plugin operations SHALL ride exclusively on the existing `package_progress` and `package_operation_complete` variants.

#### Scenario: Install endpoint returns the same envelope as `/api/packages/install`

- **WHEN** an authenticated client posts `{ "source": "npm:@me/cool-plugin" }`
- **THEN** the synchronous response body SHALL match the shape `{ success: true, data: { operationId: <string> } }` and the client SHALL be able to track the operation by listening to `package_progress` / `package_operation_complete` filtered on the returned operation id.

### Requirement: `POST /api/plugins/:id/uninstall` SHALL delegate removal to pi and leave user-level `packages[]` untouched

The endpoint `POST /api/plugins/:id/uninstall` SHALL apply only to plugins whose status reports `source = "installed"`. It SHALL:

- call `PackageManagerWrapper.run({ action: "remove", source: <installSpec>, scope: "local", cwd: "<private-scope>" })` so pi performs the actual uninstall against the private dashboard scope,
- scrub `dashboardPluginBridges.dashboard-<id>` from `~/.pi/agent/settings.json`,
- remove `config.plugins.<id>` and broadcast `plugin_config_update`,
- return 200 `{ restartRequired: true }`,
- be idempotent: each step is safely retryable; missing artifacts are not errors.

The endpoint SHALL return 400 `{ reason: "cannot uninstall built-in" }` when the target id resolves to a built-in plugin. The endpoint SHALL NOT modify pi's `packages[]` under any circumstance.

#### Scenario: Uninstall detaches package, bridge, and config entry

- **WHEN** plugin `cool-plugin` was installed and is then uninstalled
- **THEN** the server SHALL invoke `PackageManagerWrapper.run({ action: "remove", source: <installSpec>, scope: "local", cwd: "<private-scope>" })` so pi removes the entry from the private scope's `packages[]`, SHALL remove `dashboardPluginBridges["dashboard-cool-plugin"]`, SHALL remove `config.plugins["cool-plugin"]`, SHALL NOT modify pi's user-level `packages[]`, and SHALL return 200 `{ restartRequired: true }`.

#### Scenario: Uninstall refused for built-in plugin

- **WHEN** the target id matches a built-in plugin
- **THEN** the server SHALL return 409 `{ reason: "cannot uninstall built-in" }` and SHALL NOT modify any files.

#### Scenario: Disable of dual-keyword plugin does not touch pi packages[]

- **WHEN** an installed plugin's npm package declared both `pi-dashboard-plugin` and `pi-extension` keywords, and the user disables it from the Plugins tab
- **THEN** the server SHALL set `config.plugins.<id>.enabled = false`, the next loader run SHALL skip the plugin and remove its `dashboardPluginBridges` entry, and the server SHALL NOT add, remove, or modify any entry in `~/.pi/agent/settings.json#packages[]`.
