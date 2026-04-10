## 1. Config Changes

- [ ] 1.1 Add `electronMode` field to `DashboardConfig` in `packages/shared/src/config.ts` with default `false`
- [ ] 1.2 Update `packages/server/src/process-manager.ts` to force headless when `electronMode` is true
- [ ] 1.3 Add `~/.pi-dashboard/node_modules/.bin` to PATH in spawned process env in `packages/server/src/process-manager.ts`
- [ ] 1.4 Write tests for new config field and electron-mode spawn override

## 2. Windows Platform Fixes

- [ ] 2.1 Update `packages/server/src/terminal-manager.ts` shell detection — use `process.env.COMSPEC` or `powershell.exe` on Windows instead of `/bin/bash`
- [ ] 2.2 Write tests for cross-platform shell detection (darwin, linux, win32)
- [ ] 2.3 Implement Windows process scanning in `packages/extension/src/process-scanner.ts` — use `wmic process` or `tasklist` to find child processes, `taskkill /T /F` for kill
- [ ] 2.4 Write tests for Windows process scanning and kill (mocked)
- [ ] 2.5 Add `win32` key to editor registry process patterns in `packages/server/src/editor-registry.ts` — VS Code (`code.cmd`, `%LOCALAPPDATA%`), IntelliJ (`idea64.exe`)
- [ ] 2.6 Write tests for Windows editor detection

## 3. Electron Workspace Setup

- [ ] 3.1 Create `packages/electron/` workspace with `package.json` (deps: `electron`, `@electron-forge/cli`, `@electron-forge/plugin-vite`, `electron-updater`, shared workspace dep)
- [ ] 3.2 Register workspace in root `package.json` `workspaces` array
- [ ] 3.3 Create `packages/electron/forge.config.ts` with makers for macOS (dmg universal), Linux (deb, AppImage), Windows (squirrel)
- [ ] 3.4 Create `packages/electron/src/main.ts` entry point (stub)
- [ ] 3.5 Create `packages/electron/src/preload.ts`
- [ ] 3.6 Add npm scripts to root: `electron:dev`, `electron:make`, `electron:start`

## 4. Dependency Installer Module

- [ ] 4.1 Create `packages/electron/src/lib/dependency-detector.ts` — `detectPi()`, `detectOpenSpec()`, `detectDashboardPackage()`, `detectSystemNode()` with system PATH → managed install detection chain
- [ ] 4.2 Create `packages/electron/src/lib/dependency-installer.ts` — `installStandalone()` (pi + dashboard + openspec + tsx into `~/.pi-dashboard/`), `installDashboardGlobal()` (for power user mode)
- [ ] 4.3 Create `packages/electron/src/lib/bundled-node.ts` — `getBundledNodePath()`, `getBundledNpmPath()` resolving extraResources paths
- [ ] 4.4 Create `packages/electron/src/lib/ts-loader-resolver.ts` — `resolveTsLoader(mode)` returning tsx path (standalone) or jiti-first-then-tsx (power user)
- [ ] 4.5 Write tests for detection, installation, and TS loader resolution

## 5. First-Run Wizard

- [ ] 5.1 Create `packages/electron/src/renderer/FirstRunWizard.tsx` — multi-step wizard component (mode selection → install/verify → API key → done)
- [ ] 5.2 Implement mode selection step: "Set up everything for me" (standalone) vs "Use my existing pi" (power user)
- [ ] 5.3 Implement standalone install step — progress indicators for pi, dashboard, openspec, tsx
- [ ] 5.4 Implement power user verification step — check pi, openspec, dashboard bridge; offer to fix gaps
- [ ] 5.5 Implement API key configuration step — write to `~/.pi/agent/settings.json`, skip if already configured
- [ ] 5.6 Add first-run detection logic: check `~/.pi-dashboard/mode.json` presence
- [ ] 5.7 Persist mode to `~/.pi-dashboard/mode.json` on completion
- [ ] 5.8 Wire wizard into Electron main process — show wizard window before dashboard if first-run detected

## 6. Electron Shell

- [ ] 6.1 Implement `packages/electron/src/main.ts` — single-instance lock, server detection (mDNS via `@blackbelt-technology/pi-dashboard-shared/mdns-discovery` → fallback to `isDashboardRunning()`), launch server if needed, BrowserWindow creation pointing at server URL
- [ ] 6.2 Implement window state persistence (size, position) across restarts
- [ ] 6.3 Implement system tray — minimize to tray on window close, tray icon with "Show" and "Quit" menu, reopen window on tray click
- [ ] 6.4 Implement `app.quit()` (via tray "Quit") — optionally stop server if Electron started it
- [ ] 6.5 Add `ELECTRON_DEV` mode — skip server discovery, point at `http://localhost:8000`
- [ ] 6.6 Write tests for main process lifecycle logic

## 7. Dependency Auto-Update

- [ ] 7.1 Create `packages/electron/src/lib/update-checker.ts` — check `npm outdated` for pi and openspec, return available versions
- [ ] 7.2 Implement 24-hour check interval with on-launch trigger
- [ ] 7.3 Create update notification UI component in dashboard (non-blocking banner with "Update" button)
- [ ] 7.4 Implement update execution — run `npm install <package>@latest` using appropriate npm (system vs managed)
- [ ] 7.5 Write tests for update detection and execution

## 8. Build Pipeline

- [ ] 8.1 Add Node.js binary download script for build — fetch correct platform binary, strip to node + npm only
- [ ] 8.2 Configure `extraResources` in forge config to include stripped Node.js binary per platform
- [ ] 8.3 Create GitHub Actions workflow: build matrix (macOS universal, ubuntu-latest x64, windows-latest x64), produce artifacts
- [ ] 8.4 Configure macOS code signing (Apple Developer ID) in CI (Windows signing deferred)
- [ ] 8.5 Test packaged app on each platform — verify server launch, pi install, wizard flow

## 9. App Auto-Updater

- [ ] 9.1 Add `electron-updater` dependency (already in workspace setup)
- [ ] 9.2 Configure `electron-updater` with GitHub Releases as update source in `forge.config.ts`
- [ ] 9.3 Implement update check on launch + periodic check (every 24h)
- [ ] 9.4 Create update notification UI — non-blocking banner with "Download & Restart" button
- [ ] 9.5 Write tests for update check and download flow
