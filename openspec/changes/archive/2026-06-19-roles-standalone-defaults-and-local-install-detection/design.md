## Context

Two unrelated defects produce one confusing experience around Roles + Subagents.

**Install detection.** Whether a package is "installed" is decided by string-matching its install source against a canonical source. `packages/shared/src/source-matching.ts::sourcesMatch(a, b)` parses each side into `npm | git | raw` and matches: `npm↔npm` (exact name), `git↔git` (host/owner/repo), `raw↔raw` (exact string), `git↔raw` (repo name == path basename), `git↔npm` (repo name == unscoped npm name). There is **no `npm↔raw` branch**. The recommended manifest declares almost everything as `npm:`. The plugin requirement probe (`packages/dashboard-plugin-runtime/src/server/requirement-probes.ts::installedMatchesName`) also leans on this matcher, with extra `installed.id/name/displayName === name` escape hatches that are dead in practice because `listInstalled()` returns pi's `listConfiguredPackages()` (only `{ source, scope }`, no enriched name). Net: a global install built from a local path (source kind `raw`) of an `npm:`-declared extension reports "not installed."

**Roles bootstrap + coupling.** Roles live in `~/.pi/agent/providers.json#roles`, owned by `packages/extension/src/role-manager.ts` (ownership moved off pi-flows). A fresh file has no `roles` key, so `loadRoleConfig()` returns `{}`. `RolesSettingsSection.tsx` renders an empty-state ("install pi-flows") with no way to create a first role — a dead end. The dashboard already hardcodes a canonical role set elsewhere in the ecosystem (`pi-flows` `KNOWN_MODEL_ROLES`: planning/coding/compact/fast/vision/research), which matches a real configured machine's `providers.json#roles`. Separately, the Subagents plugin manifest declares `dependsOn: ["roles"]`, a HARD load gate in `loader.ts` (missing/disabled dep → `loaded:false`). The requirement probe is non-blocking; the `dependsOn` gate is the only thing that actually prevents Subagents from loading. Roles already exposes a standalone resolver event (`role:resolve-model`), so the hard coupling is unnecessary.

## Goals / Non-Goals

**Goals:**
- Git/local-build installs of npm-declared extensions are detected as installed by both the recommended list and the requirement probe.
- Fresh installs always show a populated Roles table (default role names), never an empty dead end.
- Unconfigured roles are "shadow-disabled": panel enabled+loaded, resolver returns a structured "not configured yet" error.
- Subagents no longer hard-fails to load when Roles is empty/disabled.

**Non-Goals:**
- Moving roles out of `providers.json` (it stays — pi's `@role` resolver reads it; relocating breaks alias resolution).
- Changing the general `dependsOn` load-gate semantics for other plugins (only the Subagents→Roles edge is removed).
- Auto-assigning models to default roles (defaults are names only; the user picks models).
- Reworking the recommended-extensions manifest source strings.

## Decisions

### D1 — Add `npm ↔ raw` matching, mirroring `git ↔ raw`
In `sourcesMatch`, when one side is `npm` and the other is `raw`, compare `localPathBasename(raw)` to the unscoped npm name (strip `@scope/`). This reuses the existing `localPathBasename` helper and the same false-positive tradeoff already accepted for `git↔raw`. Chosen over (a) enriching `listInstalled()` with package.json `name` (heavier I/O, still misses the recommended-list path) and (b) exact-path manifest entries (unmaintainable). The fix lands in one shared function consumed by both call sites.

### D2 — Requirement probe delegates to the canonical matcher
`installedMatchesName` keeps its `id/name/displayName` checks but relies on the now-fixed `sourcesMatch` for the source comparison, so the local-build case is satisfied without depending on enriched fields that pi does not populate.

### D3 — Default role names owned by the dashboard, overlay-only (no auto-write)
Define `DEFAULT_ROLE_NAMES = [planning, coding, compact, fast, vision, research]` in the dashboard (`role-manager.ts`) rather than reading from pi-flows (which may not be installed — the dashboard owns roles now). RESOLVED (overlay-only): the dashboard does NOT auto-write defaults to `providers.json`. `flow:role-get-all` overlays the default names at READ time so the table is always populated; a role reaches disk only when the user assigns a model (existing `flow:role-set`). Rejected auto-seed-on-activate because it writes the shared global `providers.json` uninvited on every session, the seeded empties are filtered by `loadRoleConfig` and wiped by the next `flow:role-set` anyway, and it broke the "no-op role-set creates no file" invariant. Overlay alone fully resolves the chicken-egg.

### D4 — Shadow-disabled, not hard-disabled
The Roles plugin stays `enabled` + `loaded`. The UI renders default rows as "— set a model —" plus a one-line "No roles have been set up — set up now" banner; the stale "install pi-flows" empty-state is removed. `role:resolve-model` returns `{ ok:false, reason:"role '<name>' not configured yet" }` (additive probe field) when a role has no model. This preserves the standalone resolver contract while signalling unconfigured state.

### D5 — Remove the Subagents→Roles hard dependency
Drop `dependsOn: ["roles"]` from the Subagents manifest; regenerate `plugin-registry.tsx`. The Explore agent's `@fast` resolution now degrades to D4's structured error instead of the plugin failing to load. Update the inline disclaimer in `SubagentsSettings.tsx` from "disabling Roles cascade-disables Subagents" to "configure Roles so `@fast` resolves; otherwise subagents using `@role` aliases report not-configured."

## Risks / Trade-offs

- **`npm↔raw` false positives** (a local dir whose basename collides with an unrelated npm package name reads as that package) → Mitigation: identical to the long-standing `git↔raw` tradeoff; basename collision across distinct real installs is rare and already tolerated.
- **Seeding writes to `providers.json` a user never touched** → Mitigation: seed only on explicit first setup (or overlay at read-time and persist on first model pick); preserve all unrelated keys via the existing atomic tmp+rename writer.
- **Removing `dependsOn` lets Subagents load with `@fast` unresolved** → Mitigation: D4's structured error makes the failure legible at spawn time; the inline disclaimer points the user to configure Roles.
- **Default role list drifts from pi-flows `KNOWN_MODEL_ROLES`** → Mitigation: document the list as dashboard-owned; optionally extract to `shared` later if both consumers must agree.

## Migration Plan

1. Land `sourcesMatch` `npm↔raw` branch + tests (no behavior change for existing matches).
2. Point requirement probe at the fixed matcher.
3. Add `DEFAULT_ROLE_NAMES` + seed/overlay + resolver error contract in role-manager.
4. Update Roles UI (default rows, banner, remove empty-state) and Subagents disclaimer.
5. Remove `dependsOn:["roles"]`; regenerate plugin registry.
6. Full rebuild + restart + reload per the project rebuild matrix.

Rollback: revert the commit; `providers.json` seeded keys are harmless (empty role values are ignored by `loadRoleConfig`'s blank-value filter).

## Open Questions

- ~~Seed-on-first-setup (write) vs. overlay-at-read~~ RESOLVED: overlay-only, no auto-write (see D3).
- Should `DEFAULT_ROLE_NAMES` live in `shared` so pi-flows and the dashboard cannot diverge, or stay dashboard-local for now? (Deferred — dashboard-local for this change.)
- ~~Should `npm↔npm` also tolerate scope mismatch~~ RESOLVED: out of scope; only `npm↔raw` added.
