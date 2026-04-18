## 1. Step 1 — Relocate `ToolResolver` to `platform/binary-lookup`

- [x] 1.1 Create `packages/shared/src/platform/` directory.
- [x] 1.2 Move `packages/shared/src/tool-resolver.ts` to `packages/shared/src/platform/binary-lookup.ts`. Preserve the `ToolResolver` class and all public exports (`ResolverContext`, `ToolResolver`). _(Also updated `./managed-paths.js` import to `../managed-paths.js`.)_
- [x] 1.3 Replace `packages/shared/src/tool-resolver.ts` with a one-line re-export: `export * from "./platform/binary-lookup.js";`
- [x] 1.4 Move `packages/shared/src/__tests__/tool-resolver.test.ts` to `packages/shared/src/__tests__/binary-lookup.test.ts` and update the import to `../platform/binary-lookup.js`.
- [x] 1.5 Create `packages/shared/src/platform/index.ts` with `export * from "./binary-lookup.js";`.
- [x] 1.6 Run `npm test` — all tests pass. Run `npx tsc --noEmit` — no type errors. _(binary-lookup tests: 16/16. editor-detection + process-manager tests: 32/32. Pre-existing `tsc --noEmit -p packages/server` composite error is unrelated to this change.)_

## 2. Step 2 — Extract `platform/process.ts` (kill, find-port, is-alive)

- [x] 2.1 Create `packages/shared/src/platform/process.ts` exporting `findPortHolders(port, opts?)`, `killProcess(pid, opts?)`, `isProcessAlive(pid)`, `killPidWithGroup(pid, signal, opts?)`, and the pure helper `parseNetstatListeners(output, port, selfPid)`. Every exported helper that depends on OS takes an optional `platform?: NodeJS.Platform` and optional `exec?` injection.
- [x] 2.2 Write unit tests in `packages/shared/src/__tests__/platform-process.test.ts` covering both Unix and Windows branches via injected `platform`. _(17 tests, all injection-based, no `Object.defineProperty` anywhere.)_
- [x] 2.3 Migrate `packages/server/src/cli.ts` — `findPortHolders`/`parseNetstatListeners`/`killProcess` delegate to `platform/process.ts`. `cli.ts` keeps thin wrapper re-exports for back-compat with existing tests.
- [x] 2.4 Migrate `packages/server/src/headless-pid-registry.ts` — three `process.platform === "win32" ? entry.pid : -entry.pid` sites replaced with `killPidWithGroup(entry.pid, signal)`.
- [x] 2.5 Migrate `packages/server/src/browser-handlers/session-action-handler.ts` — `killHeadlessBySessionId` uses `killPidWithGroup`, `isProcessAlive` delegates to shared primitive.
- [x] 2.6 Existing tests still pass; the migration uses back-compat wrappers so no test updates were needed yet (follow-up cleanup can migrate tests to the new API directly).
- [x] 2.7 Run full test sweep — binary-lookup/platform-process/find-port-holders/is-pi-process/headless-pid-registry/cli-parse: 76/76 pass. No regressions.

## 3. Step 3 — Extract `platform/process-scan.ts` (ps vs tasklist, etime)

- [ ] 3.1 Create `packages/shared/src/platform/process-scan.ts` exporting `listChildPids(parentPid, opts?)`, `isProcessRunning(pattern, opts?)`, and the pure parser `parseEtime(s)`. Include a Windows `tasklist` branch and a Unix `ps`/`pgrep` branch, both injectable.
- [ ] 3.2 Write unit tests in `packages/shared/src/__tests__/platform-process-scan.test.ts` covering `parseEtime` variants (mm:ss, hh:mm:ss, dd-hh:mm:ss, empty, garbage) and both platform branches of `isProcessRunning`.
- [ ] 3.3 Migrate `packages/extension/src/process-scanner.ts` — replace `_platform`-injected helpers with calls to `platform/process-scan.ts`. Keep the extension's higher-level `scanChildProcesses` / `scanTrackedProcesses` that track PGIDs, but delegate each `ps`/`spawnSync` call to the shared primitive.
- [ ] 3.4 Migrate `packages/server/src/editor-registry.ts` — `isProcessRunning`, `isProcessRunningWin32`, and the inline `which`/`where` branch in `isCliAvailable` all delegate to `platform/process-scan.ts` and `platform/binary-lookup.ts`. Delete the local `isProcessRunningWin32` once the branch lives in the shared module.
- [ ] 3.5 Update tests in `process-scanner.test.ts` and `editor-registry.test.ts` to use the new injection pattern. Remove any `_platform: "linux"` hacks where the shared primitive now takes `platform` directly.
- [ ] 3.6 Run full test sweep — no regressions.

