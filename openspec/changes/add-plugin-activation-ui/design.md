## Context

The plugin runtime is in place: discovery, server-side dynamic loading, status reporting, per-plugin config namespace + REST writes, slot registry + slot consumers. What is missing is a **user-facing way to turn a plugin off** with awareness of plugin-to-plugin dependencies, and the matching guarantee that disabling a plugin removes every UI footprint it owns.

Key existing surfaces:

- `loadServerEntries({ isEnabled })` in `packages/dashboard-plugin-runtime/src/server/loader.ts` — already skips disabled plugins at boot.
- `getPluginStatusStore()` populated during `loadServerEntries`, exposed via `/api/health.plugins[]`.
- Build-time generated `packages/client/src/generated/plugin-registry.tsx` that imports every claim. The slot registry currently exposes them all unconditionally.
- Hand-edited `~/.pi/dashboard/config.json#plugins.<id>.enabled` is the only existing toggle.

## Goals / Non-Goals

**Goals**
- Single Settings page lists every discovered plugin and every ghost id from config.
- Toggling a plugin updates config atomically and emits `plugin_config_update`; effect lands on next server restart.
- Disabling a plugin makes its UI vanish: no settings section, no badges, no command route, no tool renderer.
- Plugins can declare hard dependencies on other plugins; the toggle UI offers cascade enable/disable.
- A plugin can declare itself essential; the UI refuses to disable it and the route returns 403.

**Non-goals**
- Hot reload of plugins after a toggle — restart-required, like extensions.
- Soft / optional / capability-based deps — id-based hard deps only in V1.
- Cross-plugin permission model — the activation switch is the only knob.

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

The activation page is the *only* consumer of `getAllPluginsForActivationUi`; every existing slot consumer continues to call `getClaims(slotId)` and gets free filtering. No slot-consumer code changes.

Default state (no `setEnabledSet` call yet) preserves current "all claims" behaviour so existing tests stay green and SSR-style use stays predictable.

### D3. Dependency graph is pure and shared

A single `computeToggleImpact(graph, id, target)` lives in `packages/dashboard-plugin-runtime/src/dependency-graph.ts`:

```ts
type Graph = Map<string, { dependsOn: string[]; essential: boolean; installed: boolean; enabled: boolean }>;

function computeToggleImpact(g: Graph, id: string, target: boolean): {
  cascadeEnable: string[];   // deps to also enable (when target=true)
  cascadeDisable: string[];  // dependents to also disable (when target=false)
  blockers: string[];        // deps not installed → cannot enable
};
```

The same function powers:
- the route handler's validation (server source of truth),
- the UI confirm dialog (no server round-trip to discover cascade size).

Cycles are rejected at validate time inside `manifest-validator.ts`, so `computeToggleImpact` never sees a cycle.

### D4. Atomic cascade write

When the user accepts a cascade, the route writes one config object that flips every affected plugin in a single `writeConfig` call, then emits one `plugin_config_update` per affected id. This avoids a half-applied state if the process dies between writes.

### D5. Ghost rows

Plugins listed in `config.plugins.*` but absent from discovery render as `{ id, installed: false, source: "ghost", enabled: <from config>, claims: 0 }`. The activation page shows them with a "not installed" pill and a Remove button that calls `POST /api/plugins/:id/toggle { enabled: false, remove: true }` — strips the entry from `config.plugins` and emits `plugin_config_update`. The Remove button opens a single one-line confirm dialog ("Remove `<id>` from config?") before issuing the call. No restart needed for removal because nothing was ever loaded, and ghost-removal does **not** flip the "Restart required" banner.

`installed === (source !== "ghost")` always — both fields are reported because clients sometimes care about "do I have a manifest at all" (`installed`) and sometimes about "where did this come from" (`source`).

### D5a. Cycle detection — soft fail, never hard-crash discovery

