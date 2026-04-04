## Context

The pi-dashboard is a three-component system: bridge extension (runs inside pi sessions), Node.js server (HTTP + dual WebSocket), and React web client. Currently it's distributed as an npm package requiring manual installation of Node.js, pi, and openspec. The server is started via CLI (`pi-dashboard start`) or auto-launched by the bridge extension. Server discovery uses a hardcoded port from `~/.pi/dashboard/config.json` with bare TCP probes.

The goal is to package this as a standalone Electron desktop app that works on a fresh machine, while preserving the existing CLI/browser workflow. Server discovery needs to become more robust — both to support Electron and to fix pre-existing issues with port collision detection.

## Goals / Non-Goals

**Goals:**
- Single-click install desktop app for macOS, Linux, Windows
- Zero prerequisites on a fresh machine — bundled Node.js bootstraps pi/openspec installation
- Zero-config server discovery via mDNS with LAN awareness
- Server selector UI for switching between local and remote dashboard servers
- Coexistence with the existing CLI + browser workflow
- CI pipeline producing signed installers for all platforms

**Non-Goals:**
- Embedding the pi CLI inside the Electron bundle (pi is installed at runtime via npm)
- Running the dashboard server in-process within Electron (server is always a detached process)
- Replacing the web-based dashboard (Electron is an additional entry point)
- Mobile Electron builds (web/PWA already covers mobile)
- Auto-updating the dashboard app itself (can be added later; initial release uses manual download)

## Decisions

### D1: Electron as smart window, not in-process server

**Decision:** Electron opens a BrowserWindow pointing at `http://localhost:<port>`. The server runs as a separate detached process, identical to `pi-dashboard start`.

**Why:** Running the server in-process means restarting the server requires restarting Electron (losing window state, DevTools). It also creates port conflicts with CLI-started servers and kills all bridge connections when the window closes. A detached server survives Electron quit, matches the existing architecture, and avoids split-brain issues.

**Alternative considered:** In-process server with IPC — rejected because it couples server lifecycle to the window and breaks the "server outlives clients" model that bridges depend on.

### D2: Bundled Node.js for dependency bootstrapping

**Decision:** Ship a standalone Node.js v22 LTS binary as Electron `extraResources`. Use it to `npm install` pi and openspec into `~/.pi-dashboard/node_modules/` at first run.

**Why:** Guarantees the app works on a fresh machine with no prerequisites. System Node.js is detected first and preferred; bundled Node is the fallback.

**Detection order:**
1. `pi` on system PATH → use it
2. `~/.pi-dashboard/node_modules/.bin/pi` exists → use managed install
3. Neither → install via bundled npm: `<bundled-node> <bundled-npm> install @mariozechner/pi-coding-agent` into `~/.pi-dashboard/`

Same flow for openspec.

**Alternative considered:** Require system Node.js — rejected because it's the exact barrier we're trying to eliminate.

**Stripping bundled Node:** Ship only `bin/node` (or `node.exe`) and `lib/node_modules/npm/` — skip man pages, docs, headers, and `corepack`. Reduces ~130MB to ~95MB per platform.

### D3: mDNS zero-config discovery via bonjour-service

**Decision:** The dashboard server advertises `_pi-dashboard._tcp` on mDNS at startup. Bridge extensions, Electron app, and CLI browse for this service to find the server.

**Why:** Eliminates hardcoded port assumptions, enables LAN discovery, and fixes the pre-existing bug where a TCP port probe can't distinguish the dashboard from other services on the same port.

**Library:** `bonjour-service` — pure JavaScript, no native deps, ~67KB, uses `multicast-dns` under the hood. Tested and working.

**Service advertisement TXT record:**
```
{ version: "0.1.0", pid: "<server-pid>", hostname: "<os.hostname()>" }
```

**Fallback:** When mDNS browse returns no results after 2 seconds (Windows firewall, CI, containers), fall back to config-based `localhost:<port>` probe + `GET /api/health` identity check.

**Alternative considered:** Custom UDP broadcast — rejected because mDNS/DNS-SD is a well-established standard with mature tooling.

### D4: Localhost-first with LAN awareness

**Decision:** By default, connect to a localhost server. Remote LAN servers are discovered passively in the background and surfaced in the UI — the user must explicitly choose to switch.

**Why:** Automatic remote connection would be surprising and potentially insecure. The user's local server is almost always what they want. LAN discovery is a power feature for teams sharing dashboards.

**Flow:**
1. mDNS browse finds servers
2. Filter: localhost results preferred
3. If no localhost server → offer to start one
4. Background: continue browsing, populate server list
5. Server selector in header shows all discovered servers

### D5: Server selector as header UI component

