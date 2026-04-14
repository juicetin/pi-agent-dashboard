# Trusted Networks

## Problem

The dashboard binds on `0.0.0.0` but `localhostGuard` rejects all non-loopback IPs with 403 on every sensitive route (sessions, files, git, editors, system). Two issues:

1. **Trusted LAN blocked**: The existing `auth.bypassHosts` config only skips the auth hook — it has no effect on `localhostGuard`. Users on a trusted LAN get 403 on all protected routes.
2. **Authenticated remote users blocked**: Even when auth is configured and a user has a valid JWT (e.g. via OAuth), `localhostGuard` still returns 403 because it runs as a `preHandler` after the auth `onRequest` hook passes. An authenticated user can load the UI but can't send prompts, browse files, or do anything useful.

Note: Zrok tunnel connections work today because zrok proxies to `localhost`, so the server sees `127.0.0.1`. But direct LAN or port-forwarded connections are broken for both scenarios above.

3. **mDNS discovery is misleading**: The server advertises itself via mDNS (`_pi-dashboard._tcp`) and the browser's ServerSelector shows discovered peers as "Available" (the `/api/health` probe succeeds since it has no `localhostGuard`). But when a user switches to a remote server, all API calls fail with 403. The mDNS discovery works correctly — the access control is the bottleneck.

## Solution

1. Add a top-level `trustedNetworks` config field (merged with `auth.bypassHosts` for backward compat). Make `localhostGuard` network-aware so trusted IPs pass through.
2. Have the auth `onRequest` hook tag authenticated requests (via Fastify `decorateRequest`), so the network guard can also allow authenticated users through — not just loopback and trusted IPs.
3. Add a Settings UI section with an "Add Local Network" button that auto-detects local interfaces and their CIDRs.

The guard logic becomes:
```
if loopback → allow
if trusted network → allow
if request was authenticated (tagged by auth hook) → allow
else → 403
```

## Scope

### In scope
- Top-level `trustedNetworks: string[]` config field (CIDR, wildcard, exact IP)
- `localhostGuard` → config-aware factory that checks loopback OR trusted network OR authenticated
- Thread the new guard through all route files that use it
- Auth `onRequest` hook sets `request.isAuthenticated = true` via `decorateRequest` when JWT is valid
- WebSocket upgrade check also respects trusted networks
- Auth plugin reads merged trusted networks (top-level + `auth.bypassHosts`)
- Extract `isBypassedHost()` from `auth-plugin.ts` to shared location (avoid circular deps)
- `GET /api/network-interfaces` endpoint (localhost-only) returning detected interfaces with CIDRs
- Settings UI: "Trusted Networks" section with list, remove, add-from-dropdown, warning text

### Out of scope
- OAuth / authentication setup (already exists)
- Tunnel changes (zrok already works via loopback)
- Per-route granularity (all-or-nothing trust)

## Files impacted

| File | Change |
|------|--------|
| `src/shared/config.ts` | Add `trustedNetworks` field, parse + merge with `auth.bypassHosts` |
| `src/server/localhost-guard.ts` | Add `createNetworkGuard(trustedNetworks)` factory, move `isBypassedHost` here |
| `src/server/auth-plugin.ts` | Import `isBypassedHost` from localhost-guard; `decorateRequest` to tag authenticated requests; read merged trusted networks |
| `src/server/server.ts` | Create guard from config, pass to routes, use in WS upgrade; register `isAuthenticated` request decorator |
| `src/server/routes/session-routes.ts` | Accept guard from deps instead of importing `localhostGuard` |
| `src/server/routes/file-routes.ts` | Same |
| `src/server/routes/git-routes.ts` | Same |
| `src/server/routes/editor-routes.ts` | Same |
| `src/server/routes/system-routes.ts` | Same |
| `src/server/routes/provider-routes.ts` | Same |
| `src/server/routes/openspec-routes.ts` | Same |
| `src/server/routes/route-deps.ts` | Add `networkGuard` to `RouteDeps` type |
| `src/server/config-api.ts` | Expose `trustedNetworks` in read/write |
| `src/client/components/SettingsPanel.tsx` | New "Trusted Networks" section with dropdown |
| `src/shared/rest-api.ts` | Add `NetworkInterface` type |

## Risk

- **Security**: Trusted networks have full access without auth — warning text in Settings UI is the only guardrail. Acceptable for private LANs.
- **Backward compat**: `auth.bypassHosts` keeps working via merge — no breaking change.
- **Zrok auth bypass**: Zrok connections appear as localhost, so auth is bypassed entirely. This is existing behavior (not introduced by this change) and acceptable since the zrok URL acts as a shared secret.
- **Hook ordering dependency**: The guard relies on `isAuthenticated` being set by the auth `onRequest` hook which runs before `preHandler`. This is guaranteed by Fastify's lifecycle but is an implicit coupling worth documenting.
- **mDNS + trusted networks synergy**: Once trusted networks are configured, mDNS-discovered servers on the same LAN become fully usable — the ServerSelector "switch server" flow works end-to-end. Without trusted networks (or auth), mDNS discovery is cosmetic only.
- **Pi gateway (port 9999) is unprotected**: The bridge extension WebSocket gateway has no access control — any device on the network can connect. This is pre-existing and out of scope for this change, but worth noting as a related security gap.
