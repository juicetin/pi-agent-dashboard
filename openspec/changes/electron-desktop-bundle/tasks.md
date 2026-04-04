## 1. Shared mDNS Discovery Module

- [ ] 1.1 Add `bonjour-service` dependency to `package.json`
- [ ] 1.2 Create `src/shared/mdns-discovery.ts` with `advertiseDashboard(port, piPort)`, `stopAdvertising()`, `discoverDashboard(timeout)`, and `createBrowser()` (continuous browsing with `server-up`/`server-down` events)
- [ ] 1.3 Create `src/shared/server-identity.ts` with `isDashboardRunning(port)` health-check function returning `{ running, pid?, portConflict? }`
- [ ] 1.4 Write tests for mDNS advertise/discover and health-check identity verification

## 2. Server mDNS Integration

- [ ] 2.1 Add mDNS advertisement to `src/server/server.ts` — call `advertiseDashboard()` on startup, `stopAdvertising()` on shutdown
- [ ] 2.2 Add continuous mDNS browser to server — browse for peer `_pi-dashboard._tcp` services, maintain discovered servers list
- [ ] 2.3 Add `servers_discovered` and `servers_updated` browser-protocol messages to `src/shared/browser-protocol.ts`
- [ ] 2.4 Broadcast discovered peer servers to browsers via `servers_discovered` on subscribe and `servers_updated` on change
- [ ] 2.5 Write tests for server mDNS advertisement and peer discovery broadcasting

## 3. Server Identity & Detection Upgrade

- [ ] 3.1 Replace `isPortOpen()` with `isDashboardRunning()` in `src/server/server-pid.ts` (`isServerRunning` function)
- [ ] 3.2 Replace `isPortOpen()` with `isDashboardRunning()` in `src/server/cli.ts` (`cmdStart`, `cmdStatus`)
- [ ] 3.3 Add port conflict error message to `cmdStart` when port is occupied by another service
- [ ] 3.4 Add mDNS discovery to `pi-dashboard status` command (mDNS first, fallback to PID+health)
- [ ] 3.5 Write tests for updated server detection logic

## 4. Bridge mDNS Discovery

- [ ] 4.1 Update `src/extension/server-auto-start.ts` to use mDNS browse → fallback to `isDashboardRunning()` → auto-start
- [ ] 4.2 Update `src/extension/bridge.ts` connection logic to use discovered server address instead of hardcoded config port
- [ ] 4.3 After auto-starting server, wait for mDNS advertisement before connecting (up to 10s, fallback to config probe)
- [ ] 4.4 Write tests for bridge mDNS discovery and fallback

## 5. Config Changes

- [ ] 5.1 Add `electronMode`, `lastServer` fields to `DashboardConfig` in `src/shared/config.ts` with defaults
- [ ] 5.2 Update `spawnStrategy` default from `"tmux"` to `"headless"` and invalid-value fallback
- [ ] 5.3 Update `process-manager.ts` to force headless when `electronMode` is true
- [ ] 5.4 Add `~/.pi-dashboard/node_modules/.bin` to PATH in spawned process env in `process-manager.ts`
- [ ] 5.5 Write tests for new config fields and electron-mode spawn override

## 6. Server Selector UI

- [ ] 6.1 Create `src/client/components/ServerSelector.tsx` — dropdown in dashboard header showing discovered servers with hostname, port, Local/Remote badge, connection status
- [ ] 6.2 Add WebSocket message handler for `servers_discovered` and `servers_updated` in `src/client/hooks/useMessageHandler.ts`
- [ ] 6.3 Implement server switching: close current WebSocket, open new connection to selected server, re-subscribe
- [ ] 6.4 Persist last-used server in `localStorage` (`pi-dashboard-last-server`) and reconnect on load
- [ ] 6.5 Integrate `ServerSelector` into sidebar/header layout
- [ ] 6.6 Write tests for server selector state management and switching logic