**Decision:** A dropdown in the dashboard header showing all discovered servers. Each entry shows hostname, port, and connection status (connected/available/unreachable). Switching re-points both the browser WebSocket and REST API base URL. Last-used server persisted in `localStorage` (client-side) and `config.json` `lastServer` field (for bridge/Electron).

**Why:** Simple, discoverable, non-modal. Follows the pattern of database GUI tools (TablePlus, pgAdmin) that let you switch connections from a header selector.

### D6: electron-forge with Vite plugin

**Decision:** Use `@electron-forge/cli` with `@electron-forge/plugin-vite` for building and packaging. This reuses the existing Vite config for the renderer.

**Why:** electron-forge is Electron's official build tool. The Vite plugin aligns with the project's existing Vite setup. electron-builder is an alternative but has more complex configuration.

**Build targets:**
- macOS: `.dmg` via `@electron-forge/maker-dmg` (universal binary, arm64 + x64 combined)
- Linux: `.deb` + `.AppImage` via makers
- Windows: `.exe` via `@electron-forge/maker-squirrel` (NSIS)

### D7: node-pty native rebuild strategy

**Decision:** Rebuild node-pty against Electron's Node ABI using `@electron/rebuild` as a forge hook. CI builds on platform-specific runners (macOS arm64, macOS x64, Ubuntu x64, Windows x64).

**Why:** node-pty is a C++ addon that must match Electron's ABI. Prebuilt binaries for system Node won't work. `@electron/rebuild` is the standard solution.

**Terminal feature in Electron:** Terminal sessions use node-pty in the **server process** (which runs system Node, not Electron Node). So node-pty only needs rebuilding if the server were running in-process. Since D1 keeps the server as a detached process using system Node, node-pty in the server works as-is. However, Electron's renderer still loads the dashboard client which connects to the server's terminal WebSocket — no rebuild needed for that path.

**Implication:** node-pty rebuild may only be needed if we want terminals to work even when there's no external server (future enhancement). For MVP, the server handles PTY allocation.

### D8: Dependency auto-update check

**Decision:** On app launch (and every 24h while running), check `npm outdated -g @mariozechner/pi-coding-agent` and `npm outdated -g @fission-ai/openspec`. If newer versions exist, show a non-blocking notification in the dashboard with an "Update" button. Update runs `npm install -g <package>@latest` using the same Node/npm that installed it.

**Why:** pi and openspec evolve rapidly. Users of the desktop app may not check for updates manually. A gentle prompt keeps them current without forcing updates.

## Risks / Trade-offs

### [Risk] mDNS blocked by firewall → Mitigation: config-based fallback
Windows Defender and corporate firewalls may block UDP multicast on port 5353. The fallback chain (config port → health check) ensures the app still works. First-run wizard can detect this and note it.

### [Risk] Bundled Node.js version drift → Mitigation: LTS + periodic refresh
Bundled Node v22 LTS is supported until April 2027. pi requires ≥20.6, openspec requires ≥20.19. Shipping v22 provides headroom. App updates can bump the bundled version.

### [Risk] Bundle size ~250MB → Mitigation: acceptable for desktop apps
Comparable to VS Code (~350MB), Cursor (~450MB), Slack (~300MB). Could be reduced by stripping Node docs/headers and using universal binaries on macOS.

### [Risk] Code signing cost → Mitigation: defer Windows EV cert
macOS signing requires Apple Developer ($99/year). Windows EV cert costs $200-400/year and has a complex process. MVP can skip Windows signing (shows "unknown publisher" warning). macOS signing is essential to avoid Gatekeeper rejection.

### [Risk] Two Node.js runtimes (bundled + system) → Mitigation: prefer system
If the user has system Node, use it for everything. Bundled Node is only the bootstrap fallback. Once pi/openspec are installed, the managed install uses whichever Node installed them.

### [Risk] Server selector enables connecting to untrusted servers → Mitigation: localhost default + visual indicator
Remote servers could potentially serve malicious content. The selector shows a clear "Remote" badge and localhost is always the default. Auth (existing OAuth) protects remote servers.

## Resolved Questions

1. **macOS universal binary vs separate builds?** → **Universal binary.** Simpler for users, one download. Size increase is acceptable.

2. **System tray on window close?** → **Yes.** Minimize to system tray, keep server running, quick reopen via tray icon. "Quit" is an explicit tray menu action.

3. **App auto-updater in MVP?** → **Yes.** Use `electron-updater` with GitHub Releases from the start.

4. **spawnStrategy default change?** → **Change to `"headless"` globally** for all users (CLI and Electron). tmux is no longer the default. Existing users with explicit `"tmux"` in config are unaffected.

5. **Windows code signing?** → **Skip for MVP.** Users will see "unknown publisher" warning. macOS signing is included (required for Gatekeeper).
