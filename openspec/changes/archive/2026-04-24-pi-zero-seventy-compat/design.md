## Context

We track upstream `@mariozechner/pi-coding-agent` releases via the `piCompatibility` block in `packages/server/package.json` (read by `packages/server/src/pi-version-skew.ts`) and via the offline-cache pin in `packages/electron/offline-packages.json` (consumed at first-run install). Both are stale relative to upstream:

- declared `recommended`: `0.6.7` (~64 minor versions behind)
- managed install on disk: `0.68.0`
- global install: `0.68.1`
- upstream latest: `0.70.0`

The 0.69.0 release introduced two contracts that touch our code:

1. **TypeBox 1.x migration** — pi-coding-agent now ships `typebox` (1.x) directly. The old `@sinclair/typebox` import path is preserved by an alias for legacy extensions but `@sinclair/typebox/compiler` is no longer shimmed. Our `packages/extension/src/ask-user-tool.ts` imports `Type` from `@sinclair/typebox` (no `/compiler` use), so it works today but is on the deprecation path.
2. **Captured-ctx invalidation** — after `ctx.newSession()` / `ctx.fork()` / `ctx.switchSession()`, captured pre-replacement `pi`/`ctx` references throw on session-bound access. Our bridge holds three long-lived caches (`cachedCtx`, `cachedModelRegistry`, `cachedHasUI`) and `provider-register.ts` holds an even longer-lived `modelRegistry` reference captured from `session_start`.

Investigation of the bridge code (`packages/extension/src/bridge.ts`, `provider-register.ts`, `session-sync.ts`) confirms we **never** call the three replacement APIs ourselves — pi triggers them internally and re-emits `session_start` with `event.reason ∈ {"new","fork","resume"}`, which our `handleSessionChange` already uses to re-capture state. The contract is therefore satisfied today by accident; the design goal is to make it satisfied on purpose, plus a guard test so future contributors can't quietly break it.

## Goals / Non-Goals

**Goals:**
- Make `piCompatibility` a useful signal again (`recommended` matches upstream within one minor; `minimum` matches the version we actually test against).
- Pin the offline-bundled pi version to the same `recommended`.
- Migrate the one remaining `@sinclair/typebox` import to `typebox` so the dashboard runs cleanly when pi eventually drops the alias.
- Codify the "no replacement-API calls from bridge" invariant with a repo-level test that mirrors the existing `no-direct-process-kill.test.ts` / `no-raw-node-import.test.ts` style.
- Document the captured-ctx lifecycle in `bridge-extension` spec so the rule is discoverable.

**Non-Goals:**
- Adopt new 0.69/0.70 features (`addAutocompleteProvider`, `setWorkingIndicator`, `terminate: true`, `withSession`, `/clone`).
- Change runtime behavior of the bridge or any user-facing flow.
- Touch `bootstrap-install` defaults beyond the version pin.
- Migrate other `@sinclair/typebox` consumers in the wider monorepo (none exist outside `ask-user-tool.ts` per `rg`).

## Decisions

### D1. Set `piCompatibility.minimum` to `0.70.0` (lockstep with `recommended`)

We explicitly do not maintain backward compatibility for older pi versions. Pinning `minimum = recommended = 0.70.0` keeps the contract simple: one supported pi, no conditional code paths in the bridge, no dual-import shim for TypeBox. Older pi users see the existing 503-blocking banner with the bundled `Upgrade pi` affordance. **Rejected**: `0.68.0` / `0.69.0` (would force a backward-compat shim for the typebox swap; explicitly out of scope per project policy).

### D2. `recommended = 0.70.0`, `maximum = null`

`recommended` drives the amber upgrade hint via `BootstrapBanner`. Tracking upstream within one minor keeps users on a current pi without forcing it. Leaving `maximum` null avoids a future upper-bound block — the changelog shows pi has been disciplined about breaking changes (always called out, always with migration). We'll re-evaluate if 0.71+ ships an actual breaking surface we depend on.

