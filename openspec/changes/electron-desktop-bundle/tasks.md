## 1. Config Changes

- [ ] 1.1 Add `electronMode` field to `DashboardConfig` in `packages/shared/src/config.ts` with default `false`
- [ ] 1.2 Update `packages/server/src/process-manager.ts` to force headless when `electronMode` is true
- [ ] 1.3 Add `~/.pi-dashboard/node_modules/.bin` to PATH in spawned process env in `packages/server/src/process-manager.ts`
- [ ] 1.4 Write tests for new config field and electron-mode spawn override

## 2. Electron Workspace Setup

- [ ] 2.1 Create `packages/electron/` workspace with `package.json` (deps: `electron`, `@electron-forge/cli`, `@electron-forge/plugin-vite`, `electron-updater`, shared workspace dep)
- [ ] 2.2 Register workspace in root `package.json` `workspaces` array
- [ ] 2.3 Create `packages/electron/forge.config.ts` with makers for macOS (dmg universal), Linux (deb, AppImage), Windows (squirrel)
- [ ] 2.4 Create `packages/electron/src/main.ts` entry point (stub)
- [ ] 2.5 Create `packages/electron/src/preload.ts`
- [ ] 2.6 Add npm scripts to root: `electron:dev`, `electron:make`, `electron:start`

## 3. Dependency Installer Module

- [ ] 3.1 Create `packages/electron/src/lib/dependency-detector.ts` — `detectPi()`, `detectOpenSpec()`, `detectDashboardPackage()`, `detectSystemNode()` with system PATH → managed install detection chain
- [ ] 3.2 Create `packages/electron/src/lib/dependency-installer.ts` — `installStandalone()` (pi + dashboard + openspec + tsx into `~/.pi-dashboard/`), `installDashboardGlobal()` (for power user mode)
- [ ] 3.3 Create `packages/electron/src/lib/bundled-node.ts` — `getBundledNodePath()`, `getBundledNpmPath()` resolving extraResources paths
- [ ] 3.4 Create `packages/electron/src/lib/ts-loader-resolver.ts` — `resolveTsLoader(mode)` returning tsx path (standalone) or jiti-first-then-tsx (power user)
- [ ] 3.5 Write tests for detection, installation, and TS loader resolution

## 4. First-Run Wizard

- [ ] 4.1 Create `packages/electron/src/renderer/FirstRunWizard.tsx` — multi-step wizard component (mode selection → install/verify → API key → done)
- [ ] 4.2 Implement mode selection step: "Set up everything for me" (standalone) vs "Use my existing pi" (power user)
- [ ] 4.3 Implement standalone install step — progress indicators for pi, dashboard, openspec, tsx
- [ ] 4.4 Implement power user verification step — check pi, openspec, dashboard bridge; offer to fix gaps
- [ ] 4.5 Implement API key configuration step — write to `~/.pi/agent/settings.json`, skip if already configured
- [ ] 4.6 Add first-run detection logic: check `~/.pi-dashboard/mode.json` presence
- [ ] 4.7 Persist mode to `~/.pi-dashboard/mode.json` on completion
- [ ] 4.8 Wire wizard into Electron main process — show wizard window before dashboard if first-run detected

## 5. Electron Shell

- [ ] 5.1 Implement `packages/electron/src/main.ts` — single-instance lock, server detection (mDNS via `@blackbelt-technology/pi-dashboard-shared/mdns-discovery` → fallback to `isDashboardRunning()`), launch server if needed, BrowserWindow creation pointing at server URL
- [ ] 5.2 Implement window state persistence (size, position) across restarts
- [ ] 5.3 Implement system tray — minimize to tray on window close, tray icon with "Show" and "Quit" menu, reopen window on tray click
- [ ] 5.4 Implement `app.quit()` (via tray "Quit") — optionally stop server if Electron started it
- [ ] 5.5 Add `ELECTRON_DEV` mode — skip server discovery, point at `http://localhost:8000`
- [ ] 5.6 Write tests for main process lifecycle logic

## 6. Dependency Auto-Update

- [ ] 6.1 Create `packages/electron/src/lib/update-checker.ts` — check `npm outdated` for pi and openspec, return available versions
- [ ] 6.2 Implement 24-hour check interval with on-launch trigger
- [ ] 6.3 Create update notification UI component in dashboard (non-blocking banner with "Update" button)
- [ ] 6.4 Implement update execution — run `npm install <package>@latest` using appropriate npm (system vs managed)
- [ ] 6.5 Write tests for update detection and execution

## 7. Build Pipeline

- [ ] 7.1 Add Node.js binary download script for build — fetch correct platform binary, strip to node + npm only
- [ ] 7.2 Configure `extraResources` in forge config to include stripped Node.js binary per platform
- [ ] 7.3 Create GitHub Actions workflow: build matrix (macOS universal, ubuntu-latest x64, windows-latest x64), produce artifacts
- [ ] 7.4 Configure macOS code signing (Apple Developer ID) in CI (Windows signing deferred)
- [ ] 7.5 Test packaged app on each platform — verify server launch, pi install, wizard flow

## 8. App Auto-Updater

- [ ] 8.1 Add `electron-updater` dependency (already in workspace setup)
- [ ] 8.2 Configure `electron-updater` with GitHub Releases as update source in `forge.config.ts`
- [ ] 8.3 Implement update check on launch + periodic check (every 24h)
- [ ] 8.4 Create update notification UI — non-blocking banner with "Download & Restart" button
- [ ] 8.5 Write tests for update check and download flow
