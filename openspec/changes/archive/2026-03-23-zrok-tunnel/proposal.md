## Why

The dashboard server is only accessible on localhost. To monitor pi sessions remotely (e.g., from a phone, another machine), there's no built-in way to expose it. zrok provides free public tunnels with WebSocket support, and many developers already have it enrolled. Integrating tunnel creation into the server startup makes remote access a zero-config experience.

## What Changes

- **New `src/server/tunnel.ts`**: Lightweight zrok integration via direct REST API calls (no native dependencies). Reads `~/.zrok/` config to detect enrollment, calls `POST /api/v1/share` to create a public proxy share pointing at `localhost:{port}`, and `DELETE /api/v1/unshare` on cleanup.
- **Server startup**: After `fastify.listen()`, if zrok is enrolled and tunnel is enabled, create the tunnel and print the public URL.
- **Server shutdown**: Delete the zrok share on `server.stop()`.
- **Config**: Add `tunnel: { enabled: boolean }` to `DashboardConfig` (default: `true`).
- **CLI**: Add `--no-tunnel` flag to disable tunnel creation.
- **Client WS URL fix**: Update `App.tsx` to use `wss://` when page is served over HTTPS and not hardcode port 8000 fallback, so the browser WebSocket works through the tunnel.

## Capabilities

### New Capabilities

- `zrok-tunnel`: Automatic public tunnel creation via zrok REST API for remote dashboard access

### Modified Capabilities

- `shared-config`: Add `tunnel.enabled` config field
- `dashboard-server`: Server creates/destroys zrok tunnel on start/stop

## Impact

- `src/server/tunnel.ts` — New file: zrok REST API client (~50 lines)
- `src/server/server.ts` — Call tunnel create after listen, delete on stop
- `src/server/cli.ts` — Add `--no-tunnel` flag
- `src/shared/config.ts` — Add `tunnel.enabled` to config type and defaults
- `src/client/App.tsx` — Fix WS_URL to support wss:// and default ports
