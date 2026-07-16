# Add Universal Network Guard

## Why

`networkGuard` is opt-in per route. It is created once (`server.ts:1013`) and
passed as a `preHandler` to ~20 **core** route registrars (session, git, file,
grep, goal, system, tool, editor, …). Two classes of route never receive it:

1. **Plugin routes** — `automation-plugin`, `flows-plugin`, `kb-plugin` register
   on the shared Fastify instance via `ctx.fastify` but are never handed
   `networkGuard`.
2. **provider-auth + models-introspection routes** — omit the `preHandler`.

The only thing that would otherwise gate those routes is the OAuth `onRequest`
hook (`registerAuthPlugin`, `server.ts:989`) — but it is registered **only when
auth is configured**. The always-on `registerBearerAuth` hook merely *sets*
`request.isAuthenticated`; it never rejects. So in the **default deployment
(localhost, OAuth off, occasional zrok tunnel)** those routes have **no guard at
all**, while every core dangerous route stays protected by its per-route
`networkGuard` even with auth off.

The security-boundary-audit verified the consequence (VD2): over the tunnel,
`POST /api/plugins/automation/create` + `/run` write a prompt to an
attacker-chosen path and spawn a pi agent to execute it — **remote code
execution with auth off**. The same gap exposes `PUT /api/provider-auth/api-key`
(overwrite provider credentials) and `GET /api/provider-auth/status` (read masked
keys) to any LAN/tunnel caller.

Per-route opt-in is the root defect: the guard is exactly as strong as the
developer's memory to attach it, and three registrars forgot. This change makes
the guard **structural** so no route can be forgotten.

## What Changes

- **Promote `networkGuard` to a single universal `onRequest` hook** that runs on
  every request **regardless of whether auth is configured**, covering core
  routes, plugin routes, and provider-auth/models-introspection routes with one
  enforcement point.
- **Introduce an explicit public-route allowlist** (the only routes that skip the
  guard), modeled on the allowlist already in `auth-plugin.ts`:
  `/api/health`, `/manifest.json`, `PUBLIC_PAIRING_PREFIXES`, the OAuth
  `/auth/*` login/callback routes, the WS-ticket-minting endpoint, static
  assets, and configured `bypassUrls`/`bypassHosts`. Everything not on the list
  is guarded by default (deny-by-default, not allow-by-default).
- **Preserve every existing pass condition** — loopback / genuine-local,
  trusted-network CIDR, local-token, valid bearer, valid OAuth cookie. No change
  to who is *allowed*; only a change to *which routes are checked*.
- **Keep WS upgrades on their existing path** — `validateWsUpgrade` + single-use
  scoped ws-ticket is unchanged and remains the WS auth mechanism.
- **Leave the per-route `preHandler: networkGuard` in place** as redundant
  defense-in-depth (removing them is a separate cleanup; keeping them is
  harmless and avoids a large diff).
- **Log every denial** (path, source IP, reason) so a probing LAN/tunnel client
  is observable.

Out of scope (tracked separately in `security-boundary-audit/tasks.md`): the
bridge↔server WS authentication (S2), the client XSS trio (S3), the
git-checkout injection (B1), and the individual cwd-allowlist hardening inside
each plugin (defense-in-depth on top of this guard).

## Impact

- **Closes:** VD2 automation-plugin RCE (tunnel, auth-off); provider-auth
  credential read/overwrite + browser-spawn DoS; kb/flows plugin route exposure.
- **Behavior change / risk:** any route not on the public allowlist that was
  previously reachable unauthenticated becomes guarded. The allowlist must be
  complete or a legitimately-public surface (PWA manifest, pairing bootstrap,
  OAuth callback) could be locked out — this is the primary risk and the reason
  a `doubt-driven-review` + scenario pass gate this change.
- **Affected specs:** `trusted-networks`, `auth-bypass-url-list`,
  `dashboard-plugin-loader` (plugin routes now inherit the guard). Delta specs to
  be authored in the next artifact step.
- **Affected code:** `packages/server/src/server.ts` (hook registration),
  `packages/server/src/localhost-guard.ts` / `auth-plugin.ts` (allowlist +
  onRequest form of the guard).

## Discipline Skills

- `security-hardening` — this is an auth-boundary change; STRIDE the allowlist and
  the deny-by-default default.
- `doubt-driven-review` — the change is a broad, semi-irreversible enforcement
  flip; stress-test the public-route allowlist for lock-out before it stands.
- `scenario-design` — enumerate the guarded/allowlisted matrix (loopback, LAN
  trusted, tunnel authed, tunnel anon, plugin route, health, manifest, pairing,
  OAuth callback, WS upgrade) as real test scenarios.
- `observability-instrumentation` — denial logging so probes are visible.
