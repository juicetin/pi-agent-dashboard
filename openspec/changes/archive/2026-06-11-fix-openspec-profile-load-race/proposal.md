## Why

The Settings → Advanced → "OpenSpec Workflow Profile" section intermittently shows `Core` even when the saved global profile is `expanded`/`custom`. Validated root cause: a cold `GET /api/openspec/config` blocks the Node event loop ~1s (synchronous `spawnSync openspec config list`), which stalls the browser's keep-alive connection; the PWA service worker turns that transient fetch rejection into a fake `503 "Offline"` response; the settings component swallows the error and silently keeps its hardcoded `core` default with no retry. One unlucky load strands the UI on the wrong profile until a manual reload.

## What Changes

- Make `GET /api/openspec/config` non-blocking: run `openspec config list` via the async spawn path so a cold read never blocks the event loop (and never stalls other in-flight requests).
- Make the profile settings section resilient: render a loading state until the config resolves, retry a transient failure, and surface a visible error instead of silently falling back to a hardcoded `core`. Never present a concrete profile as "selected" before the real config has loaded.
- Stop the service worker from fabricating responses for API calls: `/api/*` requests SHALL pass through to the network untransformed (no synthetic `503`). The pass-through `catch` SHALL only apply to navigation/asset requests.

## Capabilities

### New Capabilities
- `service-worker-network-passthrough`: service worker forwards requests to the network and never substitutes a fabricated response (e.g. `503 "Offline"`) for `/api/*` calls, so transient network failures surface as real fetch rejections to the caller rather than masquerading as server errors.

### Modified Capabilities
- `openspec-profile-config`: add (a) a non-blocking `GET /api/openspec/config` read requirement and (b) a resilient-load requirement for the settings section (loading state, retry, no silent hardcoded fallback).

## Impact

- Server: `packages/server/src/routes/openspec-routes.ts` (`GET /api/openspec/config` handler) → async config read; `packages/shared/src/platform/openspec.ts` (`configList`) may need an async variant (`runAsync` already exists in `runner.ts`).
- Client: `packages/client/src/components/OpenSpecProfileSection.tsx` (loading/error/retry, drop hardcoded `core` initial selection); `packages/client/src/lib/openspec-config-api.ts` (`fetchGlobalOpenSpecConfig`).
- Service worker: `packages/client/dist/sw.js` (and its source if one exists) — scope the network-failure `catch` away from `/api/*`.
- No protocol/persistence changes. No breaking API changes.