A cycle in `dependsOn` (e.g. `a → b → a`) marks every plugin in the cycle with `loaded: false, error: "cycle: a→b→a"` and skips their server entries. Discovery itself does **not** throw, so a single broken third-party manifest cannot brick the dashboard. The activation UI surfaces the cycle as an error pill on each affected row. The validator continues to reject self-references and structurally invalid `dependsOn` arrays at parse time (those don't depend on cross-plugin context).

### D6. Essential plugins

`essential: true` is a manifest field set by the plugin author. The UI renders the toggle disabled with a tooltip ("Essential — cannot be disabled"). The route returns 403 when asked to disable an essential plugin so direct API users can't bypass the UI guard. We do not enumerate which built-in plugins are essential here — that is decided per-plugin by their author.

### D7. Two discovery sources, built-in wins on collision

Discovery scans **two** sources:

```
1. <repo>/packages/[*]/package.json                                       source = "built-in"
2. each entry in ~/.pi/dashboard/plugins/.pi-scope/settings.json#packages[],
   resolved to its on-disk path via pi's DefaultPackageManager           source = "installed"
```

The second source's payload lives wherever pi's package manager places it (npm cache, git cache, local checkout). The dashboard never installs into a flat `~/.pi/dashboard/plugins/<id>/` layout — only the private scope's `settings.json` is dashboard-managed.

Results are merged. If the same `id` appears in both, the built-in wins for slot-claim purposes; the user-installed copy is recorded with `status=error("id conflict")` and `loaded: false` so the user can see and uninstall it. This rule is intentional: built-ins ship with the dashboard and have been reviewed; a renegade npm publish of `flows` should not silently override the bundled `flows-plugin`.

Why a separate scope from pi's user-level scope: pi's user `packages[]` in `~/.pi/agent/settings.json` is owned by pi and is used by `pi pkg install`. We do not reuse it, because:

- the dashboard never edits pi's user `packages[]`,
- collisions between `pi pkg install foo` and `dashboard plugin install foo` would be surprising,
- a clean uninstall must be able to detach the package without affecting any pi-owned settings.

### D8. Cooperation with pi extensions — namespace boundary

The dashboard owns exactly one slice of `~/.pi/agent/settings.json`: the `dashboardPluginBridges` object, managed by `plugin-bridge-register.ts`. It does not touch `packages[]`. This rule survives the new install/uninstall flow:

- **Plugin install** — writes the install dir; if `manifest.bridge` is present, calls `registerBridgeExtension` to add `dashboard-<id>` under `dashboardPluginBridges`. Never touches `packages[]`, even when the package additionally declares `pi-extension` keywords.
- **Plugin disable** — sets `config.plugins.<id>.enabled = false`. On the next server start the loader skips the plugin and the bridge auto-deregister logic (already in place) removes the bridge entry. `packages[]` untouched.
- **Plugin uninstall** — removes the install dir and the `dashboardPluginBridges.dashboard-<id>` entry. `packages[]` untouched.

For a package that carries both keywords, this means the user gets a clear separation:

```
          npm package "@me/cool" with both keywords
                          │
        Plugins tab → install               Extensions tab → install (pi)
                          │                                 │
         dashboardPluginBridges                       packages[]
         (dashboard owns)                             (pi owns)
```

If a user wants both the UI claims and pi's extension treatment, they install in both tabs. The dashboard never tries to make this happen automatically because it would require writing into pi-owned config.

UI consequence: the Plugins-tab Install button shows an `alsoExtension` hint badge when a search result also carries `pi-extension` keywords, with a tooltip pointing the user to the Extensions tab if they want the pi-side too.

### D9. Install delegated to pi's package manager via a private dashboard scope

The dashboard does **not** reimplement install strategies. Every `POST /api/plugins/install` invocation goes through the existing `PackageManagerWrapper.run({ action: "install", ... })` code path, the same one that backs `pi pkg install` today.

Dashboard plugins live in a **private dashboard scope** at `~/.pi/dashboard/plugins/.pi-scope/`. Pi's `DefaultPackageManager` is given that directory as `cwd` and `local: true`, so:

- pi installs the package with its full machinery (npm cache, git clone, tarball fetch, local copy, build hooks, version pinning),
- pi records the install in `~/.pi/dashboard/plugins/.pi-scope/settings.json#packages[]`,
- pi sessions never read this private settings file, so the package is invisible to user pi sessions until or unless the user separately installs it as a pi extension via the Extensions tab.

The dashboard plugin loader then scans the private scope's `packages[]`, resolves each entry to its on-disk install path via pi's package manager, and registers the resulting `pi-dashboard-plugin` manifest in the slot registry.

```
CLIENT  POST /api/plugins/install { source: "npm:@me/foo" }
  │
  ▼
ROUTE   plugin-install-routes.ts
  │
  ▼
WRAPPER PackageManagerWrapper.run({
          action: "install",
          source: "npm:@me/foo",
          scope: "local",
          cwd: "~/.pi/dashboard/plugins/.pi-scope",
        })
  │
  ▼
PI      DefaultPackageManager.installAndPersist(source, { local: true })
          └─ npm / git / tarball / local-path strategy
          └─ build & install
          └─ records in <private-scope>/settings.json#packages[]
  │
  ▼
ROUTE   resolves package path → reads pi-dashboard-plugin manifest
          └─ validates (cycles, missing fields, id collision)
          └─ on failure: pm.removeAndPersist(...) → rollback
          └─ on success: registerBridgeExtension if manifest.bridge
          └─ config.plugins.<id> = { enabled: true, installSpec }
          └─ broadcast plugin_config_update
```

Uninstall is the inverse: `wrapper.run({ action: "remove", source: <installSpec>, scope: "local", cwd: <private-scope> })`, then scrub bridge entry, then scrub config entry. Idempotent.

**One queue, one wrapper, one progress channel.** The dashboard reuses the existing singleton `PackageManagerWrapper` constructed in `server.ts` — the same instance that backs `/api/packages/install` for pi extensions. Its single `busy` flag is the queue: plugin install, plugin uninstall, extension install, extension move all serialize against each other. Concrete consequences:

- progress (`setProgressListener`) and completion (`setCompleteListener`) callbacks are the existing ones in `server.ts`. They already broadcast the **`package_progress`** and **`package_operation_complete`** browser-protocol messages on every op the wrapper runs. Plugin installs flow through these unchanged — **no new WS message types**, no new SSE/REST progress endpoint, no protocol delta in `browser-protocol.ts`,
- `setReloadSessions` is shared too, so when a plugin install completes pi sessions reload and pick up the new `dashboardPluginBridges` entry on the next tick,
- the `PackageOperationBusyError` 409 path is the same shape `/api/packages/install` already returns, so the client UI uses one busy-handling code path for both extensions and plugins,
- pi's per-cwd `pmPending` cache key uses the private scope path, so the dashboard scope's `DefaultPackageManager` is constructed once and reused.

There is no second wrapper instance. The only thing the plugin install path adds on top of the extension install path is the `<private-scope>` cwd plus the post-install steps (manifest validation, bridge registration, config write).

### D9a. Operation routing in the UI — client-side filter on captured operationIds

Because `package_progress` and `package_operation_complete` are broadcast for *every* package op the wrapper runs, both the Extensions tab and the Plugins tab receive the same firehose. To keep each tab's progress UI scoped to its own operations, the client uses **captured-operationId filtering**:

```
User clicks Install in Plugins tab
        │
        ▼
POST /api/plugins/install → { operationId: "op-abc" }
        │
        ▼
Plugins tab adds "op-abc" to a local Set<string> of plugin-owned ops
        │
        ▼
Global WS firehose: package_progress { operationId: "op-abc", event } →
  Plugins tab renders progress because op-abc ∈ set
  Extensions tab ignores because op-abc ∉ its set
        │
        ▼
package_operation_complete { operationId: "op-abc", success: true, ... } →
  Plugins tab marks the op done, removes from set
```

The Extensions tab does the identical thing with its own `Set<operationId>`. This keeps the UI presentation cleanly per-tab while reusing one transport, one component template (a shared `PackageOperationsList` that takes a `filterOperationIds: Set<string>` prop), and one server-side broadcast path.

Server-restart edge case: an op started before a server restart cannot complete — its operationId is lost. That's already true for extensions today; same handling applies (the optimistic UI row falls off after a timeout / on next manual refresh).

### D10. Source format — 100% compatible with pi extensions

Because pi's `DefaultPackageManager` is the install engine, the source-string contract for plugin install is **identical** to pi's extension install:

| Form | Example |
|---|---|
| `npm:<spec>` | `npm:@me/foo@1.2.3` |
| `git:<url>` | `git:https://github.com/me/foo@v1` |
| protocol URL | `https://reg.example.com/foo-1.tgz` |
| absolute path | `/Users/x/dev/foo` |
| relative path | `./packages/foo` |

Why delegate instead of reimplementing:

- one mental model for users — `pi pkg install <source>` and the Plugins tab Install field accept the same strings,
- one set of edge cases (private registries, auth tokens, monorepo path resolution) battle-tested in pi,
- new source forms pi adds in the future are picked up by the dashboard automatically,
- `installSpec` round-trips through pi's `computeIdentity` so a future Reinstall/Update button can replay the same spec to get the same identity.

### D11. Plugin-contributed settings render under the Plugins tab AND wherever `tab` points

Until this change, plugin authors picked which `SettingsPanel` tab their `settings-section` claim renders in via the `claim.tab` field, and that was the only place their settings lived. Discoverability suffered — the activation switch and the plugin's own settings sat in different tabs.

Resolution: the Plugins tab becomes the **canonical** home for per-plugin settings, while the legacy `tab`-targeted rendering is **preserved unchanged**.

- The Plugins tab adds a `PluginSettingsHost(pluginId)` underneath each plugin's activation row. It always renders every `settings-section` claim for that plugin id.
- The existing `<SettingsSectionSlot tab="general" />`, `tab="servers"`, `tab="providers"`, `tab="security"` calls in `SettingsPanel.tsx` stay in place and continue to render claims that opted into those tabs.
- A claim with `tab` set therefore appears in **both** locations. A claim with no `tab` field appears **only** under the plugin row in the Plugins tab.
- The slot-registry filter (D2) gates both render points by the enabled set, so a disabled plugin's section disappears everywhere uniformly.

```
Plugins tab
│
├─ PluginsSection (activation list)
│    │
│    ├─ Row: jj          [enabled ●]  [⌄]   ────▶ expanded ──┐
│    │                                              │
│    │   └─ PluginSettingsHost(pluginId="jj")  ─────┘
│    │         └─ plugin's settings-section claim
│    ├─ Row: openspec    [enabled ●]  [⌄]
│    ├─ Row: demo        [disabled ○]
│    └─ ... (essential / ghost rows)
│
└─ PluginsInstallSection (browse + install)
```

Migration path for plugin authors:

- doing nothing keeps the legacy behaviour AND adds the Plugins-tab rendering on top — strict superset, no breakage,
- removing `claim.tab` consolidates the section to only the Plugins tab,
- both stances are valid; the validator does not warn either way.

The `SettingsSectionSlot` export from `dashboard-plugin-runtime` keeps its current contract. No tab strings change. No `<SettingsSectionSlot tab="..." />` invocations are removed from `SettingsPanel.tsx`.

## Risks / Trade-offs

- **Restart friction.** Users may expect instant toggle. Mitigation: clear banner + one-click Restart button + the same model used for extensions.
- **Cascade surprise.** Disabling `git` might cascade-disable several dependents. Mitigation: confirm dialog lists every cascade target before write.
- **Slot registry now stateful.** `setEnabledSet` introduces ordering coupling — first paint before `/api/health` returns has no filter. Mitigation: default registry behaviour stays "show all" so first paint is at worst over-permissive, never broken.
- **Ghost remove without restart** is a minor consistency wart (every other change requires restart). Worth it because no code is ever loaded for a ghost.

## Migration Plan

- All new manifest fields are optional → existing plugins keep working unchanged.
- Default `enabled !== false` semantics preserved → no plugin toggles state on upgrade.
- `PluginStatus` gains fields; consumers that destructure existing fields stay compatible.

## Open Questions

_None remaining for V1; resolved during proposal review:_

- Ghost-removal **requires** a single one-line confirm dialog (no type-to-confirm).
- `POST /api/plugins/install` accepts every source form pi accepts (npm / git / tarball URL / abs path / rel path) via the shared `PackageManagerWrapper`.
