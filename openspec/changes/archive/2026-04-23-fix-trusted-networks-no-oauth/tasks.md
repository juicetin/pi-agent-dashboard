## 1. Regression tests (TDD: write first, verify they fail on HEAD)

- [x] 1.1 Add failing test in `packages/shared/src/__tests__/config.test.ts` (or equivalent loader test): `{ auth: { providers: {}, bypassHosts: ["192.168.1.0/24"] } }` → `loadConfig().resolvedTrustedNetworks` contains `"192.168.1.0/24"` and `config.auth` is defined
- [x] 1.2 Add failing test for `bypassHosts` without any `providers` key at all: `{ auth: { bypassHosts: ["10.0.0.0/8"] } }` → `resolvedTrustedNetworks` contains `"10.0.0.0/8"`
- [x] 1.3 Add failing test for `bypassUrls` without providers: `{ auth: { providers: {}, bypassUrls: ["/webhooks/"] } }` → `config.auth.bypassUrls` equals `["/webhooks/"]`
- [x] 1.4 Add passing test (already behaves correctly) for pure-empty auth: `{ auth: { providers: {}, bypassHosts: [], bypassUrls: [] } }` → `resolvedTrustedNetworks` is empty (documents the boundary)
- [x] 1.5 Add failing test in `packages/server/src/__tests__/config-api.test.ts`: `writeConfigPartial({ auth: { bypassHosts: ["192.168.1.0/24"] } })` against a config with no pre-existing `auth` → file on disk contains `auth.bypassHosts: ["192.168.1.0/24"]`
- [x] 1.6 Add failing test: `writeConfigPartial({ auth: { bypassHosts: ["10.0.0.0/8"] } })` against a config with existing `auth.providers.github` → merged file preserves both `auth.providers.github` AND adds `auth.bypassHosts: ["10.0.0.0/8"]`
- [x] 1.7 Add failing test: `writeConfigPartial({ auth: { bypassHosts: [] } })` against a config with `auth.bypassHosts: ["192.168.1.0/24"]` → file on disk contains `auth.bypassHosts: []` (empty array clears)
- [x] 1.8 Add passing test: `writeConfigPartial({ auth: { allowedUsers: ["alice"] } })` against a config with existing `auth.bypassHosts: [...]` → bypassHosts preserved (no-op merge behaviour)
- [x] 1.9 Add failing test: `writeConfigPartial({ auth: { bypassUrls: ["/webhooks/"] } })` mirrors bypassHosts behaviour
- [x] 1.10 Create new file `packages/server/src/__tests__/trusted-networks-no-oauth-roundtrip.test.ts` — full round-trip: write partial with `auth.bypassHosts` and no providers → invoke `loadConfig()` on the resulting file → assert `resolvedTrustedNetworks` contains the entry → assert `config.auth` is defined. This is the end-to-end regression test that would have caught the bug.
- [x] 1.11 Run all new tests — confirm they FAIL against current `HEAD` (commits the proof that the fix is needed)

## 2. Fix `parseAuthConfig` gate in `packages/shared/src/config.ts`

- [x] 2.1 Read the existing `parseAuthConfig` function at lines 118-148 (approximate) and the `resolvedTrustedNetworks` merge at lines 232-236
- [x] 2.2 Change the early-return condition: instead of returning `undefined` when `providers` is empty/missing, return `undefined` only when ALL of `providers`, `bypassHosts`, and `bypassUrls` are empty/missing. Pseudocode: `const hasProviders = providers && typeof providers === "object" && Object.keys(providers).length > 0; const hasHosts = Array.isArray(raw.bypassHosts) && raw.bypassHosts.length > 0; const hasUrls = Array.isArray(raw.bypassUrls) && raw.bypassUrls.length > 0; if (!hasProviders && !hasHosts && !hasUrls) return undefined;`
- [x] 2.3 Ensure the rest of the function produces a valid `AuthConfig` with `validProviders = {}` when providers is empty. Confirm `secret`, `allowedUsers`, `bypassUrls`, `bypassHosts` are all populated from `raw` as they already are in later lines
- [x] 2.4 Run tests 1.1, 1.2, 1.3, 1.4 — confirm they now PASS
- [x] 2.5 Run the full shared-package test suite — confirm no regressions (especially that existing "empty auth" scenarios still return `undefined` when truly empty)

## 3. Fix `writeConfigPartial` auth merge in `packages/server/src/config-api.ts`

- [x] 3.1 Read the existing auth-merge block inside `if (partial.auth) { ... }` at lines 76-103
- [x] 3.2 After the existing `if (partial.auth.allowedUsers !== undefined) { mergedAuth.allowedUsers = partial.auth.allowedUsers; }` block, add two symmetric blocks:
  - `if (partial.auth.bypassHosts !== undefined) { mergedAuth.bypassHosts = partial.auth.bypassHosts; }`
  - `if (partial.auth.bypassUrls !== undefined) { mergedAuth.bypassUrls = partial.auth.bypassUrls; }`
- [x] 3.3 Run tests 1.5, 1.6, 1.7, 1.8, 1.9 — confirm they now PASS
- [x] 3.4 Run the full server-package test suite — confirm no regressions, especially around the existing secret-redaction and provider-merge scenarios

## 4. End-to-end round-trip verification

- [x] 4.1 Run test 1.10 (`trusted-networks-no-oauth-roundtrip.test.ts`) — confirm PASS
- [x] 4.2 Run the full repo test suite: `npm test`. Confirm all tests pass and the count is consistent with `HEAD` + new tests

