## Context

The dashboard server has two independent security layers for non-loopback requests:

1. **`localhostGuard`** — a Fastify `preHandler` on ~30 sensitive routes that returns 403 for non-`127.0.0.1` IPs. It is a stateless function with no config access.
2. **Auth plugin `onRequest` hook** — a global hook (only registered when `auth` is configured) that checks JWT cookies. It has its own `bypassHosts` list under `auth.bypassHosts`.

These layers are disconnected in two ways:

1. **Trusted networks**: `bypassHosts` only affects the auth hook, not `localhostGuard`. A trusted LAN IP passes auth but still gets 403 on every protected route.
2. **Authenticated remote users**: When a user authenticates via OAuth and has a valid JWT, the `onRequest` auth hook passes, but `localhostGuard` still blocks with 403 in the subsequent `preHandler` phase. An authenticated user can load the UI but can't interact with any protected route.

Note: Zrok tunnel connections work today because zrok proxies to `localhost:PORT`, so the server sees `127.0.0.1` — both layers pass. But direct LAN or port-forwarded connections hit both problems.

The `isBypassedHost()` function (CIDR, wildcard, exact match) already exists in `auth-plugin.ts` but is inaccessible to the guard.

## Goals / Non-Goals

**Goals:**
- Trusted network IPs bypass both `localhostGuard` and the auth hook via a single config field
- Authenticated remote users (valid JWT) pass through `localhostGuard` on protected routes
- Auto-detect local network interfaces so users can add them with one click
- Backward compatible: existing `auth.bypassHosts` keeps working

**Non-Goals:**
- Per-route trust granularity (all routes trust the same networks)
- New authentication providers (OAuth setup already exists)
- IPv6 CIDR support (existing `isBypassedHost` is IPv4-only; no change)
- Changing zrok behavior (loopback bypass is existing and acceptable)

## Decisions

### 1. Top-level `trustedNetworks` field merged with `auth.bypassHosts`

**Decision**: Add `trustedNetworks: string[]` as a top-level config field. At load time, merge it with `auth.bypassHosts` into a single resolved list used by both layers.

**Rationale**: Trusted-network access is orthogonal to OAuth. Users shouldn't need to configure `auth` just to access from their phone on the same WiFi. A top-level field is discoverable and simple. Merging preserves backward compat for anyone already using `auth.bypassHosts`.

**Alternative considered**: Keep it under `auth` only → rejected because it forces auth config setup for a non-auth feature.

### 2. Extract `isBypassedHost` to `localhost-guard.ts`

**Decision**: Move `isBypassedHost()`, `matchCidr()`, and `ipToNum()` from `auth-plugin.ts` to `localhost-guard.ts`. Export `isBypassedHost` from there. `auth-plugin.ts` re-imports it.

**Rationale**: The guard needs CIDR matching. Putting it in `localhost-guard.ts` keeps network-related logic together and avoids a new file. No circular dependency risk since `auth-plugin.ts` already imports from `localhost-guard.ts`.

**Alternative considered**: New `network-utils.ts` → rejected as unnecessary; `localhost-guard.ts` is the natural home.

### 3. Factory function for the guard

**Decision**: Add `createNetworkGuard(trustedNetworks: string[])` that returns a Fastify `preHandler`. It checks three paths in order:
1. `isLoopback(ip)` → allow
2. `isBypassedHost(ip, trustedNetworks)` → allow
3. `request.isAuthenticated` (set by auth `onRequest` hook) → allow
4. else → 403

The old `localhostGuard` export is kept as a fallback (localhost-only, no config).

**Rationale**: The guard needs to respect both network trust and authentication. Fastify's lifecycle guarantees `onRequest` runs before `preHandler`, so `request.isAuthenticated` is always set before the guard checks it. Keeping the old export avoids breaking anything that doesn't go through deps.

**Alternative considered**: Have the guard do its own JWT validation → rejected because it duplicates auth logic and diverges from the single source of truth in the auth plugin.

### 3b. Auth hook tags authenticated requests via `decorateRequest`

**Decision**: The auth plugin uses `fastify.decorateRequest('isAuthenticated', false)` at registration time. The `onRequest` hook sets `request.isAuthenticated = true` when a valid JWT is verified. When auth is not configured, `server.ts` registers the decorator with `false` default so the guard can safely read it regardless.

**Rationale**: `decorateRequest` is Fastify's official mechanism for cross-hook state. It's type-safe, performs well (no dynamic property assignment), and makes the coupling between auth and guard explicit.

### 4. Thread guard via route deps

**Decision**: Add `networkGuard: FastifyPreHandler` to `RouteDeps`. Each route file receives it via deps instead of importing `localhostGuard` directly. `server.ts` creates the guard and passes it.

**Rationale**: Minimal change per route file — swap the import for a destructure from deps. Already an established pattern (`RouteDeps` exists).

### 5. `GET /api/network-interfaces` endpoint

**Decision**: New localhost-only endpoint in `system-routes.ts` that calls `os.networkInterfaces()`, filters to non-internal IPv4 entries, and returns `[{name, address, netmask, cidr}]`. The CIDR is computed from the netmask (count leading 1-bits).

**Rationale**: The client needs to show a dropdown of available networks. Computing CIDRs server-side avoids duplicating netmask math in the browser.

### 6. Settings UI: inline section with dropdown

**Decision**: Add a "Trusted Networks" section in `SettingsPanel.tsx` between existing sections. Shows current entries as chips with ✕ remove. "Add Local Network" button opens a dropdown populated from `/api/network-interfaces`. Includes a static warning about security. Saves via the existing config write mechanism.

**Rationale**: Inline section is consistent with the rest of SettingsPanel. Dropdown avoids manual CIDR typing errors.

## Risks / Trade-offs

- **No per-request auth for trusted networks** → Anyone on the trusted subnet has full control. Mitigated by warning text and the fact that this is opt-in.
- **Config merge complexity** → `trustedNetworks` + `auth.bypassHosts` could lead to confusion about where to configure. Mitigated by documenting the merge and showing the unified list in Settings UI.
- **IPv4 only** → `isBypassedHost` doesn't handle IPv6 CIDRs. Acceptable since LAN access is overwhelmingly IPv4.
- **Guard created at startup** → Config changes to `trustedNetworks` require server restart (or a reload mechanism). Acceptable since config writes already trigger restart via `/api/restart`.
- **Hook ordering dependency** → The guard reads `request.isAuthenticated` set by the auth `onRequest` hook. Fastify guarantees `onRequest` before `preHandler`, but this is an implicit coupling. Mitigated by documenting the dependency and registering the decorator in `server.ts` so it exists even without auth.
- **Zrok auth bypass** → Zrok connections appear as localhost, bypassing both auth and the guard. This is existing behavior — the zrok URL effectively acts as a shared secret. Not changed by this proposal.
- **mDNS discovery UX gap** → Without this change, mDNS advertises servers that the browser can discover but not actually use (health probe passes, all API calls get 403). With trusted networks configured, mDNS-discovered LAN peers become fully functional. With auth configured, authenticated users can switch to any reachable server.
