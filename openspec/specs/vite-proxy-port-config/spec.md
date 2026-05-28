# vite-proxy-port-config Specification

## Purpose
The Vite dev server proxy targets the configured dashboard port instead of a hardcoded `8000`.

## Requirements

### Requirement: Vite proxy target port reads from dashboard config
The Vite dev server configuration in `packages/client/vite.config.ts` SHALL resolve the proxy target port from `~/.pi/dashboard/config.json` at config-load time. The resolved port SHALL be used for both the `/api` HTTP proxy and the `/ws` WebSocket proxy targets.

The resolution order SHALL be:
1. `PI_DASHBOARD_PORT` environment variable (if set and parseable as a valid port number)
2. `port` field from `~/.pi/dashboard/config.json` (if the file exists, is valid JSON, and contains a numeric `port`)
3. Fallback: `8000`

If the environment variable is set but cannot be parsed as a valid port (non-numeric, out of range 1–65535), it SHALL be ignored and the next resolution step SHALL be used.

If the config file is missing, unreadable, or contains invalid JSON, the fallback SHALL apply. No error SHALL be thrown — the dev server SHALL start with the fallback port.

#### Scenario: Default port in config
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 8000 }` (or the key is absent) AND `PI_DASHBOARD_PORT` is not set
- **THEN** the Vite proxy targets `http://localhost:8000` for `/api` and `ws://localhost:8000` for `/ws`

#### Scenario: Custom port in config
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 8001 }` AND `PI_DASHBOARD_PORT` is not set
- **THEN** the Vite proxy targets `http://localhost:8001` for `/api` and `ws://localhost:8001` for `/ws`

#### Scenario: Environment variable overrides config
- **WHEN** `~/.pi/dashboard/config.json` contains `{ "port": 8001 }` AND `PI_DASHBOARD_PORT=8002`
- **THEN** the Vite proxy targets `http://localhost:8002` for `/api` and `ws://localhost:8002` for `/ws`

#### Scenario: Missing config file falls back to default
- **WHEN** `~/.pi/dashboard/config.json` does not exist AND `PI_DASHBOARD_PORT` is not set
- **THEN** the Vite proxy targets `http://localhost:8000` for `/api` and `ws://localhost:8000` for `/ws`
- **AND** no error is thrown; the dev server starts normally

#### Scenario: Invalid env var falls back to config
- **WHEN** `PI_DASHBOARD_PORT=not-a-number` AND `~/.pi/dashboard/config.json` contains `{ "port": 8001 }`
- **THEN** the Vite proxy targets `http://localhost:8001` for `/api` and `ws://localhost:8001` for `/ws`

#### Scenario: WebSocket proxy uses the same resolved port
- **WHEN** the proxy port is resolved to `8001` via any resolution step
- **THEN** the `/ws` WebSocket proxy target SHALL be `ws://localhost:8001`
- **AND** the `ws: true` option SHALL remain enabled