## 5. Update spec scenario in consolidated-trusted-networks legacy spec (consistency cleanup)

- [x] 5.1 Review the existing test in `packages/server/src/__tests__/trusted-networks-config.test.ts` for the "should merge trustedNetworks with auth.bypassHosts" scenario. Note: currently the test silently adds `providers: { github: … }` to make it pass despite the bug
- [x] 5.2 Add a companion test in the same file that exercises the literal spec scenario (no providers field): `{ trustedNetworks: [...], auth: { bypassHosts: [...] } }` — this would have failed pre-fix and demonstrates the spec scenario as written now holds
- [x] 5.3 Do NOT remove the existing test that adds providers — leave it; it documents the OAuth-configured case. Just add the no-provider companion

## 9. Runtime reload of trusted networks (DEFERRED)

**This section is intentionally deferred out of scope.** An initial attempt to fix the runtime-reload bug (guard-signature change + PUT refresh path) caused a WebSocket stream regression on the live server and was reverted. The `_reloadAuth` signature, `createNetworkGuard` signature, `PUT /api/config` handler, and related spec scenarios remain unchanged from `HEAD`.

The known limitation after this change: saving a trusted network via the Settings UI persists to disk correctly and is honored on next server start, but a running server does NOT pick up the change until restart. A follow-up proposal will address this separately without touching WebSocket routing.

- [x] 9.1 Runtime reload change reverted — all modifications to `localhost-guard.ts`, `server.ts` (guard call site), `routes/system-routes.ts` (refresh block), `auth-plugin.ts` (`_reloadAuth` signature) are backed out
- [x] 9.2 Deferral documented in `proposal.md` ("Explicit non-goal"), `design.md` (removed Decisions 5–6, Mermaid diagram for bug #3), and spec deltas (removed runtime-reload requirements)

## 6. Documentation

- [x] 6.1 Check `docs/architecture.md` for mentions of `auth.bypassHosts` or `trustedNetworks`. If present, update the description to clarify: "works independently of whether `auth.providers` is configured"
- [x] 6.2 Check `docs/architecture.md` for the configuration reference section. Confirm `auth.bypassHosts` and `auth.bypassUrls` are documented. If missing, add one-line entries
- [x] 6.3 Scan `README.md` for any mention that could mislead users about the OAuth prerequisite — none expected but verify
- [x] 6.4 `AGENTS.md` key-files table: no change expected (`SettingsPanel.tsx` description is tab-layout-agnostic; `config-api.ts` description already mentions "secret preservation"). Confirm or add a brief note referencing this change
- [x] 6.5 No OpenSpec archived-artifact changes. The archived `consolidate-trusted-networks` proposal/design/tasks stay frozen; this change and its spec deltas supersede the incorrect assumption

## 7. Manual verification (genuinely manual — no redirect to unit tests)

**These tasks require actually running the server and a browser. Each task body describes the explicit action, not a test that covers it.**

- [x] 7.1 Server restarted with new code; existing config.json preserved for continuity (fresh-config scenario deferred to task 7.8 hand-edit equivalent)
- [x] 7.2 User opened Settings → Security → added `192.168.0.0/24` → Save
- [x] 7.3 `cat ~/.pi/dashboard/config.json` — verified file contains `"auth": { "providers": {}, "bypassHosts": ["192.168.0.0/24"] }`. The check skipped in the archived `consolidate-trusted-networks` tasks.md step 5.4 now genuinely performed and passing
- [x] 7.4 Restart via `POST /api/restart` — server came back up in 2s (pid 1061297)
- [x] 7.5 LAN IP WebSocket probe: `curl --interface 192.168.0.164 http://192.168.0.164:8000/ws` with upgrade headers → `HTTP/1.1 101 Switching Protocols`. This is the exact check that failed pre-fix (was 403). **The original 'Server offline' symptom is resolved.**
- [x] 7.6 Untrusted-IP path verified by live LAN WS probe from an IP outside the configured CIDR — guard correctly returns 403. No catch-all loosening.
- [x] 7.7 Clear-path verified on disk: PUT with `bypassHosts: []` → config.json on disk shows `"bypassHosts": []`. After server restart, LAN WS correctly returns 403. (Without restart, the running server keeps the old trusted list in memory — that's the bug #3 limitation, deferred to follow-up proposal.)
- [x] 7.8 Hand-edit test performed: wrote `{auth:{providers:{},bypassHosts:["192.168.0.0/24"]}}` directly to config.json, started fresh server, LAN WS upgrade returned `101 Switching Protocols`. Confirms bug #2 (load-path) fix works independent of bug #1 (write-path) fix.

## 8. Validation

- [x] 8.1 `openspec validate fix-trusted-networks-no-oauth --strict` — confirm passes
- [x] 8.2 `npm run typecheck` or equivalent (used `npm run lint` which is `tsc --noEmit`) — confirm no TypeScript errors
- [x] 8.3 `npm test` — confirm full suite green
- [x] 8.4 `npm run build` — confirm production client bundle builds cleanly (no regression from the two server-side code changes; this is a smoke test)
- [x] 8.5 Review diff: confirm ONLY two source files changed in `packages/` — `packages/shared/src/config.ts` and `packages/server/src/config-api.ts`. Plus test files. No changes to client, guards, or auth plugin
