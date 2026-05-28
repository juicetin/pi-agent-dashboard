## 1. Port resolution helper

- [x] 1.1 Add `resolveDashboardPort()` helper at top of `packages/client/vite.config.ts` that reads `PI_DASHBOARD_PORT` env var → `~/.pi/dashboard/config.json#port` → fallback `8000`
- [x] 1.2 Validate that the resolved value is a parseable integer in range 1–65535; discard invalid env var values

## 2. Replace hardcoded proxy targets

- [x] 2.1 Replace hardcoded `"http://localhost:8000"` in `/api` proxy with template literal using resolved port
- [x] 2.2 Replace hardcoded `"ws://localhost:8000"` in `/ws` proxy target with template literal using resolved port

## 3. Verification

- [x] 3.1 Verify `npm run dev` starts with default port (8000) when no config override exists
- [x] 3.2 Verify `PI_DASHBOARD_PORT=8001 npm run dev` proxies to port 8001
- [x] 3.3 Verify custom `config.json#port` is picked up when `PI_DASHBOARD_PORT` is unset
- [x] 3.4 Verify fallback to 8000 when config file is missing and env var is unset
