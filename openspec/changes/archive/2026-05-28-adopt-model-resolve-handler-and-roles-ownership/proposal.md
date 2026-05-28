## Why

Two recent changes in sibling packages converge on this repo:

1. `@blackbelt-technology/pi-dashboard-subagents` change `add-model-resolve-event-with-fallback` introduces a universal `model:resolve` event-bus contract for resolving any model reference (`@role`, `provider/model[:thinking]`, bare `model-id`) into a `Model` object plus auth. Subagents now emit `model:resolve` and rely on a handler living **outside** their package.

2. `@blackbelt-technology/pi-flows` change `consume-model-resolve-event` makes pi-flows a pure consumer of `model:resolve` — same primary-then-fallback pattern as subagents. pi-flows STOPS owning `~/.pi/agent/providers.json#roles`. Its `extensions/role-manager.ts` is being deleted, including the `flow:role-set` / `flow:role-get-all` / `flow:role-preset-*` event handlers that today back the dashboard's `RolesSettingsSection.tsx` UI.

This repo (pi-agent-dashboard) is the natural new home for both responsibilities:

- The `model:resolve` handler — because the dashboard already owns the `providers` section of `providers.json` (via `provider-register.ts`) and now also owns the `roles` section after pi-flows hands it off.
- The relocated `flow:role-*` event handlers — because `RolesSettingsSection.tsx` (a dashboard component) is the only UI that uses them.

The `model:resolve` listener has already been added to `packages/extension/src/provider-register.ts` informally as part of cross-repo wiring; this change formalizes that work via OpenSpec and adds the still-missing piece: relocating the `flow:role-*` listeners from pi-flows.

A codebase search confirms only `pi-flows/extensions/role-manager.ts` (today) and `pi-agent-dashboard/RolesSettingsSection.tsx` (today, via the bridge) participate in the `flow:role-*` event traffic. No third-party listeners exist.

## What Changes

- **ADDED** `pi.events.on("model:resolve", …)` handler in `packages/extension/src/provider-register.ts`. Already implemented in the working tree as part of cross-repo wiring; this change captures it formally with tests.
- **ADDED** in-package readers/writers for `~/.pi/agent/providers.json#roles` (and the `rolePresets` / `activePreset` siblings) — ported from `pi-flows/extensions/role-manager.ts`. Same on-disk format; the file remains the single source of truth.
- **ADDED** the `flow:role-set` / `flow:role-get-all` / `flow:role-preset-load` / `flow:role-preset-save` / `flow:role-preset-delete` event handlers, with behavior preserved from pi-flows' implementation. Event NAMES are preserved (still `flow:…`) for one release so `RolesSettingsSection.tsx` doesn't need a coordinated change. The `flow:` prefix is misnamed for an event that no longer lives in pi-flows; a rename to `roles:*` is deferred to a follow-up.
- **DEPRECATED (already in the tree)** the legacy `pi.events.on("flow:resolve-model", …)` handler. Kept as a one-release alias with a `// DEPRECATED` note. To be removed in the next major.
- **MODIFIED** `provider-register.ts` JSDoc Event API header to list `model:resolve`, `flow:role-*`, and the deprecation note for `flow:resolve-model`.
- The dashboard adds NO new on-disk state. It writes the same `providers.json` file pi-flows currently writes; on the read side, pi-flows stops reading the `roles` key (per its companion change).

## Capabilities

### New Capabilities

- `dashboard-model-resolution`: How pi-agent-dashboard answers `model:resolve` for any caller in the pi extension ecosystem. Covers the algorithm (role-indirection → provider/model split → bare-id "like" query), the probe shape, the cooperative early-return idiom, and the auth-fill side effect.
- `dashboard-roles-ownership`: How pi-agent-dashboard owns the `roles` / `rolePresets` / `activePreset` sections of `~/.pi/agent/providers.json` and exposes them via the `flow:role-*` event API. Captures the read/write contract, preset-load semantics, and the requirement that pi-flows no longer touches these keys.

### Modified Capabilities

(none — no existing dashboard spec covers either of these)

## Impact

- **Code**:
  - `packages/extension/src/provider-register.ts`: keeps the already-added `model:resolve` handler and associated helpers (`loadRoles`, `splitThinkingSuffix`, `resolveModelProbe`); add `flow:role-*` handlers; keep the deprecated `flow:resolve-model` handler one release.
  - `packages/extension/src/bridge.ts`: unchanged (it already re-emits `flow:role-*` events from the UI side).
- **Tests**: new unit tests for `resolveModelProbe` (parallel to `pi-dashboard-subagents/extensions/__tests__/model-resolve.test.ts`). New integration tests for the `flow:role-*` handlers (parallel to whatever pi-flows had — port them).
- **Cross-repo timing**: this change MUST land BEFORE or at least CONCURRENTLY with `pi-flows/consume-model-resolve-event`. Otherwise there will be a release window where `flow:role-*` events have no backend.
- **Upgrade path**: documented as "upgrade pi-agent-dashboard first, then pi-flows". A runtime warning in pi-flows' activate hook can detect missing handlers and point at this doc — optional, out of spec scope.
- **No new dependencies.** No new files outside `packages/extension/src/`.