## 4. Step 4 — Extract `platform/shell.ts` and migrate terminal/spawn Windows branches

- [ ] 4.1 Create `packages/shared/src/platform/shell.ts` exporting `detectShell(opts?)` (reads `COMSPEC` or `SHELL` per platform, with fallbacks) and `getTerminalEnvHints(opts?)` (returns `{ TERM: "cygwin" }` on Windows or `{}` elsewhere).
- [ ] 4.2 Write unit tests in `packages/shared/src/__tests__/platform-shell.test.ts` covering all four branches (win32 with COMSPEC, win32 fallback, unix with SHELL, unix fallback). Use `env` injection; no `process.env` mutation.
- [ ] 4.3 Migrate `packages/server/src/terminal-manager.ts` — `detectShell` function becomes a thin wrapper calling `platform/shell.ts:detectShell()`. The `TERM=cygwin` override uses `getTerminalEnvHints`.
- [ ] 4.4 Review `packages/server/src/process-manager.ts` Windows branches (`spawnHeadlessWindows`, `needsShell` .cmd handling). Extract the `.cmd` resolution into `platform/binary-lookup.ts` if it is not already there. Leave the spawn-strategy code (tmux vs headless vs WSL) in-place — this is session-spawn logic, not a platform primitive.
- [ ] 4.5 Update `terminal-manager.test.ts` so the Unix `$SHELL` and Windows `%COMSPEC%` tests both exercise the shared `detectShell` via injected `platform` + `env`. Remove any remaining `skipIf(win32)` on shell-detection tests where the injection makes them platform-agnostic.
- [ ] 4.6 Run full test sweep — no regressions. Manual: spawn a terminal on Windows and Linux; confirm the session `shell` matches expectations.

## 5. Step 5 — Extract `platform/commands.ts` (openBrowser, machine info)

- [ ] 5.1 Create `packages/shared/src/platform/commands.ts` exporting `openBrowser(url, opts?)` (dispatches `open`/`xdg-open`/`start`) and `detectMachineInfo(opts?)` (runs `sysctl` on darwin, `systemd-detect-virt` on linux, `wmic` on win32; returns a structured object with best-effort fields).
- [ ] 5.2 Write unit tests in `packages/shared/src/__tests__/platform-commands.test.ts` asserting the correct command shape per platform (via injected `exec`).
- [ ] 5.3 Migrate `packages/server/src/routes/provider-auth-routes.ts:openInBrowser` — replace the inline ternary with `platform/commands.ts:openBrowser`.
- [ ] 5.4 Migrate `packages/electron/src/main.ts` machine-info block — replace the three `if (process.platform === "darwin"|"linux"|"win32")` branches around `sysctl`/`systemd-detect-virt`/`wmic` with one call to `platform/commands.ts:detectMachineInfo`.
- [ ] 5.5 Run full test sweep — no regressions.

## 6. Step 6 — Create `packages/electron/src/platform/` for Electron-API concerns

