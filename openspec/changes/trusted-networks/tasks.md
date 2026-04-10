## 1. Extract network utilities

- [x] 1.1 Move `isBypassedHost()`, `matchCidr()`, `ipToNum()` from `auth-plugin.ts` to `localhost-guard.ts` and export `isBypassedHost`
- [x] 1.2 Update `auth-plugin.ts` to import `isBypassedHost` from `localhost-guard.ts`
- [x] 1.3 Add tests for `isBypassedHost` in localhost-guard (CIDR, wildcard, exact match)

## 2. Config changes

- [x] 2.1 Add `trustedNetworks: string[]` field to `DashboardConfig` in `src/shared/config.ts` with empty array default
- [x] 2.2 Add `resolvedTrustedNetworks: string[]` computed field that merges `trustedNetworks` with `auth.bypassHosts` (deduplicated)
- [x] 2.3 Parse `trustedNetworks` in `loadConfig()`
- [x] 2.4 Add tests for config parsing and merge logic

## 3. Auth request decorator

- [x] 3.1 In `auth-plugin.ts`, add `fastify.decorateRequest('isAuthenticated', false)` at plugin registration
- [x] 3.2 In auth `onRequest` hook, set `request.isAuthenticated = true` when JWT is valid
- [x] 3.3 In `server.ts`, register `decorateRequest('isAuthenticated', false)` when auth is NOT configured (so guard can always read it)

## 4. Network guard factory

- [x] 4.1 Add `createNetworkGuard(trustedNetworks: string[])` to `localhost-guard.ts` returning a Fastify preHandler
- [x] 4.2 Guard allows loopback OR trusted network OR `request.isAuthenticated`, else 403
- [x] 4.3 Add tests for `createNetworkGuard` (loopback, trusted, authenticated, blocked)

## 5. Thread guard through routes

- [x] 5.1 Add `networkGuard` field to `RouteDeps` in `route-deps.ts`
- [x] 5.2 Create guard from `resolvedTrustedNetworks` in `server.ts` and pass via deps
- [x] 5.3 Update `session-routes.ts` to use `deps.networkGuard` instead of imported `localhostGuard`
- [x] 5.4 Update `file-routes.ts` same
- [x] 5.5 Update `git-routes.ts` same
- [x] 5.6 Update `editor-routes.ts` same
- [x] 5.7 Update `system-routes.ts` same
- [x] 5.8 Update `provider-routes.ts` same
- [x] 5.9 Update `openspec-routes.ts` same

## 6. WebSocket upgrade

- [x] 6.1 Update `validateWsUpgrade` to accept `trustedNetworks` parameter and check it
- [x] 6.2 Pass `resolvedTrustedNetworks` to WS upgrade check in `server.ts`

## 7. Auth plugin integration

- [x] 7.1 Update auth plugin `onRequest` hook to use `resolvedTrustedNetworks` from top-level config instead of only `auth.bypassHosts`

## 8. Network interfaces endpoint

- [x] 8.1 Add netmask-to-CIDR helper and network address computation in `localhost-guard.ts`
- [x] 8.2 Add `GET /api/network-interfaces` endpoint in `system-routes.ts` (localhost-only, returns `[{name, address, netmask, cidr}]`)
- [x] 8.3 Add `NetworkInterface` type to `src/shared/rest-api.ts`
- [x] 8.4 Add tests for netmask-to-CIDR conversion

## 9. Config API

- [x] 9.1 Expose `trustedNetworks` in `readConfigRedacted()` and `writeConfig()` in `config-api.ts`

## 10. Settings UI

- [x] 10.1 Add `trustedNetworks` field to the `Config` interface in `SettingsPanel.tsx`
- [x] 10.2 Add "Trusted Networks" section with list of current entries and ✕ remove buttons
- [x] 10.3 Add "Add Local Network" button that fetches `/api/network-interfaces` and shows dropdown
- [x] 10.4 Implement duplicate prevention when adding entries
- [x] 10.5 Add security warning text
