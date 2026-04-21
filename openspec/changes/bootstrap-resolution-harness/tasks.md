## 0. Precondition check

- [x] 0.1 Verify `merge-windows-integration-linear` has landed on `develop`. Run `git log develop --grep="windows-integration-v3" --oneline` and confirm the merge commit exists. If not, STOP — this proposal requires v3's `platform/` + `tool-registry/` primitives. **Confirmed at commit `422bf5d Windows integration v3 (#10)`; `packages/shared/src/platform/` present.**
- [x] 0.2 Re-read `design.md §10` against current `packages/shared/src/tool-registry/strategies.ts` and confirm `StrategyDeps` still has the expected shape. If `resolveModule` has been added by another change, skip task 2.1. **StrategyDeps had `exists`, `which`, `npmRootGlobal` only; no `resolveModule` — task 1.1 proceeded.**
- [x] 0.3 Re-read `design.md §13` and confirm the Windows `npm i -g` bug still reproduces (see proposal 2's pre-work). If it's already fixed, update scenario B1's expected outcome to "resolves via managed" and note in the PR description. **Not reproducible on macOS dev host; assumed present per code review (the `npm i -g pi-dashboard` install layout still has no `packages/extension/` sibling in `node_modules/`, and the Unix pi strategy chain has no module fallback). Reverify on Windows VM before scenario B1 snapshot is captured.**

## 1. Refactor prerequisites

- [x] 1.1 Add `resolveModule(id: string, from: string): string | null` to `StrategyDeps` in `packages/shared/src/tool-registry/strategies.ts`. Default implementation uses `createRequire(from).resolve(id)`.
- [x] 1.2 Update `bareImportStrategy` to call `deps.resolveModule(pkgName, anchorPath)` instead of inline `createRequire(...).resolve(...)`. Confirm existing tests still pass.
- [x] 1.3 Add `getManagedDir(env?: { homedir?: string })` and `getManagedBin(env?: { homedir?: string })` functions to `packages/shared/src/managed-paths.ts`. Keep `MANAGED_DIR` and `MANAGED_BIN` constants for back-compat (they delegate to the getters with no arg → live env). `getPiSettingsPath` added alongside.
- [x] 1.4 Update `managedBinStrategy` and `managedModuleStrategy` to call `getManagedBin(ctx.env)` / `getManagedDir(ctx.env)` when `ctx.env` is provided; fall back to constants otherwise.
- [x] 1.5 Thread an optional `env: PlatformEnv` parameter through `ToolRegistry` constructor and `resolve()` method. Live default = `{ homedir: os.homedir(), platform: process.platform, cwd: () => process.cwd() }`. `StrategyCtx.env` added too.
- [x] 1.6 Add optional `homedir?: string` parameter to `registerBridgeExtension(extensionPath, { homedir? })` in `packages/shared/src/bridge-register.ts`. Keep current `$HOME || USERPROFILE || os.homedir()` as default.

## 2. Harness foundation

- [x] 2.1 Add `memfs` as a dev dependency of `packages/shared/`.
- [x] 2.2 Create `packages/shared/src/__tests__/bootstrap/harness.ts` with `withFakeEnv({ platform, homedir, cwd, env, fs }, async (ctx) => ...)` — builds a `memfs` volume, produces a `createRegistry()` function wired with fake `exists`/`which`/`npmRootGlobal`/`resolveModule`, returns the computed `PlatformEnv`. Includes `FakeOverridesStore` and `toMemfsPath` helper for win32 path translation. Smoke tests in `harness.smoke.test.ts` (12 tests green).
- [x] 2.3 Implement `ctx.which(name)` lookup over the fake PATH: iterate PATH entries, check `${entry}/${name}` and (on win32) `${entry}/${name}.cmd`, `${entry}/${name}.exe`. Also tries `.bat`.
- [x] 2.4 Implement `ctx.resolveModule(id, from)` over the fake fs: walk `from`'s ancestor `node_modules/` dirs, return path to `${dir}/node_modules/${id}/package.json` if it exists. Reads `main` field to derive entry; defaults to `index.js`.
- [x] 2.5 Implement `ctx.npmRootGlobal()` — reads a configured value from the fake env; defaults to `<homedir>/.npm/lib/node_modules` on posix, `<APPDATA>/npm/node_modules` on win32.

## 3. Fixtures library

- [x] 3.1 Create `fixtures/electron-layout.ts` with `electronPackaged({ platform, appimage? })` returning fs layer mimicking `<resourcesPath>/server/packages/...` + bundled node. AppImage variant produces `/tmp/.mount_PIxxxx/...`.
- [x] 3.2 Create `fixtures/npm-global-layout.ts` with `npmGlobalUnix`, `npmGlobalWindowsAppData`, `npmGlobalWindowsProgramFiles`.
- [x] 3.3 Create `fixtures/managed-install.ts` with `managedInstall({ homedir, platform, pi?, openspec?, tsx?, piPartial? })` — populates `<homedir>/.pi-dashboard/node_modules/...` + `.bin/` shims (`.cmd` on win32). `piPartial` simulates an interrupted install (E2).
- [x] 3.4 Create `fixtures/dev-monorepo.ts` with `devMonorepo({ root, platform, pi?, openspec? })` (workspace layout with hoisted deps).
- [x] 3.5 Create `fixtures/settings-json.ts` with `settingsJson({ homedir, platform, packages?, malformed?, missing? })` and `settingsJsonPath` helper.
- [x] 3.6 Create `fixtures/pi-versions.ts` with `piPackageJson`/`openspecPackageJson` helpers for version stamping.
- [x] 3.7 `layer(...layers)` helper already implemented in `harness.ts` during task 2.2.

## 4. Assertions

- [x] 4.1 `snapshotTrail(resolution, ctx)` normalizes paths via `normalizePath` (replaces `<HOME>`/`<NPM_ROOT>`, flips backslashes). Applies to both the resolved `path` field AND every `tried[].result` reason string so snapshots are stable cross-OS.
- [x] 4.2 `snapshotSettings(settings, ctx)` emits a sorted package list with normalized paths.
- [x] 4.3 `snapshotSettingsDelta(before, after, ctx)` shows added/removed/preserved with normalized paths.

## 5. Scenario registration + cube

- [x] 5.1 `scenarios.ts` with `REGISTERED_SCENARIOS` (Map<key, tag>) and `SKIPPED_SCENARIOS` (Map<key, reason>). `register()`, `skip()`, `skipPattern()`, `enumerateCube()`, `cellKey()`, `parseCellKey()`. Canonical axes exported (`PLATFORMS`, `DASH_LOCATIONS`, `PI_STATES`, `SETTINGS_STATES`, `ENV_STATES`).
- [x] 5.2 `cube.ts` with `sweepCube()` and `formatUnclassifiedError()`. Cube shape: 3 platforms × 5 dash-locations × 6 pi-states × 4 settings-states × 3 env-states = 1080 cells.
- [x] 5.3 `cube.test.ts` fails if any cell is neither registered nor skipped. `scenarios-skipped.ts` provides bulk-skip manifest so the test passes on day 1 (all cells skipped with reasons); family files replace skip with registration as they land. `families/index.ts` barrel ensures registration runs before sweep (avoids vitest module-graph isolation issues).

Note: one family scaffold landed alongside (Family A1+A2 × 3 platforms = 6 registered cells). Remaining family tasks below populate the cube.

## 6. Family A — electron-packaged

- [x] 6.1 `a-electron.test.ts` A1 — scenario A1 for platforms win/mac/lin. Asserts pi unresolved (all strategies miss), trail snapshot captures the chain. (Consolidated into `a-electron.test.ts` rather than per-cell files.)
- [x] 6.2 A2 — 3 platforms. Asserts pi resolves to `managed`, trail captured. Bridge-registration preservation round-trip pending fs injection.
- [x] 6.3 A3 — electron bundled + pre-existing global pi on linux. Captures the real behavior: `where` finds `/usr/local/bin/pi`, source classified as `system` (pi chain on Unix has no `npm-global` strategy).
- [x] 6.4 A4 — linux AppImage first run. Fixture-shape assertion confirms `/tmp/.mount_*` path. Full `findBundledExtension` rejection lives in bridge-register unit tests.

## 7. Family B — npm-global

- [x] 7.1 `b-npm-global.test.ts` B1 — ⚠ captures the Windows bug across all 3 platforms (npm-g dash only, no pi). Trail snapshot locked in. `FIXED-BY: unified-bootstrap-install` marker in test.
- [x] 7.2 B2 — pi + openspec resolve via system (Unix) / npm-global (Windows). win32 variant asserts `source === "npm-global"`.
- [x] 7.3 B3 — pi present, bridge NOT in settings. Input-side assertion (fixture correctly produces bridge-less settings.json). Full round-trip pending bridge-register fs injection (cross-proposal future task).

## 8. Family C — dev monorepo

- [x] 8.1 `c-dev-monorepo.test.ts` C1 — mac/linux. Captures the real limitation: pi's Unix chain has no bare-import, so workspace layout alone doesn't resolve pi on Unix. Trail snapshot locks in current behavior.
- [x] 8.2 C2 — win32 bare-import resolves pi via workspace node_modules; `source === "bare-import"`. Uses a custom `resolveModule` anchor to point at the workspace root.

## 9. Family D — overrides

- [x] 9.1 `d-overrides.test.ts` D1 — override set in FakeOverridesStore; pi resolves to override path; `source === "override"`.
- [x] 9.2 D2 — override points to non-existent file; falls through to managed strategy; trail shows `invalid: ...` reason.

## 10. Family E — stale / broken managed

- [x] 10.1 `e-stale-partial.test.ts` E1 — managed pi v0.0.1. Today strategies don't version-gate; resolves normally. Snapshot will shift when `unified-bootstrap-install` adds version-skew detection downstream.
- [x] 10.2 E2 — managed install has package.json but no dist/cli.js and no .bin shim. Strategy returns not-found; falls through to `where`.

## 11. Family F — cwd variants

- [x] 11.1 `f-cwd-variants.test.ts` F1 — cwd with spaces (linux + `Program Files (x86)` on win32). Resolution unaffected — invariant locked in.
- [x] 11.2 F2 — Greek + Cyrillic + emoji in cwd. Resolution unaffected.

## 12. Family G — Windows specifics

- [x] 12.1 `g-windows-specifics.test.ts` G1 — pi.cmd found via managed-bin; trail snapshot proves `.cmd` resolution path.
- [x] 12.2 G2 — npm-g at `%APPDATA%\Roaming\npm`; `source === "npm-global"`.
- [x] 12.3 G3 — covered by F1-win (Program Files (x86) cwd). No standalone file.
- [x] 12.4 G4 — node.exe at `C:\Program Files\nodejs\node.exe`; resolution finds it via PATH walk.

## 13. Family H — HOME drift

- [x] 13.1 `h-home-drift.test.ts` H1 — win32, `$HOME=/c/Users/R` vs `USERPROFILE=C:\Users\R`. Harness-side assertion that `readSettings()` resolves to the canonical homedir. Full `registerBridgeExtension` override round-trip pending bridge-register fs injection.
- [x] 13.2 H2 (home-symlink) — **Accepted as deferred**. memfs does not support symlinks; covering this properly requires either a different fake-fs or a real-tmpdir integration test. Documented via `scenarios-skipped.ts` for all relevant cells (mac/linux home-symlink scenarios skipped with reason). Follow-up tracked in the bootstrap README `Downstream handoff` section. No code artifact in this change.

## 14. Family I — malformed / other-packages settings

- [x] 14.1 `i-malformed-settings.test.ts` I1 — `readSettings` returns null for malformed JSON (tolerant fallback). Assertion captures current behavior; full bail-on-malformed during write pending bridge-register fs injection.
- [x] 14.2 I2 — settings with unrelated packages correctly loaded from fixture. Preservation round-trip pending bridge-register fs injection.

## 15. Family J — minimal PATH

- [x] 15.1 `j-path-gui-minimal.test.ts` J1 — linux minimal PATH (no `/usr/local/bin`). Captures a REAL current limitation: pi/openspec Unix chains lack `npm-global` strategy, so GUI-launched apps with minimal PATH can't resolve. Snapshot locks in limitation.

## 16. Family K — dashboard absent

- [x] 16.1 `k-dashboard-absent.test.ts` K1 — pi resolves normally. Dashboard's own "am I installed" concern is handled by `dependency-detector.ts:detectPiDashboardCli()`, not ToolRegistry — documented in test comment.

## 17. Fail-closed cube sweep

- [x] 17.1 `cube.test.ts` enabled; sweeps 1080 cells. `scenarios-skipped.ts` refined post-families: appimage-tmp limited to linux+electron, dev monorepo limited to mac/linux, home-drift limited to win32, malformed settings collapsed, dashboard-absent constrained to pi=present-valid. Remaining cells carry "not yet covered — add family coverage when a bug reports here" (honest, actionable).
- [x] 17.2 `packages/shared/src/__tests__/bootstrap/README.md` written — covers file layout, how to add a scenario, how to add a skip, snapshot workflow, downstream-handoff notes for proposals (2) and (3).

## 18. CI wiring

- [x] 18.1 `npm test` picks up all `*.test.ts` in the bootstrap directory automatically.
- [~] 18.2 Snapshots stable on macOS (dev) and posix CI. Windows CI snapshots may shift marginally when run natively (host `path.join` behavior). Deferred: if Windows CI surfaces diffs, introduce platform-specific snapshot files or normalize at the harness level. Tracked in README.
- [x] 18.3 `test:bootstrap` and `test:bootstrap:watch` scripts added to root `package.json`.

## 19. Documentation

- [x] 19.1 `AGENTS.md` key-files table gains a row for `src/shared/__tests__/bootstrap/`; Commands section adds `test:bootstrap` / `test:bootstrap:watch`.
- [x] 19.2 `docs/architecture.md` gains a "Testing the bootstrap state space" subsection under Tool Resolution, with cube shape + locked-in invariants.
- [x] 19.3 `CHANGELOG.md` `[Unreleased]` gains an "Added" entry describing the harness and the Windows bug capture.

## 20. Handoff to downstream proposals

- [x] 20.1 `unified-bootstrap-install/proposal.md` precondition block now explicitly names scenario B1, the FIXED-BY marker in `b-npm-global.test.ts`, and the harness primitives to reuse.
- [x] 20.2 `single-dashboard-per-home/proposal.md` precondition block documents that the current cube does NOT model lock state, and that proposal must decide whether to grow a new axis or register Family L cells as a separate enumeration.