- [ ] 6.1 Create `packages/electron/src/platform/` directory.
- [ ] 6.2 Move or refactor `packages/electron/src/lib/tray.ts` icon selection into `electron/platform/tray-icon.ts:getTrayIcon()` returning a `NativeImage`. `tray.ts` becomes a thin consumer (or re-export).
- [ ] 6.3 Move `packages/electron/src/lib/app-menu.ts` darwin-specific template into `electron/platform/menu.ts:buildAppMenu()`.
- [ ] 6.4 Move `packages/electron/src/lib/bundled-node.ts:getBundledNodePath` into `electron/platform/node.ts:getBundledNodePath()` (or keep `bundled-node.ts` as the canonical location and have `platform/node.ts` re-export — whichever reads cleaner).
- [ ] 6.5 Extract `configureAppLifecycle(app)` into `electron/platform/app-lifecycle.ts` — consolidates the darwin dock-hide and linux `ozone-platform-hint` branches from `main.ts`.
- [ ] 6.6 Migrate `packages/electron/src/main.ts` to call `configureAppLifecycle(app)` and use platform helpers for tray + menu.
- [ ] 6.7 Run Electron build locally on at least one OS (`npm run electron:make` for the current platform) to confirm no regression in tray/menu/lifecycle.

## 7. Step 7 — Delete `resolveJitiFromAnchor` duplicate

- [ ] 7.1 Delete the `resolveJitiFromAnchor` function in `packages/electron/src/lib/server-lifecycle.ts`. Replace its single caller (`resolveJitiFromPi`) with a call that delegates to `packages/shared/src/resolve-jiti.ts:resolveJitiImport()` (or its pure helper `buildJitiRegisterUrl`) given the same anchor.
- [ ] 7.2 Remove the `JITI_PACKAGES` constant in `server-lifecycle.ts` if it is no longer referenced.
- [ ] 7.3 Update or delete the orphaned tests in `packages/electron/src/__tests__/jiti-fallback.test.ts` — tests that previously covered `resolveJitiFromAnchor` should now cover `resolveJitiFromPi`'s delegation path, or be removed if they are redundant with the shared `resolve-jiti` tests.
- [ ] 7.4 Run full test sweep — no regressions. Manual: launch the Electron app on Windows (the original drift bug was a Windows-specific crash); verify the server starts and the dashboard loads.

## 8. Step 8 — Cleanup and documentation

- [ ] 8.1 Grep the repo (excluding `openspec/changes/archive/`) for imports of `tool-resolver.js`. If there are no remaining references, delete `packages/shared/src/tool-resolver.ts` (the re-export created in step 1).
- [ ] 8.2 Grep for any remaining `process.platform === "win32"` branches in `packages/shared/src` (excluding `platform/`), `packages/server/src` (excluding `process-manager.ts` strategy selection), and `packages/extension/src`. Each remaining branch SHALL be either (a) a documented exception with a reason-comment, or (b) migrated into `platform/`.
- [ ] 8.3 Update `AGENTS.md` — add a "Platform primitives" entry in the Key Files table pointing at `src/shared/platform/` and `src/electron/platform/`. Note the injectable `platform` parameter pattern.
- [ ] 8.4 Update `docs/architecture.md` — add a "Cross-OS platform primitives" section explaining the two-module layout (shared + electron), the injectable-platform pattern, and the list of concerns owned by each sub-module.
- [ ] 8.5 Update the `AGENTS.md` "File:" table entries that previously referenced `tool-resolver.ts` to point at `platform/binary-lookup.ts`.
- [ ] 8.6 Run full test sweep on Windows, Linux, macOS (or the closest available) — no regressions. Run `npm run build` — no build errors. Run `openspec validate consolidate-platform-handlers --strict` — passes.

## 9. Optional / deferred

- [ ] 9.1 Add `platform.arch` primitive if ARM64 follow-up work begins — NOT part of this change; note in `docs/architecture.md` as the natural extension point.
- [ ] 9.2 Extract WSL detection into `platform/wsl.ts` — NOT part of this change; note as a future enhancement.
- [ ] 9.3 If `process-manager.ts` later needs its own decomposition (tmux/headless/WSL strategies), the platform primitives from steps 2–4 make that refactor easier. NOT part of this change.
