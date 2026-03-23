## 1. Shared Config

- [x] 1.1 Add `tunnel: { enabled: boolean }` to `DashboardConfig` interface and defaults in `src/shared/config.ts`
- [x] 1.2 Update `loadConfig()` to read `tunnel` field with default `{ enabled: true }`
- [x] 1.3 Update `ensureConfig()` to include `tunnel` in the default config file

## 2. Tunnel Module

- [x] 2.1 Create `src/server/tunnel.ts` with `loadZrokEnv()` function: read `~/.zrok/environment.json`, return `{ apiEndpoint, envZId, token }` or null
- [x] 2.2 Add `createTunnel(port: number)` function: call `POST {apiEndpoint}/api/v1/share`, return public URL or null
- [x] 2.3 Add `deleteTunnel()` function: call `DELETE {apiEndpoint}/api/v1/unshare` with stored shareToken
- [x] 2.4 Handle all error cases gracefully (not enrolled, API failure, malformed config) — log warning, return null
- [x] 2.5 Write tests for `loadZrokEnv()`: enrolled, not enrolled, malformed JSON

## 3. Server Integration

- [x] 3.1 Add `tunnel: boolean` to `ServerConfig` interface in `src/server/server.ts`
- [x] 3.2 After `fastify.listen()`, if `config.tunnel` is true, call `createTunnel(config.port)` and print public URL
- [x] 3.3 In `server.stop()`, call `deleteTunnel()` before closing fastify

## 4. CLI

- [x] 4.1 Add `--no-tunnel` flag parsing in `src/server/cli.ts`
- [x] 4.2 Wire `tunnel` config into `ServerConfig` (CLI flag overrides config file)

## 5. Client WebSocket URL Fix

- [x] 5.1 Update `WS_URL` in `src/client/App.tsx` to use `wss://` when `location.protocol` is `https:` and omit port when using default (443/80)
