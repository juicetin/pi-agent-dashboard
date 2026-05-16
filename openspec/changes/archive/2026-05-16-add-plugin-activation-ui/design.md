## Context

The plugin runtime is in place: discovery, server-side dynamic loading, status reporting, per-plugin config namespace + REST writes, slot registry + slot consumers, `package_progress` broadcasts, the singleton `PackageManagerWrapper` install pipeline, and the curated `RECOMMENDED_EXTENSIONS` manifest. What is missing is a **user-facing way to turn a plugin off** and a **declarative way for plugins to say what they need** from the existing installer.

Key existing surfaces this change leans on:

- `loadServerEntries({ isEnabled })` in `packages/dashboard-plugin-runtime/src/server/loader.ts` — already skips disabled plugins at boot.
- `getPluginStatusStore()` populated during `loadServerEntries`, exposed via `/api/health.plugins[]`.
- Hand-edited `~/.pi/dashboard/config.json#plugins.<id>.enabled` is the only existing toggle.
- Build-time generated `packages/client/src/generated/plugin-registry.tsx` that imports every claim; the slot registry currently exposes them all unconditionally.
- `RECOMMENDED_EXTENSIONS` in `packages/shared/src/recommended-extensions.ts` lists six curated pi extensions; one of them (`pi-memory-honcho`) pairs with the existing `honcho-plugin` but the relationship is captured only in free-text.
- The singleton `PackageManagerWrapper` constructed in `server.ts` already drives `POST /api/packages/install` with the full source-format compat (`npm:`, `git:`, `https://`, absolute path, relative path, …) and live progress over `package_progress` / `package_operation_complete`.

## Goals / Non-Goals

**Goals**

- Single Settings tab lists every discovered plugin.
- Toggling a plugin updates config atomically and emits `plugin_config_update`; effect lands on next server restart.
- Disabling a plugin makes its UI vanish: no settings section, no badges, no command route, no tool renderer.
- Plugins declare what they need from the existing installer / tool registry, in their manifest, in one place.
- The Plugins tab surfaces missing requirements with a one-click install affordance backed by the **existing** `/api/packages/install` pipeline.
- `RECOMMENDED_EXTENSIONS` entries can declare a companion dashboard plugin id; the install browser displays the pairing.

**Non-goals**

- Hot reload of plugins after a toggle — restart-required, like extensions.
- Plugin-to-plugin dependencies (`dependsOn`) and the matching cascade dialog / cycle detection / `essential` flag — none of the current plugins need them.
- Ghost rows (config ids without discovered manifests) — no install path means no orphans yet.
- A new plugin install endpoint — the existing `POST /api/packages/install` already handles everything.
- A new plugin search keyword filter — the existing `/api/packages/search` covers it once `external-dashboard-plugins` lands.

## Decisions

### D1. Restart-required propagation

The server already defers all plugin loading until startup. We keep that model. The route writes config and broadcasts `plugin_config_update`; the UI shows a "Restart required" banner with a button that calls the existing `POST /api/restart`. After restart the new enabled set takes effect both server-side (loader skip) and client-side (registry filter, populated from the new `/api/health`).

Why not hot reload: Fastify forbids registering routes after `listen()`, and partial reload (client claims only) would create an inconsistent UX where some plugin features vanish while others linger. Restart is honest and matches extension semantics.

### D2. Client-side enable filter sits in the slot registry

```
build-time:  every claim → generated/plugin-registry.tsx → registry.setClaims(...)
runtime:     /api/health  → App.tsx → registry.setEnabledSet(Set<id>)
queries:     getClaims(slotId) → filter out claims whose pluginId ∉ enabled set
escape hatch: getAllPluginsForActivationUi() bypasses the filter
```

The Plugins tab is the *only* consumer of `getAllPluginsForActivationUi`; every existing slot consumer continues to call `getClaims(slotId)` and gets free filtering. No slot-consumer code changes.

