## Why

The dashboard owns roles and model resolution (`dashboard-roles-ownership`, `dashboard-model-resolution`), but exposes them only through WebSocket messages driven by the human Settings UI. An agent running *inside* a session is blind: it cannot see which roles exist, what they bind to, or which model refs are assignable, and it cannot wire a role or preset.

Underneath the tools sits a deeper model-handling defect. The dashboard stores custom providers in its OWN `~/.pi/agent/providers.json` (which pi core never reads) and injects their models at runtime via ephemeral `pi.registerProvider()` after a live `/v1/models` fetch. pi's NATIVE persistent custom-model store is `~/.pi/agent/models.json` (read by `ModelRegistry.create(authStorage, models.json)` in every session, flow, subagent, and the dashboard server). Because discovered models are never written there, they exist only in the session that discovered them: the server's `internal-registry.ts` custom-provider loop is literally an empty no-op that defers to a `models.json` which stays empty, so `GET /api/models` shows zero custom models; flows/subagents hit an async-discovery race; and the code grew a `modelRegistryRef` cache plus a dead `pi.modelRegistry` fallback (a property that does not exist on `ExtensionAPI` in 0.80) to paper over the gap. The fixed default role-name set is also un-removable by construction, blocking user-defined roles.

This change consolidates custom-provider registration onto pi-native `models.json` so one registry serves every consumer (as pi intended), then layers the agent tools + editable roles on top.

## What Changes

- Add three agent-facing tools (registered via `pi.registerTool` in the dashboard extension), roles and models DECOUPLED so model listing works even when roles are absent/unconfigured/malformed:
  - `list_models` — read: returns `[{ ref, provider, id, reasoning, input, contextWindow, cost }]` from the in-process session registry, where `ref` is the exact `"provider/modelId"` literal assignable via `update_roles`. Independent of the role slice; SHALL succeed even if `providers.json#roles` is missing or malformed.
  - `list_roles` — read: returns `{ roles (bound-only), presets, activePreset }`. NO models slice. Unset role slots are omitted from the tool output (human UI keeps the empty-slot overlay).
  - `update_roles` — write, action-dispatched (discriminated schema): `set_role { role, ref, preset? }`, `remove_role { role }`, `create_preset { name }`, `load_preset { name }`, `delete_preset { name }`. `set_role` on a new role name creates it (implicit add). Every write requires an `ask_user` confirmation because it mutates the global `~/.pi/agent/providers.json` shared by all sessions.
