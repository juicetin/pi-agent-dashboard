## Context

The dashboard server listens on localhost only. zrok provides free public tunnels that proxy HTTP + WebSocket. The zrok Node SDK (`@openziti/zrok`) depends on native modules, but public shares are just REST API calls to the zrok controller — no native deps needed. Users must have zrok installed and enrolled (`zrok enable`) for tunneling to work.

## Goals / Non-Goals

**Goals:**
- Zero-dependency zrok tunnel creation via direct REST API calls
- Automatic tunnel on server startup when zrok is enrolled
- Clean tunnel teardown on server shutdown
- Browser WebSocket works through the tunnel (wss:// support)
- Graceful degradation when zrok is not enrolled

**Non-Goals:**
- Authentication/authorization for the tunnel (accept risk for now)
- Private shares (requires native OpenZiti SDK)
- Reserved/persistent share names (ephemeral shares only)
- Installing or enrolling zrok for the user

## Decisions

### 1. Direct REST API instead of SDK

**Decision**: Call the zrok controller REST API directly with `fetch()`. No `@openziti/zrok` dependency.

**Rationale**: The SDK pulls in `@openziti/ziti-sdk-nodejs` (native addon with `node-pre-gyp`, `segfault-handler`). For public proxy shares, the SDK just wraps REST calls. Doing it directly is ~50 lines, zero dependencies.

### 2. Read zrok config from `~/.zrok/`

**Decision**: Read `~/.zrok/environment.json` to get `apiEndpoint`, `zId` (environment ID), and the zrok API token. Check `rootExists()` by testing if this file exists.

**Rationale**: This is the standard zrok config location. The `loadRoot()` equivalent is just reading and parsing one JSON file.

### 3. Config field: `tunnel.enabled` (default: true)

**Decision**: Add `tunnel: { enabled: boolean }` to `DashboardConfig`. Default `true`. CLI flag `--no-tunnel` overrides to `false`.

**Rationale**: Tunnel should work automatically for users who have zrok enrolled. Those who don't want it can disable via config or CLI flag. When zrok is not enrolled, tunnel is silently skipped regardless of config.

### 4. Tunnel lifecycle tied to server lifecycle

**Decision**: Create share after `fastify.listen()` completes. Delete share in `server.stop()`. Store the share token and root reference on the server instance for cleanup.

**Rationale**: The tunnel must point at a listening server. Creating after listen ensures the target is ready. Cleanup on stop prevents orphaned shares.

### 5. Fix client WebSocket URL for remote access

**Decision**: Change `App.tsx` WS_URL from:
```
ws://${hostname}:${port || "8000"}/ws
```
to:
```
${location.protocol === "https:" ? "wss:" : "ws:"}//${hostname}${port ? ":" + port : ""}/ws
```

**Rationale**: When served through zrok (HTTPS on port 443), the current code produces `ws://xxx.share.zrok.io:8000/ws` which fails. The fix uses the correct protocol and omits the port when using default (443/80).

## Risks / Trade-offs

- **[Risk] zrok enrollment expires or gets revoked** → `createShare` will fail; server catches the error, logs a warning, and continues without tunnel
- **[Risk] No auth on public tunnel** → Accepted for now. Anyone with the URL can access the dashboard. Future change can add basic auth or token auth.
- **[Trade-off] Ephemeral shares get new URLs each restart** → Acceptable. Reserved shares would need additional config (unique name). Can add later.
- **[Risk] `~/.zrok/environment.json` format changes** → Low risk, zrok is stable. Wrap in try/catch for safety.
