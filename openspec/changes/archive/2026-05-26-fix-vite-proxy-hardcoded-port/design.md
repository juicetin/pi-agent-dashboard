## Context

`packages/client/vite.config.ts` configures a Vite dev server proxy that forwards `/api` HTTP requests and `/ws` WebSocket upgrades to the dashboard server. Since the monorepo was created (commit `8ce152ca`, Apr 2026), both proxy targets have hardcoded `localhost:8000`. The dashboard's HTTP port is configurable via `~/.pi/dashboard/config.json#port` (default `8000`). When a user sets a different port, every browser request in dev mode goes to the wrong destination — API calls fail, WebSocket connections drop or hit a stale instance, and session-control messages (abort, send_prompt, flow_control) are silently lost.

The `server-launch` spec already mandates that all runtime spawners respect `config.port`. The bridge reads `config.piPort` for its WebSocket. Only the Vite proxy is hardcoded.

## Goals / Non-Goals

**Goals:**
- Vite dev server proxy targets the same dashboard port the user configured in `~/.pi/dashboard/config.json`.
- Zero impact on users with the default port (`8000`).
- Env-var escape hatch for one-off overrides without editing config.

**Non-Goals:**
- Making the Vite port itself configurable (it stays at `3000` — that's the dev server port, not the proxy target).
- Changing how the browser client derives its WebSocket URL (that's already correct — it uses `window.location.port`).
- Fixing other hardcoded `8000` references in client components (`KnownServersSection`, `parse-host-input`, `ModelProxySection`) — those are UI defaults, not wire-level routing.

## Decisions

### D1. Read `config.json` synchronously at Vite config-load time

**Decision:** Add a small helper at the top of `vite.config.ts` that reads `~/.pi/dashboard/config.json` via `fs.readFileSync`, parses `port`, and uses it as the proxy target port. Fall back to `8000` on any error (missing file, bad JSON, missing key).

**Rationale:**
- `vite.config.ts` is evaluated at dev-server start time (via `npx vite`), not at build time. A synchronous read is cheap (~1 ms) and consistent with how `loadConfig()` works in the shared config module.
- The config file path is stable: `~/.pi/dashboard/config.json`. No dynamic resolution needed.
- We deliberately do NOT import `@blackbelt-technology/pi-dashboard-shared/config.js` because that module pulls in Node built-ins that Vite's esbuild config-loader might struggle with. A minimal inline read avoids any dependency footgun.

**Alternatives considered:**
- **Env var only** (`PI_DASHBOARD_PORT`): Simpler, but forces the user to set an env var in addition to config.json. Violates the principle that config.json is the single source of truth for dashboard settings.
- **Import `loadConfig` from shared**: Clean code reuse, but Vite's esbuild config-loader processes `vite.config.ts` in a specialized context — importing a module that itself requires `node:fs`, `node:path`, and `node:os` may work but is fragile. The inline read is 5 lines and has zero transitive dependency risk.
- **Vite's `proxy` as a function**: Vite supports proxy as a function `(req) => target`, but the WebSocket upgrade path with `ws: true` requires a static string target per the Vite proxy API. Can't use a function for the `/ws` route.

### D2. Env-var override: `PI_DASHBOARD_PORT`

**Decision:** `PI_DASHBOARD_PORT` env var takes precedence over the config file value. If set (and a valid integer), it overrides both the config file read and the hardcoded fallback.

**Rationale:**
- Consistent with existing pattern: the server CLI already respects `PI_DASHBOARD_PORT` for its own port binding.
- Allows CI/test environments to override without touching config.json.

**Alternatives considered:**
- `VITE_DASHBOARD_PORT`: Vite-specific prefix is more idiomatic for Vite config. However, `PI_DASHBOARD_PORT` is already documented and used by the server. Using the same env var keeps the configuration surface smaller.

### D3. Port 8000 remains the hardcoded fallback

**Decision:** When both `PI_DASHBOARD_PORT` and `config.json` are unavailable, fall back to `8000`.

**Rationale:**
- Preserves backward compatibility for the vast majority of users who never change the port.
- The `8000` default is canonical — it's the `DEFAULTS.port` in `packages/shared/src/config.ts`.

### D4. No changes to HMR config

**Decision:** Vite HMR's `clientPort: 3000` stays unchanged. HMR WebSocket connects directly to Vite, not through the dashboard proxy. This is correct and unrelated to the proxy target port.

## Risks / Trade-offs

- **[Risk] `PI_DASHBOARD_PORT` env var exists but points to wrong port** → Same mitigation as today: user runs dashboard on one port, browser tries another, things break. This is a configuration error, not a code bug.
- **[Risk] Config file read fails silently (falls back to 8000)** → The fallback is the default port, so most users see correct behavior. A console warning could be added but is not required for correctness.
- **[Trade-off] Inline config read duplicates `loadConfig` logic minimally** → Acceptable for a 5-line read. If the config schema changes significantly, this inline read stays compatible because it only reads `port`.

## Migration Plan

1. **No migration needed.** Users with `port: 8000` (default) see zero change. Users with a custom port see dev mode work correctly for the first time.
2. **Rollback:** Revert the commit. Zero data migration, zero config changes.
3. **Verification:** `PI_DASHBOARD_PORT=8001 npm run dev` → API calls reach port 8001. `npm run dev` (no env var, default config) → API calls reach port 8000. Change `~/.pi/dashboard/config.json#port` to `8001`, run `npm run dev` → API calls reach port 8001.