- Make the role-name set editable: replace the hardcoded `DEFAULT_ROLE_NAMES`-as-const behavior with a user-editable role-name schema. A new role surfaces as an empty slot in every preset (resolution targets stay stable across presets). `remove_role` **purges** the role from every preset (with confirmation).
- **Consolidate custom-provider registration onto pi-native `models.json` (the root cleanup):**
  - After `/v1/models` discovery + metadata enrichment, WRITE the discovered custom-provider models into `~/.pi/agent/models.json` (pi's documented custom-model store: `{ providers: { <name>: { baseUrl, api, apiKey, models: [{id, reasoning, input, cost, contextWindow, maxTokens, …}] } } }`). pi's `ModelRegistry.create` then loads them SYNCHRONOUSLY at startup for every session, flow, subagent, and the dashboard server — no runtime-only injection, no async race, no cross-process divergence.
  - Writes MUST merge, not clobber: preserve any hand-authored `models.json` entries, namespace dashboard-managed providers, atomic tmp+rename.
  - Provide an **auto-migration script** that moves existing `~/.pi/agent/providers.json#providers` → `~/.pi/agent/models.json#providers` (discovering/enriching models), preserves `roles`/`rolePresets`/`activePreset` in `providers.json`, is idempotent, and backs up before writing.
  - With models pi-native, the two registries collapse: `GET /api/models` (server) and the in-session registry return the same custom models; `list_models` reads one uniform source; the model selector auto-collects them; flows/subagents get them bundled as pi intended.
- **Fix the dead registry handle** (now a small corollary, not the headline): `getModelRegistry()` acquires `ctx.modelRegistry` and drops the dead `pi.modelRegistry` cast (provably a no-op on `ExtensionAPI` 0.80). Once custom models are pi-native, the `modelRegistryRef` juggling + the harness's own dead `pi.modelRegistry` fallback are removed; the child is spawned WITH the resolved `Model`.
- Consolidate resolvers onto `model:resolve`:
  - Extract a single `lookupRole()` accessor; both the resolver and the new tools read/write the role slice through it (no fourth independent reader).
  - `role:resolve-model` becomes a thin one-release deprecated alias delegating to the same resolve path (serves only legacy harness builds that read `probe.resolved`); **BREAKING** at next major (removal). The current harness already emits `model:resolve` and reads `probe.model`, so no emit migration is required.
- **BREAKING — drop the legacy `flow:` prefix (dashboard-owned, zero external emitters):**
  - Rename the five role events `flow:role-*` → `roles:*` (`roles:get-all`, `roles:set`, `roles:preset-load`, `roles:preset-save`, `roles:preset-delete`). All emitters are in-repo (`bridge.ts`) and all handlers in-repo (`role-manager.ts`); pi-flows has zero role code, so this is a clean atomic rename with NO compatibility alias. The one-release-shim rationale in the base spec is obsolete (the shim window expired and pi-flows no longer emits these).
  - Delete `flow:resolve-model` NOW (not next major): it is a deprecated alias with a `model:resolve` replacement and zero in-repo emitters.

## Capabilities

### New Capabilities
- `agent-role-model-tools`: three decoupled agent-facing tools — `list_models` (read, roles-independent), `list_roles` (read, roles/presets only), and `update_roles` (write, confirmed) — for introspecting the model catalogue and wiring roles/presets from inside a session.
- `custom-provider-model-registry`: dashboard persists discovered custom-provider models to pi-native `~/.pi/agent/models.json` (merge-not-clobber, atomic) so a single `ModelRegistry` serves every consumer; includes the one-time `providers.json#providers` → `models.json` auto-migration.

### Modified Capabilities
- `dashboard-roles-ownership`: role-name set becomes user-editable (add via implicit `set_role`, purge via `remove_role`); new roles surface as empty slots across all presets; `set_role` gains an optional explicit `preset` target; the role slice is read/written through a single `lookupRole()` accessor; **the five role events are renamed `flow:role-*` → `roles:*` (atomic, no alias)**.
- `dashboard-model-resolution`: custom providers persisted to pi-native `models.json` so `ModelRegistry.create` loads them everywhere (session + flows + subagents + server) — the ephemeral runtime-only `registerProvider` divergence and the async-discovery race are removed; `getModelRegistry()` acquires `ctx.modelRegistry` and drops the dead `pi.modelRegistry` fallback; `role:resolve-model` demoted to a one-release alias; **`flow:resolve-model` deleted now**.

## Impact

- Code: `packages/extension/src/role-manager.ts` (tools, editable schema, `lookupRole()`, `roles:*` handler rename), `packages/extension/src/provider-register.ts` (registry-handle fix, resolver dedup, delete `flow:resolve-model`), `packages/extension/src/bridge.ts` (~11 `flow:role-*` emit sites → `roles:*`), `packages/roles-plugin/src/RolesSettingsSection.tsx` (empty-slot overlay must survive editable schema), `packages/client/src/App.tsx` (comment ref).
- Cross-package: `@blackbelt-technology/pi-dashboard-subagents` harness ALREADY emits `model:resolve` and reads `probe.model`; only change is deleting its dead `pi.modelRegistry` fallback + bumping the installed build. The one-release `role:resolve-model` alias serves only legacy harness builds.
- Consolidation code: `packages/extension/src/provider-register.ts` (discover → write `models.json`, drop ephemeral-only registration + dead fallback), `packages/server/src/model-proxy/internal-registry.ts` (the empty custom-provider no-op loop now unnecessary — models come from the populated `models.json`), new migration script under `scripts/` (or `.pi/skills/implement/scripts/`).
- Behavior change (intended): `agent-model-introspection`'s `GET /api/models` NOW returns custom-provider models (previously zero, because `models.json` was empty). Its spec requirements are unchanged — this is the reachability set finally including customs; verify `models-introspection-routes` tests reflect that.
- Data: `~/.pi/agent/models.json` becomes the custom-model source of truth (pi-native, dashboard-managed + hand-authored merge). `~/.pi/agent/providers.json` keeps ONLY `roles`/`rolePresets`/`activePreset` (+ a user-editable role-name schema) post-migration; writes stay atomic tmp+rename, preserve unrelated keys.
- Migration: `providers.json#providers` → `models.json#providers` auto-migration script; idempotent; backs up before writing; leaves roles in place.

## Discipline Skills

- `doubt-driven-review`: resolver consolidation + subagents-harness contract change are cross-boundary and hard to reverse; review before the alias/removal lands.
- `security-hardening`: `update_roles` lets an in-session agent mutate global machine-wide config; confirm the `ask_user` gate and blast-radius are adequate.
- `systematic-debugging`: the dead-registry-handle fix is a bug reproduction (spawned-session resolution failure) — reproduce, then fix.
- `code-simplification`: consolidation removes the two-registry divergence, ephemeral-only `registerProvider`, `modelRegistryRef` juggling, and dead fallbacks — a deliberate complexity-reduction pass with existing tests as the safety net.
