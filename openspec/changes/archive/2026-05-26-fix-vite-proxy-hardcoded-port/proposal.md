## Why

The Vite dev server's proxy configuration hardcodes `localhost:8000` for both API (`/api`) and WebSocket (`/ws`) targets. When the dashboard server is configured with a non-default `port` (e.g. `8001`), every browser request in dev mode goes to the wrong port — API calls fail, WebSocket connections drop or connect to a stale instance, and session-control messages (abort, send_prompt, flow_control) silently hit dead air. The user-visible symptoms are severe: the Stop button appears to do nothing, sessions freeze in "streaming" state, and flow operations time out. This bug has existed since the monorepo was created (April 2026) and has never been fixed.

## What Changes

- **Vite proxy reads `~/.pi/dashboard/config.json`** at config-load time to resolve the dashboard `port`. Falls back to `8000` when the config file is missing or unreadable.
- **Env-var override**: `PI_DASHBOARD_PORT` (or `VITE_DASHBOARD_PORT`) takes precedence over the config file value, allowing one-off overrides without editing config.
- **Remove hardcoded `8000`** from both `"/api"` and `"/ws"` proxy targets in `packages/client/vite.config.ts`.

## Capabilities

### New Capabilities
- `vite-proxy-port-config`: Vite dev server proxy resolves the dashboard port from `~/.pi/dashboard/config.json` and/or environment variables, instead of hardcoding `8000`.

### Modified Capabilities
- `client-build-config`: The Vite proxy configuration requirement is extended — the proxy target port SHALL be configurable and read from the dashboard config, with a hardcoded fallback of `8000`.

## Impact

- **Affected code**: `packages/client/vite.config.ts` (add config read + env-var read; replace hardcoded `8000`)
- **No protocol changes, no API changes, no breaking changes**
- **Backward compatibility**: Default port `8000` unchanged — existing users with default port see zero difference. Users with custom ports see dev mode work correctly for the first time.
