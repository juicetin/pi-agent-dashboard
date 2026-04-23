## Why

After `consolidate-trusted-networks` (archived 2026-04-21, commit `eb24780`) repointed the Settings UI from top-level `config.trustedNetworks` to `config.auth.bypassHosts`, users **without OAuth configured** can no longer reach the dashboard from trusted networks: entries added via the UI never reach disk, and even if hand-written, are discarded at load time. The WebSocket upgrade guard 403s every remote connection, surfacing in the client as a generic "Server offline" banner.

Three pre-existing dormant bugs were activated by the consolidation:

1. **`writeConfigPartial` drops `bypassHosts` / `bypassUrls`** — the auth-section merge in `packages/server/src/config-api.ts` copies only `secret`, `providers`, `allowedUsers`. `bypassHosts` was never wired through, so every UI save silently loses the entry.
2. **`parseAuthConfig` returns `undefined` when `providers == {}`** — in `packages/shared/src/config.ts`, the whole `auth` block is nuked before the `resolvedTrustedNetworks` merge can read `auth.bypassHosts`. Hand-edited configs without an OAuth provider are therefore ignored.
3. **`PUT /api/config` does not refresh `config.resolvedTrustedNetworks` at runtime** — `packages/server/src/routes/system-routes.ts` updates only `config.authConfig` after a successful write. The network guard (`createNetworkGuard`) closes over the initial snapshot passed at server boot, and the WS-upgrade handler reads `config.resolvedTrustedNetworks` directly from the mutable config object that `PUT /api/config` never writes to. A user who adds a trusted network via the UI saves it to disk but the in-memory guard keeps blocking them until the next full server restart. This surfaced during manual verification of bugs #1 and #2 — with the disk-persistence fixed, the LAN curl probe still got 403 on `/ws` until `POST /api/restart`.

Both conditions hold precisely for the population the UI change just pushed onto the `auth.bypassHosts` path: users who wanted trusted-network access without OAuth. The consolidation proposal documented "no server changes required" based on reading lines 232–235 of config.ts without verifying the adjacent `parseAuthConfig` gate or the `writeConfigPartial` auth-merge block.

The OpenSpec artifacts for `consolidate-trusted-networks` also encoded the false assumption: the `trusted-networks` spec's "merged with auth.bypassHosts" scenario omits `providers`, but the matching test silently adds one to make it pass. No spec scenario or test exercises the `bypassHosts`-without-OAuth configuration — the exact shape the UI now writes.

## What Changes

- **Fix persistence**: extend `writeConfigPartial`'s auth-merge block in `packages/server/src/config-api.ts` to propagate `bypassHosts` and `bypassUrls` from the incoming partial to the merged output, mirroring the existing `allowedUsers` block.
- **Fix load-time gating**: relax `parseAuthConfig` in `packages/shared/src/config.ts` so it returns a valid `AuthConfig` when `bypassHosts` or `bypassUrls` are populated, even if `providers` is empty. The returned object uses an empty `validProviders` map; the auth plugin already no-ops its OAuth registration when the provider registry is empty, so no OAuth flow is activated accidentally.
- **Explicit non-goal — runtime reload:** an initial attempt to also refresh `resolvedTrustedNetworks` in-memory on `PUT /api/config` (so the UI Save would apply without restart) caused a live WebSocket stream regression and was reverted. After this change, users still need to restart the dashboard after saving a trusted network for it to take effect, but the save now actually persists and the loader actually honors it. Runtime reload is deferred to a follow-up proposal.
- **Add missing spec scenarios** in `trusted-networks` and `settings-panel` that assert the bypassHosts-without-OAuth configuration survives the write → disk → load (after restart) → guard round-trip. These scenarios are written so they would have failed against the buggy code — verifying they now pass demonstrates the fix.
- **Add an end-to-end regression test** that writes `{ auth: { providers: {}, bypassHosts: [...] } }` through `PUT /api/config`, re-reads the file via `loadConfig()`, and asserts `resolvedTrustedNetworks` contains the entry. Closes the test-coverage gap that let the bugs ship.
- **Document the OpenSpec verification discipline failure** in `design.md` as a lessons-learned section. No process-level artifact change in this proposal — keeping scope tight — but the design doc names the specific checkboxes that were marked done without being performed, for future reviewers.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `trusted-networks`: Add a scenario asserting that `auth.bypassHosts` is honored at load time when `auth.providers` is empty. Add a WebSocket-upgrade scenario for the same no-OAuth + bypassHosts-only configuration. Existing scenarios remain unchanged.
- `settings-panel`: Add a scenario under "Config write endpoint" asserting that `PUT /api/config` with `{ auth: { bypassHosts: [...] } }` persists the entry to `~/.pi/dashboard/config.json` and a subsequent `GET /api/config` surfaces it. Existing scenarios remain unchanged.

## Impact

- **Code**:
  - `packages/server/src/config-api.ts` — ~4 lines added inside the existing auth-merge block (two conditional copies for `bypassHosts` and `bypassUrls`).
  - `packages/shared/src/config.ts` — `parseAuthConfig` short-circuit loosened from "providers required" to "providers OR bypassHosts OR bypassUrls required".
  - No changes to the client, the network guard, the auth plugin, the WS upgrade handler, the pi-gateway, or any routing layer.
- **Tests**:
  - `packages/server/src/__tests__/trusted-networks-config.test.ts` — add cases for `bypassHosts` without providers.
  - `packages/server/src/__tests__/config-api.test.ts` — add cases asserting `writeConfigPartial` preserves `bypassHosts` and `bypassUrls` through the auth merge.
  - New test file `packages/server/src/__tests__/trusted-networks-no-oauth-roundtrip.test.ts` — round-trips a bypassHosts-only auth config through write + reload and asserts `resolvedTrustedNetworks` contains the entry.
- **Config**: No schema change. Existing configs continue to load identically; the only behavioural difference is that configs with `auth.providers == {}` but populated `auth.bypassHosts` now work as the UI already assumes.
- **Docs**: Update `docs/architecture.md` if its Configuration Reference section documents `auth.bypassHosts` or `trustedNetworks` — clarify that `auth.bypassHosts` works without OAuth configured. No changes to `README.md` or `AGENTS.md` expected.
- **UX**: Users who added trusted networks via the Settings UI and saw "Server offline" from a remote browser will have working access after running the fix, without re-saving. Hand-edited configs with `auth.bypassHosts` and no OAuth providers start working on next restart.
- **Rollback**: Two small, reversible code diffs. No config migration, no data changes. Reverting restores the broken behaviour.
