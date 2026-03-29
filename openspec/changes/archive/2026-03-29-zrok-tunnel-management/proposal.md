## Why

The current tunnel implementation uses zrok REST API only, which creates shares that don't actually proxy traffic in zrok v2. Real proxying requires running `zrok share public` as a long-lived child process. Additionally, there's no way for users who don't have zrok installed to discover how to set it up, and stale zrok processes from previous server crashes can accumulate.

## What Changes

- **Replace REST-only share creation with `zrok share public` subprocess**: Spawn `zrok share public` as a managed child process that actually proxies traffic. Parse the public URL from its stdout. Kill the process on server shutdown.
- **Detect zrok binary availability**: Check if `zrok` is on PATH before attempting tunnel creation. Expose this status to the client.
- **Clean up stale zrok processes**: On server start, detect and kill orphaned `zrok share` processes from previous runs (e.g. by tracking PID in a file, or by process scanning).
- **Add "Tunnel" button to sidebar actions**: New button in the left sidebar action bar (next to settings gear) that shows tunnel status — active URL when connected, or an installation guide when zrok is not available.
- **OS-aware zrok installation guide**: When zrok binary is not found, show a content view with platform-specific installation instructions (macOS via Homebrew, Linux via apt/script, Windows via Chocolatey/scoop). Detect OS from `navigator.userAgent`.

## Capabilities

### New Capabilities
- `zrok-install-guide`: Client-side OS-aware installation guide view shown when zrok is not available
- `zrok-process-tunnel`: Server-side tunnel via `zrok share public` subprocess with stale process cleanup

### Modified Capabilities
- `zrok-tunnel`: Update spec to reflect subprocess-based approach instead of REST-only, add binary detection, add stale cleanup, add tunnel status endpoint

## Impact

- **Server**: `src/server/tunnel.ts` — major rewrite from REST calls to subprocess management. New stale process cleanup on startup. New REST endpoint for tunnel status (available/url/not-installed).
- **Server**: `src/server/server.ts` — wire tunnel status endpoint, adjust startup/shutdown lifecycle.
- **Client**: New `TunnelButton` component in sidebar actions area of `SessionList.tsx`.
- **Client**: New `ZrokInstallGuide` component/view with OS detection and install instructions.
- **Shared**: New tunnel status types in `rest-api.ts` or `browser-protocol.ts`.
- **Config**: No config schema changes — `tunnel.enabled` still controls whether tunneling is attempted.