## 7. Dependency Installer Module

- [ ] 7.1 Create `electron/lib/dependency-detector.ts` — `detectPi()`, `detectOpenSpec()`, `detectSystemNode()` functions with system PATH → managed install detection chain
- [ ] 7.2 Create `electron/lib/dependency-installer.ts` — `installPi()`, `installOpenSpec()` using system npm or bundled npm fallback, targeting `~/.pi-dashboard/`
- [ ] 7.3 Create `electron/lib/bundled-node.ts` — `getBundledNodePath()`, `getBundledNpmPath()` resolving extraResources paths
- [ ] 7.4 Write tests for detection and installation logic

## 8. First-Run Wizard

- [ ] 8.1 Create `electron/renderer/FirstRunWizard.tsx` — multi-step wizard component (dependency check → install → API key → done)
- [ ] 8.2 Implement dependency status step with progress indicators per tool
- [ ] 8.3 Implement API key configuration step — write to `~/.pi/agent/settings.json`
- [ ] 8.4 Add first-run detection logic: check pi + openspec + API key presence
- [ ] 8.5 Wire wizard into Electron main process — show wizard window before dashboard if first-run detected

## 9. Electron Shell

- [ ] 9.1 Create `electron/` directory structure: `main.ts`, `preload.ts`, `forge.config.ts`
- [ ] 9.2 Implement `electron/main.ts` — single-instance lock, server discovery (mDNS → fallback → launch), BrowserWindow creation pointing at server URL
- [ ] 9.3 Implement window state persistence (size, position) across restarts
- [ ] 9.4 Implement system tray — minimize to tray on window close, tray icon with "Show" and "Quit" menu, reopen window on tray click
- [ ] 9.5 Implement `app.quit()` (via tray "Quit") — optionally stop server if Electron started it
- [ ] 9.6 Add `ELECTRON_DEV` mode — skip server discovery, point at `http://localhost:8000`
- [ ] 9.7 Write tests for main process lifecycle logic

## 10. Dependency Auto-Update

- [ ] 10.1 Create `electron/lib/update-checker.ts` — check `npm outdated` for pi and openspec, return available versions
- [ ] 10.2 Implement 24-hour check interval with on-launch trigger
- [ ] 10.3 Create update notification UI component in dashboard (non-blocking banner with "Update" button)
- [ ] 10.4 Implement update execution — run `npm install <package>@latest` using appropriate npm (system vs managed)
- [ ] 10.5 Write tests for update detection and execution

## 11. Build Pipeline

- [ ] 11.1 Add Electron dev dependencies: `electron`, `@electron-forge/cli`, `@electron-forge/plugin-vite`, `@electron/rebuild`, platform makers
- [ ] 11.2 Configure `forge.config.ts` with makers for macOS (dmg universal), Linux (deb, AppImage), Windows (squirrel)
- [ ] 11.3 Add Node.js binary download script for build — fetch correct platform binary, strip to node + npm only
- [ ] 11.4 Configure `extraResources` to include stripped Node.js binary per platform
- [ ] 11.5 Add npm scripts: `electron:dev`, `electron:make`, `electron:start`
- [ ] 11.6 Create GitHub Actions workflow: build matrix (macOS universal, ubuntu-latest x64, windows-latest x64), produce artifacts
- [ ] 11.7 Configure macOS code signing (Apple Developer ID) in CI (Windows signing deferred)
- [ ] 11.8 Test packaged app on each platform — verify server launch, pi install, wizard flow

## 12. App Auto-Updater

- [ ] 12.1 Add `electron-updater` dependency
- [ ] 12.2 Configure `electron-updater` with GitHub Releases as update source in `forge.config.ts`
- [ ] 12.3 Implement update check on launch + periodic check (every 24h)
- [ ] 12.4 Create update notification UI — non-blocking banner with "Download & Restart" button
- [ ] 12.5 Write tests for update check and download flow
