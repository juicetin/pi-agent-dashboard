## MODIFIED Requirements

### Requirement: Network guard threaded to all protected routes
The network guard SHALL be enforced as a single universal Fastify `onRequest`
hook installed once at server startup, running on **every** request **regardless
of whether `config.authConfig` is present**. This replaces reliance on per-route
`preHandler: networkGuard` opt-in as the primary enforcement mechanism, so that a
route cannot be left unguarded by omission.

Core route registrations MAY retain their existing `preHandler: networkGuard`
and `RouteDeps.networkGuard` threading as redundant defense-in-depth; these SHALL
NOT be required for a route to be protected. The `RouteDeps` type SHALL continue
to include a `networkGuard` field for backward compatibility.

The universal hook SHALL apply the same allow conditions as the guard factory
(loopback, `resolvedTrustedNetworks` match, `request.isAuthenticated`), and SHALL
deny all other requests except those matching the public-route allowlist.

#### Scenario: Core route protected by the universal hook alone
- **WHEN** the per-route `preHandler` is absent but the universal hook is installed, and a request to `POST /api/sessions/:id/prompt` arrives from an untrusted, unauthenticated IP
- **THEN** the request SHALL be denied by the universal hook (403)

#### Scenario: Retained per-route guard is harmless
- **WHEN** a core route still declares `preHandler: networkGuard` and the universal hook is installed
- **THEN** the request SHALL be evaluated consistently (both checks agree) and SHALL NOT be double-rejected or error

## ADDED Requirements

### Requirement: Universal guard runs regardless of auth configuration
The universal `onRequest` guard SHALL run and enforce network policy even when
auth is not configured (no OAuth providers). When `config.authConfig` is absent
or its provider registry is empty, `request.isAuthenticated` SHALL default to
`false` and the guard SHALL still deny non-loopback, non-trusted, non-allowlisted
requests. Enforcement SHALL NOT depend on the conditional OAuth `onRequest` hook
being registered.

#### Scenario: Plugin route denied over tunnel with auth off
- **WHEN** auth is not configured and a proxied/tunneled request (carrying forwarding headers, so not genuine-local) arrives at `POST /api/plugins/automation/create` from an untrusted IP
- **THEN** the guard SHALL deny the request with 403
- **AND** no automation file SHALL be written and no agent SHALL be spawned

#### Scenario: provider-auth route denied with auth off
- **WHEN** auth is not configured and an untrusted, unauthenticated request arrives at `PUT /api/provider-auth/api-key`
- **THEN** the guard SHALL deny the request with 403

#### Scenario: Loopback still allowed with auth off
- **WHEN** auth is not configured and a genuine-local loopback request arrives at any guarded route
- **THEN** the guard SHALL allow the request

### Requirement: Public-route allowlist (deny-by-default)
The server SHALL maintain an explicit public-route allowlist enumerating the only
request URLs that the universal guard permits without satisfying loopback /
trusted-network / authenticated conditions. All requests whose URL is not on the
allowlist and that do not satisfy an allow condition SHALL be denied (403). The
allowlist SHALL include at minimum: `/api/health`, `/manifest.json`, the
`PUBLIC_PAIRING_PREFIXES`, the OAuth `/auth/*` login and callback routes, the
single-use WS-ticket-minting endpoint, static client assets, and any configured
`auth.bypassUrls` prefixes.

#### Scenario: Health endpoint reachable unauthenticated
- **WHEN** an unauthenticated, untrusted request arrives at `GET /api/health`
- **THEN** the guard SHALL allow the request

#### Scenario: PWA manifest reachable unauthenticated
- **WHEN** an unauthenticated, untrusted request arrives at `GET /manifest.json`
- **THEN** the guard SHALL allow the request

#### Scenario: Pairing bootstrap reachable unauthenticated
- **WHEN** an unauthenticated request arrives at a URL under a `PUBLIC_PAIRING_PREFIXES` entry
- **THEN** the guard SHALL allow the request

#### Scenario: OAuth callback reachable unauthenticated
- **WHEN** an unauthenticated request arrives at `/auth/callback/:provider`
- **THEN** the guard SHALL allow the request (so login can complete)

#### Scenario: Non-allowlisted route denied
- **WHEN** an unauthenticated, untrusted request arrives at a route not on the allowlist (e.g. `GET /api/sessions`)
- **THEN** the guard SHALL deny the request with 403

### Requirement: Plugin and provider-auth routes covered by the universal guard
The universal guard SHALL cover routes registered by dashboard plugins on the
shared Fastify instance (`ctx.fastify`) and the provider-auth and
models-introspection routes, without requiring each registrar to attach a
per-route `preHandler`. The guard SHALL treat these identically to core routes.

#### Scenario: Automation plugin route guarded
- **WHEN** an untrusted, unauthenticated request arrives at any `/api/plugins/automation/*` mutating route
- **THEN** the guard SHALL deny it with 403

#### Scenario: kb and flows plugin routes guarded
- **WHEN** an untrusted, unauthenticated request arrives at `/api/plugins/kb/*` or `/api/plugins/flows/*`
- **THEN** the guard SHALL deny it with 403

#### Scenario: models-introspection route guarded
- **WHEN** an untrusted, unauthenticated request arrives at `GET /v1/models`
- **THEN** the guard SHALL deny it with 403

### Requirement: Guard denials are logged
Each denial by the universal guard SHALL emit a structured log line including the
request path, source IP, and the denial reason, so a probing LAN or tunnel client
is observable. The log line SHALL NOT include request bodies or secrets.

#### Scenario: Denied request is logged
- **WHEN** the guard denies a request from `203.0.113.5` to `/api/sessions`
- **THEN** a log line SHALL record the path `/api/sessions`, the source IP, and a reason
- **AND** the log line SHALL NOT contain the request body or any token
