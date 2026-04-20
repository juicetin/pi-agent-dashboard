## Why

The `windows-integration` branch has diverged from `origin/develop` with ~20 platform/consolidation commits, while develop shipped ~34 feature commits in parallel — including path-picker UX improvements that regressed Windows path handling in four places. Before merging windows-integration into develop, both branches need cleanup so the merged mainline is *strictly better* than either branch alone, and so Robert's develop-side work continues to apply cleanly. This change consolidates every outstanding platform-layer concern into a single coherent landing: fix a console-flash regression introduced by `5ab7956`, shrink the fragmented `platform/` module from 18 files to 5 concern-aligned modules, delete an obsolete Fastify workaround replaced by Node ≥ 22.18, and reconcile path-picker behavior so develop's UX wins survive Windows.

## What Changes

### Fix: Windows console-flash regression in pi-session spawn
- Add `detach?: boolean` option to `SpawnDetachedOptions` (default `true`). When `false`, libuv keeps the child inside the parent's Job Object on Windows — no new console allocated, no flash.
- `spawnHeadlessDetached` in `process-manager.ts` SHALL pass `detach: false` (restoring the behavior of commit `d331850` that was silently overridden by `5ab7956`'s universal `detached:true` invariant).
- Tighten the `useWindowsRedirect` gate in `detached-spawn.ts`: add `&& stdinMode === "ignore"` so the `cmd.exe /d /s /c` redirect path is only taken when `CREATE_NO_WINDOW` can actually fire (all-ignore stdio — libuv sets it only when no stdio slot has `UV_INHERIT_FD`, verified via libuv source).
- **Revert the uncommitted working-tree `logPath` addition** to `spawnHeadlessDetached` — with `stdinMode: "pipe"` it can never trigger `CREATE_NO_WINDOW`; the retrofit is incorrect by design.

### Remove: preload-fastify-cjs workaround (obsolete)
- Delete `packages/server/preload-fastify.cjs`, `packages/shared/src/platform/preload-fastify.ts`, `packages/shared/src/platform/node-version-check.ts`, and their tests.
- Delete four misplaced openspec change folders under `openspec/changes/archive/2026-04-20-*/` (they document a workaround not being shipped).
- Revert uncommitted `--require <preload>` injection edits in `cli.ts`, `server-launcher.ts`, `restart-helper.ts`, `system-routes.ts`, `server-lifecycle.ts`.

### Add: node-guard preflight refuse-to-start
- New `packages/server/src/node-guard.ts` exporting pure `isAffectedNode(version)` + `buildNodeUpgradeMessage(version)`.
- `cli.ts` foreground `runForeground()` and `cmdStart()` SHALL refuse to start on Node v22.0–22.17 or v24.1–24.2, printing a clear upgrade message and exiting with code 1.
- `packages/server/package.json` SHALL declare `"engines": { "node": ">=22.18.0" }`.

### Consolidate: `packages/shared/src/platform/` from 18 files to 5
- Merge `exec.ts` + `subprocess-adapter.ts` + `detached-spawn.ts` + `spawn-mechanism.ts` → **`spawn.ts`** (~950 LOC)
- Merge `process.ts` + `process-scan.ts` + `process-identify.ts` → **`process.ts`** (~390 LOC; same filename, broader scope)
- Merge `binary-lookup.ts` + `runner.ts` + `git.ts` + `openspec.ts` + `npm.ts` → **`tools.ts`** (~1,080 LOC)
- `paths.ts` — unchanged (276 LOC, already cohesive)
- Merge `commands.ts` + `shell.ts` → **`system.ts`** (~144 LOC)
- Update `platform/index.ts` barrel to re-export the 5 modules.
- Update every importing file across `packages/*/src/` to the new paths.
- Update `packages/shared/src/__tests__/no-direct-child-process.test.ts` allowlist to the new 5-file structure.

### Reconcile: absorb develop's path-picker UX while keeping Windows correctness
- `packages/server/src/browse.ts`: restore `isFilesystemRoot(resolved)` for root detection (develop regressed to `resolved === "/"`, which shows a useless `..` on Windows drive roots and UNC roots). Keep develop's tiered substring ranking (`rankTier`), debounced fetch, and `createDirectory()` with name validation.
- `packages/client/src/components/PathPicker.tsx`: replace develop's hardcoded POSIX `parseInput` (which returns `{parent:"/", partial:"B:Dev"}` for Windows drive-relative input) with a call to the shared `parsePathInput()` + `inferPlatform()`. Keep develop's Enter state machine, "+ New folder" UI, inline create-here row, and AbortController cancellation.
- `packages/shared/src/rest-api.ts`: restore the explicit `platform?: NodeJS.Platform` field on `BrowseResult` (develop removed it, forcing client-side inference that breaks on ambiguous paths).
- Add Windows path-picker tests: bare drive letter input, drive-relative input, UNC root parent-detection.

### Tighten: lint-test allowlist for new file structure
- `no-direct-child-process.test.ts` allowlist becomes `["packages/shared/src/platform/spawn.ts", "packages/shared/src/platform/tools.ts"]` (the two files that legitimately need `node:child_process` post-consolidation).
- `no-direct-process-kill.test.ts` and `no-direct-platform-branch.test.ts` allowlists updated for the new file paths.

## Capabilities

### New Capabilities
- `node-guard`: Server startup preflight that refuses to run on Node versions affected by [nodejs/node#58515](https://github.com/nodejs/node/issues/58515) and prints a clear upgrade message with install commands for nvm / brew / nodejs.org.

### Modified Capabilities
- `platform-primitives`: File layout MUST consolidate from 18 files to 5 (`spawn.ts`, `process.ts`, `tools.ts`, `paths.ts`, `system.ts`). The module's public API surface is unchanged; only file boundaries and internal organization change.
- `headless-spawn`: Windows pi-session spawn MUST use `detach: false` to avoid console flash. The "pi dies with dashboard" lifecycle is preserved (already true via stdin-pipe-closes-on-parent-death).
- `platform-paths`: `BrowseResult.platform` SHALL be reported explicitly by the server, not inferred by the client. Path input parsing in the path picker SHALL use `parsePathInput()` for all OS-specific tokenization.
- `command-executor`: `SpawnDetachedOptions.detach` is a new optional boolean. The `useWindowsRedirect` internal gate SHALL additionally require `stdinMode === "ignore"` (documented invariant from libuv source).
- `dashboard-server`: Server startup SHALL refuse to run on Node v22.0–22.17 / v24.1–24.2 via `node-guard.ts`. `packages/server/package.json` SHALL declare `engines.node >= 22.18.0`.

## Impact

- **Code**:
  - Platform consolidation touches ~30 import sites across `packages/server/`, `packages/extension/`, `packages/electron/`, `packages/shared/` — mechanical rewrites, no logic change.
  - Pi-spawn flash fix is ≤ 10 lines (2-line option add, 1-line gate tightening, 2-line call-site change, rest is docs + tests).
  - Node-guard is a net addition of ~40 LOC in `packages/server/` plus a `package.json` edit.
  - Path reconciliation touches `browse.ts` (~20 lines), `PathPicker.tsx` (~15 lines), `rest-api.ts` (1 line), plus new tests.
  - Preload-fastify removal deletes ~640 LOC + 4 openspec folders.
  - **Net**: +~200 LOC (node-guard + tests + path fixes), −~640 LOC (preload removal), ~0 LOC from platform consolidation (pure file merging).

- **Tests**:
  - Consolidated lint tests have shorter allowlists (2 files instead of 4).
  - New Windows path-picker tests (bare drive, drive-relative, UNC root).
  - New `node-guard.test.ts` (boundary cases: 22.17.999 true, 22.18.0 false, 24.2.999 true, 24.3.0 false, 25.0.0 false, malformed false).
  - Existing tests continue to pass; no test rewrites needed for platform consolidation (re-exports preserve API surface).

- **Runtime behavior**:
  - Windows users: no more cmd.exe flash on session spawn.
  - Users on Node v22.17 or v24.2: server refuses to start with a clear error instead of crashing with `ERR_INTERNAL_ASSERTION`.
  - Users on Node v22.18+ / v24.3+ / v25.x: no observable change.
  - Path picker on Windows: bare drive letters and drive-relative paths parse correctly; drive/UNC roots no longer show a useless `..` entry.

- **Merge into `origin/develop`**:
  - After this change lands on `windows-integration`, merging to `develop` has ~7 file-level conflicts (down from 15+). Each conflict resolution is "keep the merged version's improvements" because this change already absorbed develop's UX wins.
  - `packages/server/src/browse.ts`, `PathPicker.tsx`, `rest-api.ts`: post-merge state includes both sides' improvements with zero regression.
  - `packages/server/src/editor-manager.ts`, `tunnel.ts`, `server.ts`: reconciliation already covered in the `platform-primitives` consumer updates.

- **Documentation**:
  - `AGENTS.md` Key Files table: 18 platform/ rows collapse to 5.
  - `docs/architecture.md`: add note about node-guard and `nodejs/node#58515`.
  - `README.md`: update `engines.node >= 22.18.0` prerequisite.
  - `BRANCH-COMPARISON.md` + `MERGE-PLAN.md` (already in repo root) are the durable decision records for this proposal.

- **Supersedes / relates to**:
  - Supersedes in-flight changes `consolidate-platform-handlers` (53/56 tasks) and `platform-path-normalization` (34/36 tasks) — their near-complete work is rolled into this change's starting state.
  - Closes the four misplaced `openspec/changes/archive/2026-04-20-*/` folders (preload-fastify-cjs + siblings).
  - Unblocks the PR merging `windows-integration` into `develop`.
