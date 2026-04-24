## Why

Upstream `@mariozechner/pi-coding-agent` has shipped 0.69.0 and 0.70.0 with two changes that affect us directly: (a) the TypeBox 1.x migration deprecates the `@sinclair/typebox` import path our `ask-user-tool.ts` still uses (the alias works today but is explicitly called out as legacy), and (b) the 0.69 session-replacement contract now invalidates captured `pi`/`ctx`/session-bound objects after `newSession`/`fork`/`switchSession`, while our bridge holds long-lived `cachedCtx` / `cachedModelRegistry` references. We also still pin `piCompatibility.recommended` to `0.6.7` (off by ~64 minor versions), which makes the version-skew banner meaningless.

## What Changes

- Bump `packages/server/package.json` `piCompatibility` to `{minimum: "0.70.0", recommended: "0.70.0", maximum: null}` (we explicitly do NOT support older pi versions; minimum lockstep with recommended).
- Migrating to `typebox` requires pi ≥ 0.69 in the dep graph; pinning min to 0.70 makes that legal and removes the need for a backward-compat shim.
- Bump the managed-install pin in `packages/electron/offline-packages.json` (and any matching install manifest) to `pi-coding-agent@0.70.0`.
- Migrate `packages/extension/src/ask-user-tool.ts` and its test from `@sinclair/typebox` → `typebox`.
- Document and verify the captured-ctx invariant: bridge MUST NOT call `pi.newSession()` / `ctx.fork()` / `ctx.switchSession()` itself, and MUST treat `cachedCtx` / `cachedModelRegistry` / `cachedHasUI` as session-scoped (re-captured in every `session_start`, never read after `session_shutdown`).
- Add a regression test that fails if the bridge ever calls those replacement APIs directly.
- Update AGENTS.md / README.md / docs/architecture.md to reflect the new pi version floor.
- **Non-goals**: no use of new 0.69/0.70 features (`addAutocompleteProvider`, `setWorkingIndicator`, `terminate: true`, `withSession`, `/clone`); no behavior change to bridge runtime.

## Capabilities

### New Capabilities
*(none — this is a compatibility/maintenance change)*

### Modified Capabilities
- `pi-core-version-check`: update the documented recommended/minimum pi version range surfaced through `piCompatibility`.
- `bridge-extension`: add the explicit "no captured-ctx after session replacement" invariant and the regression-test guard that enforces no direct calls to `pi.newSession` / `ctx.fork` / `ctx.switchSession` from bridge code.
- `ask-user-tool`: switch the schema import from `@sinclair/typebox` to `typebox` (no behavior change; aligns with pi 0.69+ supported import path).

## Impact

- **Code touched**: `packages/server/package.json` (one block), `packages/electron/offline-packages.json` (version pin), `packages/extension/src/ask-user-tool.ts` + its test (one import line each), one new lint-style test under `packages/extension/src/__tests__/`.
- **Dependencies**: dev-side `typebox` (already transitively installed via pi 0.69+); no new runtime deps.
- **Docs**: AGENTS.md (key files table footnote on pi version), README.md (prereqs section), docs/architecture.md (version-skew section).
- **Risk**: low. Bumping `minimum` to 0.70.0 will surface the existing 503-blocking banner for any user still on ≤0.69.x — accepted, we don't carry backward compatibility. The TypeBox import swap to `typebox` is safe under that floor (pi 0.69+ ships TypeBox 1.x). The bridge-invariant test is non-functional (source grep). No data migration, no protocol change.
