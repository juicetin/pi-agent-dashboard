## Why

Two independent root causes make the Roles + Subagents area fragile, especially for fresh installs and developers running locally-built extensions:

1. **Install detection lies for git/local installs.** The canonical "same package" predicate (`sourcesMatch`) has no `npm ↔ local-path` branch. Most recommended extensions are declared as `npm:` sources, so an extension installed globally from a local build (source = a filesystem path, kind `raw`) fails to match its `npm:` manifest entry. Both the recommended list and the plugin requirement probe report it "not installed" even though it is installed and working.

2. **Roles is a chicken-and-egg dead end, and it can take Subagents down with it.** A fresh `~/.pi/agent/providers.json` has no `roles` key, so the Roles panel renders an empty state ("Install an extension that registers roles (e.g. `pi-flows`)") — stale copy (roles are owned by the dashboard now, not pi-flows) with no affordance to create a first role. Meanwhile the Subagents plugin declares `dependsOn: ["roles"]` as a HARD load gate, so a disabled/empty Roles plugin cascade-disables Subagents.

## What Changes

- **Fix install detection:** add an `npm ↔ raw` (local path) branch to the canonical source matcher, mirroring the existing `git ↔ raw` basename rule. Git and local-build installs of npm-declared extensions are correctly detected as installed by both the recommended list and the plugin requirement probe.
- **Seed default role names on fresh install:** the dashboard ships a canonical default role set (`planning`, `coding`, `compact`, `fast`, `vision`, `research`). On first setup these names are persisted to `providers.json#roles` (names only, no model assignments). The Roles table is always populated — never an empty dead end.
- **Replace empty-state UX with shadow-disabled state:** instead of "install pi-flows", an unconfigured Roles panel shows the default role rows (each "— set a model —") plus a one-line banner "No roles have been set up — set up now". The plugin stays enabled and loaded.
- **Make `role:resolve-model` degrade gracefully:** for a role with no assigned model, the resolver returns a structured "not configured yet" error instead of silently failing or being absent. Callers (e.g. the Subagents Explore agent resolving `@fast`) get a clear, actionable error.
- **BREAKING (manifest): decouple Subagents from Roles.** Remove `dependsOn: ["roles"]` from the Subagents plugin manifest so an empty/disabled Roles plugin can no longer cascade-disable Subagents. Subagents degrades (clear `@role` error) instead of failing to load.

## Capabilities

### New Capabilities
- `package-source-matching`: canonical "two source strings refer to the same package" predicate. Owns the cross-kind tolerance rules (npm/git/local-path), including the new `npm ↔ raw` branch. Consumed by the recommended-extensions cross-reference and the dashboard plugin requirement probe.

### Modified Capabilities
- `dashboard-roles-ownership`: seed + persist the default role-name set on first setup; render the unconfigured panel with default rows and a "set up now" banner (shadow-disabled, not hard-disabled); `role:resolve-model` returns a structured "not configured yet" error for unset roles.
- `dashboard-plugin-loader`: the plugin requirement probe (`piExtensions` satisfaction) delegates to the canonical matcher so git/local installs are detected; the Subagents plugin no longer declares `roles` as a hard `dependsOn` load gate.

## Impact

- **Shared:** `packages/shared/src/source-matching.ts` (new `npm ↔ raw` branch).
- **Plugin runtime:** `packages/dashboard-plugin-runtime/src/server/requirement-probes.ts` (matching delegates to canonical predicate).
- **Server:** `packages/server/src/routes/recommended-routes.ts` (benefits from matcher fix; no logic change expected).
- **Roles:** `packages/extension/src/role-manager.ts` (seed/persist defaults, `role:resolve-model` error contract); `packages/roles-plugin/src/RolesSettingsSection.tsx` (default-row rendering, new banner copy, remove stale empty-state).
- **Subagents:** Subagents plugin manifest (remove `dependsOn: ["roles"]`); `packages/subagents-plugin/src/client/SubagentsSettings.tsx` (update the inline Roles-dependency disclaimer).
- **Bridge protocol:** `roles_list` payload may carry default (unassigned) role names; `role:resolve-model` probe gains an error/`reason` field (additive).
- **Generated:** `packages/client/src/generated/plugin-registry.tsx` regenerated after the manifest change.
