## 1. Config & Dependencies

- [x] 1.1 Add `@fastify/cookie` and `jsonwebtoken` (+ `@types/jsonwebtoken`) to `package.json`
- [x] 1.2 Extend `DashboardConfig` in `src/shared/config.ts` with optional `auth` field (`AuthConfig` type: `secret`, `providers`, `allowedEmails`)
- [x] 1.3 Update `loadConfig()` to parse `auth` section — treat empty/missing providers as `undefined`
- [x] 1.4 Write tests for config loading with auth present, partial, empty providers, and missing

## 2. Tunnel URL Accessor

- [x] 2.1 Add `getTunnelUrl()` export to `src/server/tunnel.ts` — returns the active tunnel URL or null
- [x] 2.2 Clear stored URL in `deleteTunnel()`, set it in `createTunnel()`
- [x] 2.3 Write tests for `getTunnelUrl()` lifecycle (created → available, deleted → null)

## 3. OAuth Provider Registry

- [x] 3.1 Create `src/server/auth.ts` with `OAuthProviderConfig` type and provider registry builder
- [x] 3.2 Implement built-in GitHub provider (hardcoded authorize/token/userinfo URLs, `user:email` scope)
- [x] 3.3 Implement OIDC discovery fetch for Google, Keycloak, and generic OIDC providers
- [x] 3.4 Write tests for provider registry construction from config (each provider type, empty providers)

## 4. Auth Secret Management

- [x] 4.1 Implement `ensureAuthSecret()` — auto-generate 32-char hex if `auth.secret` is missing, write back to config file
- [x] 4.2 Write tests for secret auto-generation and persistence

## 5. JWT Session Token

- [x] 5.1 Implement `signToken(payload, secret)` and `verifyToken(token, secret)` helpers wrapping `jsonwebtoken`
- [x] 5.2 Token payload: `{ sub (email), name, provider, exp (7 days) }`
- [x] 5.3 Write tests for sign/verify, expired tokens, tampered tokens

## 6. Auth Routes

- [x] 6.1 Implement `GET /auth/login` — provider picker page (server-rendered HTML), auto-redirect if single provider
- [x] 6.2 Implement `GET /auth/callback/:provider` — code exchange, user info fetch, email validation, JWT cookie set, redirect
- [x] 6.3 Implement `POST /auth/logout` — clear cookie, redirect to `/auth/login`
- [x] 6.4 Implement `GET /auth/status` — return `{ authenticated, user?, authEnabled? }`
- [x] 6.5 Construct redirect URI using `getTunnelUrl()` with localhost fallback
- [x] 6.6 Write tests for each route (success, error, email not allowed, expired code)

## 7. Auth Hook (HTTP)

- [x] 7.1 Register `@fastify/cookie` plugin in server when auth is enabled
- [x] 7.2 Implement `onRequest` hook: skip for localhost (`isLoopback`), skip for `/auth/*` paths, validate JWT cookie for external requests
- [x] 7.3 Redirect to `/auth/login?return=<original-url>` for HTML requests, return 401 JSON for API requests
- [x] 7.4 Write tests for hook behavior: localhost bypass, external with valid cookie, external without cookie, expired cookie

## 8. WebSocket Upgrade Auth

- [x] 8.1 Extract cookie parsing helper (reusable between HTTP hook and upgrade handler)
- [x] 8.2 Add auth check in `server.ts` `upgrade` handler — parse cookie from headers, validate JWT for non-localhost requests
- [x] 8.3 Destroy socket with 401 response if auth fails on external WebSocket upgrade
- [x] 8.4 Write tests for WebSocket upgrade auth (localhost pass-through, external valid, external invalid)

## 9. Server Integration

- [x] 9.1 Conditionally register auth plugin in `createServer()` based on config
- [x] 9.2 Pass tunnel URL to auth module after tunnel creation (sequence: listen → tunnel → auth redirect URI)
- [x] 9.3 Ensure `/auth/*` routes are excluded from existing `localhostGuard`
- [x] 9.4 Integration test: server starts with auth config, login flow works end-to-end

## 10. Client Auth Handling

- [x] 10.1 Add WebSocket disconnect handler in `App.tsx` — detect 401 and show "Session expired" banner with login link
- [x] 10.2 On initial load, call `GET /auth/status` to check auth state (for showing user info or login prompt)

## 11. Config REST Endpoints

- [x] 11.1 Add `GET /api/config` route with `localhostGuard` — returns config with secrets redacted
- [x] 11.2 Add `PUT /api/config` route with `localhostGuard` — merges partial config, preserves `"***"` secrets, writes to disk
- [x] 11.3 Implement `reloadConfig()` in server — applies runtime-safe changes (autoShutdown, spawnStrategy, auth rebuild)
- [x] 11.4 Return `{ restartRequired: true }` when port/piPort changes are included
- [x] 11.5 Write tests for config endpoints (read, write, secret redaction, secret preservation, restart flag)

## 12. Settings Panel Component

- [x] 12.1 Add gear icon button to sidebar header (after collapse button) — navigates to `/settings`
- [x] 12.2 Add `/settings` route in App.tsx that renders SettingsPanel in the main content area
- [x] 12.3 Create `SettingsPanel.tsx` — fetches config on mount, renders grouped form fields
- [x] 12.4 Implement Server group: port, piPort, autoShutdown toggle, shutdownIdleSeconds input
- [x] 12.5 Implement Sessions group: spawnStrategy select (headless/tmux)
- [x] 12.6 Implement Tunnel group: tunnel.enabled toggle
- [x] 12.7 Implement Authentication group: per-provider clientId/clientSecret/issuerUrl fields, allowedUsers list (usernames, emails, domain wildcards)
- [x] 12.8 Implement Developer group: devBuildOnReload toggle
- [x] 12.9 Add save button — sends only changed fields via PUT, shows success/error/restart-required feedback
- [x] 12.10 Write tests for SettingsPanel (mount loads config, save sends partial, restart required message)

## 13. Documentation

- [x] 13.1 Update `AGENTS.md` with `src/server/auth.ts` in key files table
- [x] 13.2 Update `docs/architecture.md` with auth flow description
- [x] 13.3 Update `README.md` with auth configuration section (provider setup, callback URLs, `allowedUsers`)