Default state (no `setEnabledSet` call yet) preserves current "all claims" behaviour so existing tests stay green and SSR-style use stays predictable.

This single change deletes the entire class of "disabled-plugin UI still renders broken" bugs that exist today.

### D3. Plugin settings consolidate under the owning plugin's row

Until this change, plugin authors picked which `SettingsPanel` tab their `settings-section` claim renders in via the `claim.tab` field, and that was the only place their settings lived. Discoverability suffered — the activation switch and the plugin's own settings sat in different tabs.

Resolution: the Plugins tab is the **sole** home for per-plugin settings. Every `<SettingsSectionSlot tab="..." />` invocation is removed from `SettingsPanel.tsx`; the matching import is dropped. The `claim.tab` manifest field is preserved as an inert hint so legacy manifests do not break the validator, but no consumer reads it.

- The Plugins tab renders `PluginSettingsHost(pluginId)` underneath each plugin's activation row. It renders every `settings-section` claim for that plugin id, in registry order (descending priority, then registration order).
- The General / Servers / Providers / Security tabs render zero plugin-contributed content.
- A repo-lint test asserts `SettingsPanel.tsx` no longer references `SettingsSectionSlot` at all.
- The slot-registry filter (D2) still gates rendering by the enabled set, so a disabled plugin's section disappears.

```
Plugins tab
│
├─ PluginsSection (activation list)
│    │
│    ├─ Row: roles       [enabled ●] [⚙]   ───▶ expanded ───┐
│    │                                              │
│    │   └─ PluginSettingsHost(pluginId="roles")  ───┘
│    │         └─ pi-flows Roles UI (BuiltInRolesSettings)
│    ├─ Row: jj          [enabled ●] [⚙]
│    │   └─ ⚠ requires binary jj
│    ├─ Row: honcho      [enabled ●] [⚙]
│    │   └─ ⚠ requires pi-memory-honcho [Install]
│    ├─ Row: flows       [enabled ●] [⚙ disabled — no settings]
│    └─ Row: flows-anthropic-bridge [error]
│        └─ [error block with copy button + actual error message]
```

Migration path for plugin authors:

- existing manifests with `claim.tab` keep working unchanged (the validator still accepts the field; nothing reads it);
- new manifests should omit `claim.tab` since it's inert;
- no breakage for authors who do nothing — their settings simply move from the General/Servers/Providers/Security tab to the Plugins tab, beneath their plugin row.

Why not preserve a dual-render: every shipped plugin targeted `tab="general"`, and the dual-render produced duplicated UI inside the expanded row. The user-facing complaint that triggered this reversal was "the Honcho memory section and Jujutsu Workspaces still show under General". Consolidation removes the duplication and makes the affordance obvious.

### D4. Declarative requirements replace ad-hoc per-plugin probes

Today honcho-plugin reimplements its own pi-extension probe in `client/hooks.ts` + `client/api.ts`, including a module-level sync cache (`extensionInstalledCache`), a closed-by-default initial state, and a manual prime call at module load. jj-plugin rides a per-session bridge probe for the `jj` binary, then gates predicates on `Session.jjState`. Both swallow the "dep missing" signal — neither surfaces a diagnostic the user can act on.

Resolution: the manifest declares requirements in one place; the loader probes them once per plugin and writes the result to `PluginStatus.requirements`. UI reads off that field.

```jsonc
// in package.json#pi-dashboard-plugin
"requires": {
  "piExtensions": ["pi-memory-honcho"],
  "binaries":     ["jj"],
  "services":     ["pi-model-proxy"]
}
```

Three probe kinds, each routed to existing infrastructure (no new I/O surface):

