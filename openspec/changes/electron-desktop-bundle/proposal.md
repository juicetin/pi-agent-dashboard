## Why

The pi-dashboard currently requires users to manually install Node.js, pi, and openspec before they can use it. This creates a high barrier to entry — especially for non-developers or users on fresh machines. An Electron desktop bundle packages everything into a single installable app that works out of the box on macOS, Linux, and Windows, while still coexisting with the existing web-based workflow. Additionally, server discovery is hardcoded to a config-file port, making it fragile (port collisions with other services) and limiting (no LAN discovery). mDNS-based zero-config discovery solves both.

## What Changes

- New Electron shell that acts as a **smart window + server bootstrapper** — not an in-process server. The dashboard server always runs as a separate detached process (same as `pi-dashboard start`), and Electron opens a BrowserWindow pointing at it.
- Bundle standalone Node.js v22 LTS as `extraResources` for bootstrapping pi/openspec installation
- First-run setup wizard: detect or auto-install pi and openspec via bundled npm, prompt for API key if missing
- **mDNS zero-config server discovery** via `bonjour-service` (pure JS, no native deps). Server advertises `_pi-dashboard._tcp` with port, version, and hostname. Bridge extensions, Electron app, and CLI all discover servers automatically instead of relying on hardcoded port probes.
  - **Localhost preferred**: by default, connect to a local server (same machine). Launch one if none is running.
  - **LAN server awareness**: when remote dashboard servers are discovered on the network, the client is notified and can switch to them.
  - **Server selector in dashboard header**: dropdown showing all discovered servers (local + remote) with hostname, port, and status. Switching re-points the WebSocket connection to a different server.
  - **Fallback**: when mDNS is blocked (Windows firewall, CI), falls back to config-based localhost probe + `/api/health` identity verification.
- Hardcode `spawnStrategy: "headless"` in Electron builds — tmux codepath excluded
- `node-pty` rebuilt against Electron's Node ABI via `@electron/rebuild` per platform
- CI build matrix producing platform installers: macOS `.dmg` (arm64 + x64), Linux `.AppImage` (x64), Windows `.exe` NSIS (x64)
- Periodic pi/openspec update check with user prompt
- Single-instance lock via `app.requestSingleInstanceLock()` to prevent multiple Electron windows
- The existing web dashboard (`pi-dashboard` CLI) continues to work unchanged — Electron is an alternative entry point
- **No port collision**: only one server ever runs per machine. Discovery-based startup detects existing servers reliably regardless of port. CLI-started and Electron-started servers are interchangeable.
- **Server outlives Electron**: closing the Electron window does not kill the server (bridges stay connected). Optionally stops the server on quit only if Electron was the one that started it.

## Capabilities

### New Capabilities
- `electron-shell`: Electron main/renderer process lifecycle, BrowserWindow management, single-instance lock, optional server lifecycle (start on launch, stop on quit if we started it), system tray integration
- `bundled-node-runtime`: Standalone Node.js v22 LTS packaging as extraResources, platform-specific binary selection, PATH management for spawned processes
- `dependency-installer`: Runtime detection and installation of pi and openspec CLIs via bundled npm, managed install location (`~/.pi-dashboard/node_modules/`), version checking
- `first-run-wizard`: Welcome screen with dependency status, API key configuration, progress indicators during installation
- `electron-build-pipeline`: electron-forge/electron-builder configuration, node-pty native rebuild, CI matrix for macOS/Linux/Windows, code signing, auto-updater
- `dependency-auto-update`: Periodic outdated check for pi/openspec, user prompt for updates, background installation
- `mdns-discovery`: Server advertises `_pi-dashboard._tcp` via `bonjour-service` on startup. Bridge extensions and Electron browse for the service to find the server. Localhost preferred, remote servers discovered in background. Fallback to config-based probe + health check when mDNS is unavailable.
- `server-selector`: Dashboard header UI component showing all discovered servers (local + LAN). Displays hostname, port, connection status. Switching servers re-establishes the WebSocket connection to the selected server's address. Persists last-used server in config.

### Modified Capabilities
- `process-manager`: Electron builds force headless spawn strategy, skip tmux detection
- `shared-config`: New `electronMode` flag to distinguish Electron vs CLI server startup. New `lastServer` field to persist selected server address.
- `server-process-management`: Replace bare TCP port probe (`isPortOpen`) with mDNS discovery as primary mechanism, `/api/health` identity verification as fallback. Shared across bridge auto-start, CLI status/start, and Electron startup. Detects port occupied by another service without false positives.
- `bridge-extension`: Discovery logic changes from `isPortOpen(config.piPort)` to mDNS browse → fallback probe. Connection target resolved dynamically instead of hardcoded from config.

## Impact

- **New top-level directory**: `electron/` for main process entry, preload scripts, forge config
- **New shared module**: `src/shared/mdns-discovery.ts` — advertise/browse/stop helpers used by server, bridge, and Electron
- **New dependency**: `bonjour-service` (~67KB, pure JS, 2 transitive deps: `multicast-dns`, `fast-deep-equal`)
- **Build tooling**: `electron-forge` or `electron-builder` added as dev dependencies
- **CI**: New GitHub Actions workflow for cross-platform Electron builds
- **Native addons**: `node-pty` must be rebuilt per platform+arch in CI (not at user install time)
- **Bundle size**: ~250MB per platform (Electron ~150MB + Node.js ~80MB + app ~15MB + node-pty ~2MB)
- **Server advertises on mDNS**: existing servers gain mDNS advertisement on startup (backwards compatible — old bridges still use config-based probe)
- **Bridge discovery upgraded**: bridge uses mDNS first, falls back to config probe (backwards compatible with servers that don't advertise)
- **New UI element**: server selector dropdown in dashboard header (web + Electron)
- **No breaking changes**: Existing `pi-dashboard` CLI, bridge extension, and web client continue to work. mDNS is additive — all existing config-based flows are preserved as fallback.
