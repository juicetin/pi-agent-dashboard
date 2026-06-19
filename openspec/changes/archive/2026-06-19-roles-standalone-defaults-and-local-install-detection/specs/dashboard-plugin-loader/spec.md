## MODIFIED Requirements

### Requirement: The loader SHALL run requirement probes for every discovered plugin

After loading server entries, the loader SHALL invoke `runRequirementProbes(manifest)` for each discovered plugin (including plugins whose server entry failed to load and including plugins disabled in config). The probe result SHALL be written to the plugin status store as `requirements: PluginRequirementReport` plus a flat `missingRequirements: string[]` listing every unsatisfied requirement name.

The loader SHALL NOT block on probe outcome. Probe execution SHALL NOT affect whether `status.loaded` is set to `true`.

The `piExtensions` satisfaction check (`installedMatchesName`) SHALL determine whether a required pi extension is installed by delegating its source comparison to the canonical `sourcesMatch` predicate (capability `package-source-matching`). Consequently a required pi extension that is installed from a git URL or a local path (source kind `git` or `raw`) SHALL be reported as satisfied when it refers to the same package as the manifest-declared requirement name, even though the requirement name is an npm-style identifier.

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

#### Scenario: piExtension installed from a local build satisfies the requirement

- **WHEN** plugin `subagents` declares `requires: { piExtensions: ["@blackbelt-technology/pi-dashboard-subagents"] }` and the extension is installed globally from a local build with source `"/home/dev/pi-dashboard-subagents"`
- **THEN** the probe SHALL report `requirements.piExtensions = [{ name: "@blackbelt-technology/pi-dashboard-subagents", satisfied: true }]` and `missingRequirements = []`

#### Scenario: Successful install refreshes probes and broadcasts

- **WHEN** a `POST /api/packages/install` for `pi-memory-honcho` completes successfully and `honcho` previously reported `missingRequirements = ["pi-memory-honcho"]`
- **THEN** the `package_operation_complete` listener SHALL trigger a probe refresh, the new report SHALL show `missingRequirements = []` for `honcho`, and the server SHALL broadcast `plugin_config_update` with `id = "honcho"`.

#### Scenario: Binary probe resolves via the tool registry

- **WHEN** plugin `jj` declares `requires: { binaries: ["jj"] }` and `jj` resolves on PATH via `ToolRegistry`
- **THEN** the probe SHALL report `{ name: "jj", satisfied: true, resolvedPath: "<absolute-path>" }`.

## ADDED Requirements

### Requirement: The Subagents plugin SHALL NOT hard-depend on the Roles plugin

The Subagents plugin manifest SHALL NOT declare `roles` in its `dependsOn` array. The bundled Explore agent's `@fast` model alias SHALL be resolved at spawn time via the standalone `role:resolve-model` event (capability `dashboard-roles-ownership`); when the role is unconfigured, resolution degrades to a structured "not configured yet" error rather than the Subagents plugin failing to load. An empty or disabled Roles plugin SHALL NOT cascade-disable or block loading of the Subagents plugin.

#### Scenario: Subagents loads with Roles empty

- **GIVEN** the Roles plugin is enabled but no role has an assigned model
- **WHEN** the loader processes the Subagents plugin
- **THEN** Subagents SHALL load (`loaded: true`) and its claims SHALL register
- **AND** the loader SHALL NOT record a `missingDeps` entry for `roles` on the Subagents status

#### Scenario: Subagents loads with Roles disabled

- **GIVEN** the Roles plugin is disabled in config
- **WHEN** the loader processes the Subagents plugin
- **THEN** Subagents SHALL still load (`loaded: true`); disabling Roles SHALL NOT cascade-disable Subagents

#### Scenario: Unconfigured `@fast` degrades, does not crash

- **GIVEN** Subagents is loaded and the `fast` role has no assigned model
- **WHEN** the bundled Explore agent is spawned with `model: "@fast"`
- **THEN** the `role:resolve-model` probe SHALL return with `probe.resolved` unset and `probe.reason` naming `fast` as not configured yet, and the harness SHALL surface that reason as a spawn-time error
