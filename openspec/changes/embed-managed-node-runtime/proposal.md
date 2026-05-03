## Why

Today the Electron app bundles Node.js into `<app>/resources/node/` (`bundled-node-runtime` spec) and `bootstrapInstall` populates `~/.pi-dashboard/` with `pi-coding-agent`, `openspec`, and `tsx` against whatever Node/npm it can find. The bundled Node is wiped on every Electron upgrade, the Windows bundle is missing the `npm.cmd` / `npx.cmd` shims (so `where npm` returns nothing — confirmed user report), and `pi-core-updater` spawns a bare `npm` that bypasses `ToolRegistry`. Net effect: users without a system Node installation hit `npm update exited with code 1` from the Settings → Pi Ecosystem **Update** button and have no clean recovery.

Copying the bundled Node into `~/.pi-dashboard/node/` on first run — and routing every spawn through it — gives the server, the bridge, every pi session, and the Update button a single, persistent, version-locked Node runtime. It also unblocks the standalone CLI use case (no Electron, no system Node) by giving `pi-dashboard` somewhere to install pi without external prerequisites once the resources are present.

## What Changes

- Fix `packages/electron/scripts/docker-make.sh` Windows branch to also copy `npm.cmd` and `npx.cmd` from the official Node Windows zip alongside `node.exe` and `node_modules/`. **Precondition for everything below.**
- Add `installManagedNode(managedDir)` to `packages/shared/src/bootstrap-install.ts`. Idempotent copy of `<bundledNodeDir>` → `<managedDir>/node/`. Writes a `<managedDir>/node/.version` marker. No-op when the source isn't available (standalone CLI without Electron resources).
- Wire `installManagedNode` into `packages/electron/src/lib/dependency-installer.ts::installAllTools` so it runs **before** the first `bootstrapInstall(...)` call. The very first `npm install` of pi/openspec/tsx then runs against the managed Node.
- Add a `managedRuntime` strategy to `src/shared/tool-registry/strategies.ts` and prepend it to the `node` and `npm` chains in `definitions.ts`. Override file (`tool-overrides.json`) still wins.
- Add `prependManagedNodeToPath(env)` helper in `src/shared/platform/`. Apply it in `src/server/process-manager.ts` (session spawn) and in `packages/server/src/pi-core-updater.ts` so spawned children inherit the managed Node on `PATH`.
- Refactor `packages/server/src/pi-core-updater.ts::defaultRunNpmUpdate` to resolve `npm` via `getDefaultRegistry().resolve("npm")` instead of bare `spawn("npm", ...)`. Removes the only remaining bypass of the registry on the hot update path.
- Doctor / `pi-dashboard repair` re-runs `installManagedNode` if the managed copy is missing or its `.version` marker disagrees with the bundled source.

## Capabilities

### New Capabilities

- `managed-node-runtime`: governs the persistent copy of Node.js under `~/.pi-dashboard/node/`, its installation from Electron resources, version-marker tracking, and idempotent re-installation on repair.

### Modified Capabilities

- `bootstrap-install`: bootstrap chain SHALL install the managed Node runtime before installing pi/openspec/tsx whenever bundled Node resources are available.
- `bundled-node-runtime`: Windows packaging SHALL include `npm.cmd` and `npx.cmd` next to `node.exe` so the bundle is invocable as `npm` after copy.
- `pi-core-version-check` (updater half): `pi-core-updater` SHALL resolve the `npm` binary via `ToolRegistry` and SHALL prepend the managed Node directory to the spawned child's `PATH`.

## Impact

- **Files touched (production)**: `packages/electron/scripts/docker-make.sh`, `packages/shared/src/bootstrap-install.ts`, `packages/electron/src/lib/dependency-installer.ts`, `src/shared/tool-registry/strategies.ts`, `src/shared/tool-registry/definitions.ts`, `src/shared/platform/` (new helper), `src/server/process-manager.ts`, `packages/server/src/pi-core-updater.ts`, `packages/electron/src/lib/doctor.ts`.
- **Disk cost**: +~80 MB per user under `~/.pi-dashboard/node/`. Zero installer-size change (Node already bundled).
- **APIs**: no new public REST or WS surface. Internal `ToolRegistry` gains one strategy; `bootstrap-install` exports one new function.
- **Compatibility**: backwards-compatible. Without bundled resources (standalone CLI), behavior matches today — `ToolRegistry` falls through to `where`/PATH lookup. Existing global-npm pi installs continue to work; `installSource: "global"` rows are unaffected.
- **Risk**: copy-on-bootstrap adds 1–3 s to first-run install on Electron. Mitigated by progress emission through the existing `onProgress` channel.
- **Out of scope**: updating the managed Node runtime itself after install. Deferred to follow-up change `manage-node-runtime-updates`.