### D3. Migrate only `ask-user-tool.ts`, not vendor any TypeBox runtime

`ask-user-tool.ts` is the sole `@sinclair/typebox` consumer. The new `typebox` package is already in pi 0.69+'s peer-dep graph, so a plain `import { Type } from "typebox"` resolves at runtime without us adding it to `packages/extension/package.json`. We rely on the same peer-dep model already in play for `@sinclair/typebox`. **Rejected**: adding `typebox` to our package.json (unneeded duplication; pi owns the version).

### D4. Guard test pattern: source-grep, not runtime check

Mirror `packages/shared/src/__tests__/no-direct-process-kill.test.ts`. New file `packages/extension/src/__tests__/no-session-replacement-calls.test.ts` scans `packages/extension/src/` (excluding `__tests__/`) for the literal patterns `pi.newSession(`, `ctx.fork(`, `ctx.switchSession(`. If any are found, fail with file:line. Three reasons:
- The contract is "we don't call these"; runtime mocks would have to invent fake replacement events.
- It's symmetric with the project's existing lint-style tests.
- It costs ~30 lines and runs in <100ms.

### D5. Document the invariant in the `bridge-extension` spec, not a new spec

Adding a `### Requirement: Bridge does not call session replacement APIs` under that capability's `## ADDED Requirements` keeps it co-located with the rest of the bridge contract. A separate capability would be over-decomposition for one rule.

### D6. Offline-package version source of truth

`packages/electron/offline-packages.json` is read at build time by `bundle-offline-packages.sh`. We bump it in lockstep with `piCompatibility.recommended` so the bundled cache and the upgrade hint agree. No script change needed; the existing `BUNDLE_OFFLINE_PACKAGES=1` flow picks up the new version on next release build.

## Risks / Trade-offs

- **[Risk] Users on pi `< 0.70.0` suddenly see a 503-blocking banner.** → Mitigation: project policy is to not maintain backward compatibility for older pi; the banner already includes a Retry/Upgrade affordance, and `pi-dashboard upgrade-pi` runs the bootstrap install in-place. Accepted.
- **[Risk] `import { Type } from "typebox"` resolves to a different schema shape than `@sinclair/typebox`.** → Mitigation: TypeBox 1.x preserves `Type.*` factory signatures (the changelog explicitly calls out this is a *path*, not API, migration). Existing `ask-user-tool.test.ts` covers schema construction; we re-run it after the swap.
- **[Risk] The grep-based guard test gives false positives on comments / strings mentioning `ctx.fork(`.** → Mitigation: skip lines beginning with `//` or inside template strings is unnecessary at this volume; if it triggers, add a directory-level allowlist comment marker (`// ALLOW-SESSION-REPLACEMENT`) like the kill-process test does.
- **[Trade-off] We aren't adopting `withSession`.** → If pi's runtime ever starts emitting "stale ctx" errors against our bridge, we'll need it. For now, `session_start` re-capture works because we never originate the replacement.

## Migration Plan

1. Edit `piCompatibility` block in `packages/server/package.json` (`minimum: "0.70.0"`, `recommended: "0.70.0"`, `maximum: null`).
2. Edit version pin in `packages/electron/offline-packages.json`.
3. Replace one import in `packages/extension/src/ask-user-tool.ts` and its mock in `packages/extension/src/__tests__/ask-user-tool.test.ts`.
4. Add `packages/extension/src/__tests__/no-session-replacement-calls.test.ts`.
5. Update spec deltas under `openspec/changes/pi-zero-seventy-compat/specs/`.
6. Update AGENTS.md / README.md / docs/architecture.md prose.
7. Run `npm test` (full suite) — must stay green.
8. `npm run build && curl -X POST http://localhost:8000/api/restart && npm run reload`.

**Rollback**: revert the commit. `piCompatibility` change is purely declarative; offline-packages bump only affects the *next* installer build, not deployed clients; the import swap and new test are isolated.
