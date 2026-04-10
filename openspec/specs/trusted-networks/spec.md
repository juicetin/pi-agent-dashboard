### Requirement: Top-level trustedNetworks config field
The config module SHALL support a top-level `trustedNetworks` field of type `string[]` in `~/.pi/dashboard/config.json`. Each entry SHALL be an IPv4 CIDR (e.g. `192.168.1.0/24`), wildcard (e.g. `10.0.0.*`), or exact IP address. The default SHALL be an empty array. At load time, the config module SHALL merge `trustedNetworks` with `auth.bypassHosts` (if present) into a single deduplicated list available as `resolvedTrustedNetworks` on the config object.

#### Scenario: trustedNetworks configured without auth
- **WHEN** config contains `{ "trustedNetworks": ["192.168.1.0/24"] }` and no `auth` section
- **THEN** `loadConfig()` SHALL return `trustedNetworks: ["192.168.1.0/24"]` and `resolvedTrustedNetworks: ["192.168.1.0/24"]`

#### Scenario: trustedNetworks merged with auth.bypassHosts
- **WHEN** config contains `{ "trustedNetworks": ["192.168.1.0/24"], "auth": { "bypassHosts": ["10.0.0.0/8"] } }`
- **THEN** `resolvedTrustedNetworks` SHALL contain both `192.168.1.0/24` and `10.0.0.0/8`

#### Scenario: Duplicate entries deduplicated
- **WHEN** both `trustedNetworks` and `auth.bypassHosts` contain `192.168.1.0/24`
- **THEN** `resolvedTrustedNetworks` SHALL contain the entry only once

#### Scenario: Neither configured
- **WHEN** config has no `trustedNetworks` field and no `auth.bypassHosts`
- **THEN** `resolvedTrustedNetworks` SHALL be an empty array

