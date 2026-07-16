# Tasks

## 1. Guard as a universal hook

- [ ] 1.1 Add a `networkGuardHook` (onRequest form) in `localhost-guard.ts` that reuses the same allow logic as `createNetworkGuard` (loopback / `resolvedTrustedNetworks` / `request.isAuthenticated`) plus the public-route allowlist check; deny → 403 with the existing `{ success:false, error:"network_not_allowed", reason, hint }` body.
- [ ] 1.2 Define the public-route allowlist (`/api/health`, `/manifest.json`, `PUBLIC_PAIRING_PREFIXES`, `/auth/*`, WS-ticket mint endpoint, static assets, configured `auth.bypassUrls`). Reuse `isBypassed` for the bypassUrls portion.
- [ ] 1.3 Register the hook in `server.ts` **after** `registerBearerAuth` and the conditional `registerAuthPlugin` (so `isAuthenticated` is already set) and **before** route registration, running regardless of `config.authConfig`.
- [ ] 1.4 Ensure `request.isAuthenticated` is always decorated with a `false` default even when auth is unconfigured (confirm existing decorator covers the no-auth path).

## 2. Verify coverage

- [ ] 2.1 Confirm plugin routes (automation/kb/flows), provider-auth routes, and `/v1/models` are now denied when untrusted+unauthenticated with auth off.
- [ ] 2.2 Keep existing per-route `preHandler: networkGuard` in place (defense-in-depth); confirm no double-response/error when both the hook and preHandler run.
- [ ] 2.3 Confirm WS upgrades still authenticate via `validateWsUpgrade` + ws-ticket (unchanged) and are not affected by the HTTP onRequest hook.

## 3. Observability

- [ ] 3.1 Emit a structured denial log (path, source IP, reason); assert no body/token in the line.

## Tests

- [ ] T1 Universal hook denies a non-allowlisted route from untrusted+unauthenticated IP with auth off (covers VD2): `POST /api/plugins/automation/create` → 403, no file written, no spawn.
- [ ] T2 provider-auth route denied with auth off: `PUT /api/provider-auth/api-key` → 403.
- [ ] T3 Allowlist passes: `/api/health`, `/manifest.json`, a `PUBLIC_PAIRING_PREFIXES` URL, `/auth/callback/:provider` → allowed unauthenticated.
- [ ] T4 Loopback allowed with auth off on a guarded route; trusted-network CIDR allowed; valid bearer/cookie allowed.
- [ ] T5 Non-allowlisted core route denied when per-route preHandler is removed but hook installed (proves hook is the real enforcer).
- [ ] T6 kb/flows plugin routes + `/v1/models` denied untrusted+unauthenticated.
- [ ] T7 Denial emits a log line with path+IP+reason and NO body/token.
- [ ] T8 Regression: existing trusted-networks + auth-bypass-url-list scenarios still pass (bypassUrls/bypassHosts honored without OAuth).

## Discipline checkpoints

- [ ] D1 `doubt-driven-review` on the public-route allowlist before merge — enumerate every currently-unauthenticated-by-design surface (PWA, pairing, OAuth, static, service worker) and prove none is locked out.
- [ ] D2 `scenario-design` matrix realized as tests T1–T8 (loopback · LAN trusted · tunnel authed · tunnel anon · plugin · health · manifest · pairing · OAuth callback · WS upgrade).
- [ ] D3 `security-hardening` STRIDE pass on the final hook (spoofed forwarding headers can't reach allowlisted-only bypass; deny-by-default holds).

## Validate

- [ ] V1 `openspec validate add-universal-network-guard --strict` passes.
- [ ] V2 `npm test` green (server auth/guard suites: `auth.test.ts`, `localhost-guard.test.ts`, `trusted-networks-config.test.ts`, `ws-upgrade-routing.test.ts`, `cors.test.ts`).
- [ ] V3 Manual: with auth off, over a tunnel (proxied headers), confirm `/api/plugins/automation/create` returns 403 and `/api/health` returns 200.