| Kind | Source of truth | Implementation |
|---|---|---|
| `piExtensions` | `packageManagerWrapper.listInstalled("global")` | Same data path `/api/packages/installed` already serves. Match using `sourcesMatch` helper from `recommended-routes.ts`. |
| `binaries` | `ToolRegistry` in `packages/shared/src/tool-registry/` | Existing registry — same one VSCode-style binary detection already uses. |
| `services` | Named service-probe registry | Built-in name `pi-model-proxy` lifts `detectPiModelProxy` out of honcho-plugin into the shared runtime. Plugins SHALL NOT register new service-probe names in V1 to keep the surface small; the registry is closed to plugin extension. |

The probe result lives on `PluginStatus`:

```ts
interface PluginRequirementReport {
  piExtensions: { name: string; satisfied: boolean }[];
  binaries:     { name: string; satisfied: boolean; resolvedPath?: string }[];
  services:     { name: string; satisfied: boolean; error?: string }[];
}

interface PluginStatus {
  // …existing fields…
  requirements?: PluginRequirementReport;
  missingRequirements?: string[]; // flat list of unsatisfied names, for UI badges
}
```

The flat `missingRequirements` list is convenient for the UI; the structured `requirements` field is for diagnostics and `[Install]` button wiring.

### D4a. Probe lifecycle

Probes are **not** the loader's blocking concern. The loader still loads server entries regardless of probe outcome — a plugin whose requirements are unsatisfied is still "loaded" from the loader's perspective; it just has a non-empty `missingRequirements` list and the UI nudges the user to fix it.

```
server start
   │
   ├─ discoverPlugins()
   │
   ├─ loadServerEntries()              ← unchanged, ignores requirements
   │      │
   │      └─ for each plugin: status.loaded = true/false
   │
   └─ refreshRequirementProbes()       ← new, fire-and-forget
          │
          └─ for each plugin: status.requirements = {...}
                              status.missingRequirements = [...]
                              broadcast plugin_config_update
```

Refresh triggers:
- once at server start, after `loadServerEntries`,
- once on every successful `package_operation_complete` (an extension was just installed or removed; requirements may now be satisfied), reusing the listener already wired in `server.ts:931`,
- on demand when `/api/health` is called and the cached report is older than 30 seconds.

The 30s TTL replaces honcho's bespoke module-level cache with one shared cache for every plugin.

### D5. Cross-reference between `RECOMMENDED_EXTENSIONS` and `pi-dashboard-plugin` manifests

The pairing between `pi-memory-honcho` (extension) and `honcho-plugin` (dashboard plugin) currently lives in:
1. `RECOMMENDED_EXTENSIONS` entry's `fallbackDescription` free-text — invisible to code,
2. `honcho-plugin/src/client/hooks.ts` runtime probe — invisible to the install browser.

Resolution: one new field on `RecommendedExtension`:

```ts
interface RecommendedExtension {
  // …existing fields…
  dashboardPlugin?: string;  // companion dashboard plugin id
}
```

Populate for `pi-memory-honcho` in this change: `dashboardPlugin: "honcho"`. The other five recommended entries leave it unset.

The recommended-extensions route enricher (`recommended-routes.ts:enrichEntry`) propagates the new field plus a computed `dashboardPluginInstalled: boolean` from the plugin status store. The client `RecommendedExtensions` component renders a "+plugin: <id>" badge next to the status pill when the field is set.

This is intentionally **one-way** linkage: the recommended manifest names the companion plugin, the dashboard plugin's `requires.piExtensions` names the extension. The two views describe the same pairing but neither is the source of truth for the other — they cross-check at render time.

### D6. Inline `[Install]` button reuses the existing installer

For a row in the Plugins tab whose `missingRequirements` contains a name that matches a `RECOMMENDED_EXTENSIONS.id`:

```
Row: honcho   [enabled ●]   ⚠ requires pi-memory-honcho (not installed)  [Install]
                                                                          │
                                                                          ▼
                                       usePackageOperations("global").install(source)
                                                                          │
                                                                          ▼
                                              existing POST /api/packages/install
                                                                          │
                                                                          ▼
                                         existing package_progress / complete WS
                                                                          │
                                                                          ▼
                                                singleton wrapper completion listener
                                                                          │
                                                                          ▼
                                       refreshRequirementProbes() (D4a hook)
                                                                          │
                                                                          ▼
                                            row updates: missingRequirements shrinks
```