### Requirement: Network guard factory
The `localhost-guard` module SHALL export a `createNetworkGuard(trustedNetworks: string[])` function that returns a Fastify preHandler. The returned handler SHALL allow requests that satisfy any of: (a) loopback address (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`), (b) IP matching an entry in `trustedNetworks` (CIDR, wildcard, or exact match), or (c) `request.isAuthenticated` is `true` (set by the auth `onRequest` hook). All other requests SHALL receive a 403 response. The existing `localhostGuard` export SHALL be preserved for backward compatibility.

#### Scenario: Loopback IP allowed
- **WHEN** a request arrives from `127.0.0.1`
- **THEN** the guard SHALL allow the request regardless of trustedNetworks or authentication

#### Scenario: Trusted CIDR allowed
- **WHEN** `trustedNetworks` contains `192.168.1.0/24` and a request arrives from `192.168.1.42`
- **THEN** the guard SHALL allow the request

#### Scenario: Trusted wildcard allowed
- **WHEN** `trustedNetworks` contains `10.0.0.*` and a request arrives from `10.0.0.5`
- **THEN** the guard SHALL allow the request

#### Scenario: Authenticated remote user allowed
- **WHEN** a request arrives from `203.0.113.5` (not loopback, not trusted) and `request.isAuthenticated` is `true`
- **THEN** the guard SHALL allow the request

#### Scenario: Untrusted unauthenticated IP blocked
- **WHEN** `trustedNetworks` is `["192.168.1.0/24"]` and a request arrives from `10.0.0.5` with `request.isAuthenticated` being `false`
- **THEN** the guard SHALL return 403

#### Scenario: Empty trustedNetworks, no auth (localhost only)
- **WHEN** `trustedNetworks` is empty, `request.isAuthenticated` is `false`, and a request arrives from `192.168.1.5`
- **THEN** the guard SHALL return 403

### Requirement: Network guard threaded to all protected routes
All route files that currently use `localhostGuard` as a preHandler SHALL receive the network guard via their deps parameter instead of importing `localhostGuard` directly. The `RouteDeps` type SHALL include a `networkGuard` field. The server SHALL create the guard from `resolvedTrustedNetworks` at startup and pass it to all route registrations.

#### Scenario: Session route uses network guard
- **WHEN** a request to `POST /api/sessions/:id/prompt` arrives from a trusted network IP
- **THEN** the route SHALL allow the request (guard passes)

#### Scenario: File route uses network guard
- **WHEN** a request to `GET /api/browse` arrives from an untrusted IP
- **THEN** the route SHALL return 403

### Requirement: WebSocket upgrade respects trusted networks
The WebSocket upgrade handler in `server.ts` SHALL check trusted networks in addition to loopback and auth. A connection from a trusted network IP SHALL be allowed without authentication. The `validateWsUpgrade` function SHALL accept the trusted networks list and check it.

#### Scenario: WebSocket from trusted network without auth
- **WHEN** a WebSocket upgrade arrives from `192.168.1.42` with `trustedNetworks: ["192.168.1.0/24"]` and no auth cookie
- **THEN** the upgrade SHALL proceed

#### Scenario: WebSocket from untrusted IP without auth
- **WHEN** a WebSocket upgrade arrives from `203.0.113.5` with no auth cookie and auth is configured
- **THEN** the upgrade SHALL be rejected with 401

### Requirement: Auth hook tags authenticated requests
The auth plugin SHALL use `fastify.decorateRequest('isAuthenticated', false)` at registration time. When the `onRequest` hook verifies a valid JWT cookie, it SHALL set `request.isAuthenticated = true` before returning. When auth is not configured, `server.ts` SHALL register the `isAuthenticated` decorator with a default of `false` so the guard can safely read it in all cases.

#### Scenario: Valid JWT sets isAuthenticated
- **WHEN** auth is configured and a request arrives with a valid JWT cookie
- **THEN** the auth hook SHALL set `request.isAuthenticated = true`

#### Scenario: No auth configured
- **WHEN** auth is not configured
- **THEN** `request.isAuthenticated` SHALL be `false` (default decorator value)

#### Scenario: Invalid JWT
- **WHEN** auth is configured and a request arrives with an expired or invalid JWT
- **THEN** `request.isAuthenticated` SHALL remain `false`

### Requirement: Auth plugin reads merged trusted networks
The auth plugin `onRequest` hook SHALL skip authentication for requests from IPs matching `resolvedTrustedNetworks` (the merged list). This replaces the current `auth.bypassHosts`-only check.

#### Scenario: Auth bypassed for trusted network IP
- **WHEN** auth is configured and a request arrives from an IP in `resolvedTrustedNetworks`
- **THEN** the auth hook SHALL skip authentication for that request

### Requirement: isBypassedHost extracted to localhost-guard module
The `isBypassedHost()`, `matchCidr()`, and `ipToNum()` functions SHALL be moved from `auth-plugin.ts` to `localhost-guard.ts` and exported. The `auth-plugin.ts` SHALL import `isBypassedHost` from `localhost-guard.ts`.

#### Scenario: Auth plugin imports from localhost-guard
- **WHEN** the auth plugin needs CIDR matching
- **THEN** it SHALL import `isBypassedHost` from `localhost-guard.ts`

### Requirement: Network interfaces API endpoint
The server SHALL expose `GET /api/network-interfaces` as a localhost-only endpoint. It SHALL return a JSON array of detected non-internal IPv4 network interfaces. Each entry SHALL include `name` (interface name), `address` (IPv4 address), `netmask`, and `cidr` (computed CIDR notation, e.g. `192.168.1.0/24`). The CIDR SHALL be computed from the address and netmask.

#### Scenario: Machine with Wi-Fi and Ethernet
- **WHEN** the machine has `en0` at `192.168.1.100/255.255.255.0` and `en7` at `10.0.0.50/255.255.0.0`
- **THEN** the endpoint SHALL return entries with `cidr: "192.168.1.0/24"` and `cidr: "10.0.0.0/16"`

#### Scenario: Remote request to endpoint
- **WHEN** a request to `GET /api/network-interfaces` arrives from a non-loopback IP
- **THEN** the server SHALL return 403

### Requirement: Settings UI trusted networks section
The Settings panel SHALL include a "Trusted Networks" section. It SHALL display the current `trustedNetworks` entries as a list with a remove button per entry. It SHALL provide an "Add Local Network" button that fetches `GET /api/network-interfaces` and displays detected interfaces in a dropdown. Clicking an interface SHALL add its CIDR to the list. The section SHALL display a warning: "Anyone on a trusted network has full access to the dashboard without authentication. Only use on private networks you control." Changes SHALL be saved via the existing config write mechanism.

#### Scenario: No trusted networks configured
- **WHEN** the user opens Settings and `trustedNetworks` is empty
- **THEN** the section SHALL show an empty list and the "Add Local Network" button

#### Scenario: Add local network
- **WHEN** the user clicks "Add Local Network" and selects `en0 — 192.168.1.0/24`
- **THEN** `192.168.1.0/24` SHALL be added to the `trustedNetworks` list in the UI

#### Scenario: Remove trusted network
- **WHEN** the user clicks the remove button next to `192.168.1.0/24`
- **THEN** the entry SHALL be removed from the list

#### Scenario: Duplicate prevention
- **WHEN** the user tries to add `192.168.1.0/24` and it already exists in the list
- **THEN** the entry SHALL NOT be duplicated