For a row whose missing requirement does **not** match any recommended-extensions entry, render `[Install via Packages tab]` linking the user to the existing browser. No new install plumbing.

### D6a. Bundle first-party plugins into Electron resources

`bundle-server.mjs` previously copied only the four core packages (`server`, `shared`, `extension`, `dashboard-plugin-runtime`). First-party monorepo plugins (`roles-plugin`, `jj-plugin`, `flows-plugin`, `honcho-plugin`, `flows-anthropic-bridge-plugin`) were not bundled, so every fresh Electron install saw zero plugins.

Resolution: `bundle-server.mjs` copies each first-party plugin into `<bundle>/resources/plugins/<id>/`. After extraction the layout is `~/.pi-dashboard/resources/plugins/<id>/package.json`, which `findBundledPluginsDir()` already locates by walking up from the runtime `loader.ts` (it checks every parent's `resources/plugins/` directory).

Fixture-only plugins (`manifest.fixture === true`) are excluded — same rule as the build-time `PLUGIN_REGISTRY` filter in production builds.

No loader changes are needed; existing `findBundledPluginsDir()` semantics already cover the new path.

### D6b. Default-allow filter for build-time-known plugin ids

The initial `setEnabledSet` semantics ("enabled set = ids the server reports as enabled") broke in deployments where the build-time `PLUGIN_REGISTRY` knew about plugins the server could not discover at runtime (e.g. missing bundle). The filter removed every claim, hiding the flows / jj / roles UI entirely.

Resolution: `usePluginEnabledSet` computes the enabled set as

```
enabled = (every plugin id known to the build-time registry)
          ∪ (server-reported enabled ids)
          \ (server-reported explicitly disabled ids)
```

This makes the **disabled set** authoritative — server explicit-false wins, otherwise default-allow. The semantic flip costs nothing in healthy deployments (build-registry == server-discovery) and gracefully degrades in broken ones (server-discovery == ∅, all build-time claims remain visible).

### D7. Refactor honcho-plugin and jj-plugin onto the requirements model

honcho-plugin currently carries ~150 LOC of probe boilerplate that this change replaces:

| Today | After |
|---|---|
| `client/hooks.ts`: `checkExtensionInstalled`, module-level `extensionInstalledCache`, `primeExtensionInstalledCache`, `useExtensionInstalled` | Delete. Read `PluginStatus.missingRequirements` from the existing plugin context. |
| `client/shouldRender.ts`: closed-by-default until first probe | Delete. `shouldRender` returns `missingRequirements.length === 0`. |
| `server/routes-lifecycle.ts`: inline `detectPiModelProxy` gate | Delete. Probe runs in the loader; route reads `PluginStatus.requirements.services`. |
| `server/doctor.ts`: re-probes model proxy on each open | Read cached requirement report; fall back to direct probe only if the report is stale. |

jj-plugin keeps its **per-session** `Session.jjState` (cwd-specific), but moves the **global** "is jj available at all" check to `requires.binaries: ["jj"]`. The two probes answer different questions:

- "Is jj installed somewhere on this machine?" → requirements model (one probe per machine)
- "Does this specific cwd contain a `.jj/` directory?" → per-session bridge probe (one per session)

flows-anthropic-bridge-plugin's `lastProbe` (a `BridgeProbeSnapshot` updated by status events from the running bridge) is orthogonal to the requirements model and stays unchanged.

### D7a. Error visibility + copyability

The Plugins tab surfaces three error channels inline, each via a single `CopyableErrorBlock` component:

```ts
function CopyableErrorBlock({ text, testId }): JSX.Element {
  // icon + <pre>{text}</pre> + [Copy] button
  // Copy uses navigator.clipboard.writeText with a 1.5s "Copied✓" flash.
}
```

Channels:

- **`PluginStatus.error`** — server-reported failures (bridge probe failures, id conflicts, server-entry crashes). Was hover-tooltip-only; now visible without hover and copyable for paste-into-issue workflows.
- **`toggleError`** — transient `POST /api/plugins/:id/toggle` failures (auth, network, 4xx).
- **Section-level fetch failure** — same block, rendered at the top of `PluginsSection` when `listPlugins()` fails.

All three use the same theme-aware Tailwind colour pairs (`red-700`/`red-300`, `red-100`/`red-500/10`, `red-400`/`red-500/40`) so the message is readable on both light and dark themes.

### D7b. Settings affordance is a gear icon

The per-row expand affordance is `mdiCogOutline` (settings cog) rather than a chevron. Rationale:

- The chevron looked like "expand/collapse a description", but the actual content is the plugin's own settings UI. The cog matches the small gear in the expanded "Plugin settings" header for visual consistency.
- When the plugin has no `settings-section` claim, the cog is rendered at 40% opacity, `cursor-not-allowed`, with tooltip "No settings for this plugin". This is a stronger "not applicable" affordance than a hidden chevron.
- When expanded, the cog gains an active background highlight and `aria-pressed=true`, with tooltip flipping to "Hide plugin settings".

### D8. PluginStatus is additive — no field renames

Layer 1 adds `displayName`. Layer 1.5 adds `requirements` and `missingRequirements`. Every existing consumer (`bridgeLoadedFrom`, `lastProbe`, `enabled`, `loaded`, `error`, `claims`, `id`) keeps its current contract. The `/api/health.plugins[]` payload remains backward compatible.

## Risks / Trade-offs

- **Restart friction.** Users may expect instant toggle. Mitigation: clear banner + one-click Restart button + the same model used for extensions.
- **Slot registry now stateful.** `setEnabledSet` introduces ordering coupling — first paint before `/api/health` returns has no filter. Mitigation: default registry behaviour stays "show all" so first paint is at worst over-permissive, never broken.
- **Probe staleness.** A user installs `pi-memory-honcho` from the Packages tab, then opens the Plugins tab — does the honcho row immediately drop its "missing requirement" badge? Yes, because `setCompleteListener` for the wrapper already broadcasts on successful install, and we hook `refreshRequirementProbes` onto that listener (D4a). The 30s `/api/health` TTL is a fallback for paths that don't go through the wrapper (e.g. manual edits to settings.json).
- **Service-probe registry is closed in V1.** Plugins can't register new service-probe names; the shipped set is `pi-model-proxy` only. Trade-off: keeps the surface small and known. If demand emerges for plugin-registered probes (e.g. `honcho-server-running`), open the registry in a follow-up.
- **`claim.tab` dual-render is preserved indefinitely.** Every shipped plugin currently targets `tab="general"`, so the dual-render produces a duplicate section under the plugin row. Acceptable because: (1) strict superset, no break; (2) the duplication is only visible when expanding the row in the Plugins tab; (3) plugin authors can opt out by removing `tab`. A future deprecation can collapse the duplicate.

## Migration Plan

- All new manifest fields are optional → existing plugins keep working unchanged.
- Default `enabled !== false` semantics preserved → no plugin toggles state on upgrade.
- `PluginStatus` gains fields; consumers that destructure existing fields stay compatible.
- honcho-plugin and jj-plugin manifests gain `requires` in this change; their client probe code is deleted in the same commit so the runtime behaviour is identical from the first boot.

## Open Questions

None remaining for Layer 1 + 1.5. Items deferred to a future Layer 2/3:

- Should `dependsOn` between dashboard plugins ever exist? Re-evaluate once external plugin discovery (`external-dashboard-plugins`) lands.
- Should the service-probe registry open to plugin registration? Re-evaluate after honcho-plugin's refactor proves the closed-registry model.
- Should `claim.tab` be deprecated? Re-evaluate once a non-trivial number of third-party plugins exist.
