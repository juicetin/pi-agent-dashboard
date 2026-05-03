## Context

The dashboard already has three Node.js sources in play: a system Node on `PATH` (used by the standalone CLI install), a Node bundled inside the Electron app at `<app>/resources/node/` (used by `dependency-installer.ts` to bootstrap pi/openspec/tsx), and — implicitly — whatever Node the user happens to launch the Electron binary with. The bundled copy is the one closest to "controlled," but it has two structural problems:

1. **Wiped on every Electron upgrade.** A fresh `<app>/resources/node/` ships with each new app version. Anything the user (or the dashboard) did to that directory is lost. There is therefore nowhere stable to keep a single, persistent Node runtime that survives upgrades.
2. **Not on `PATH`.** Spawned children — the dashboard server, the bridge extension, every pi session — inherit the launching shell's `PATH`, not the bundled directory. They can't see the bundled `node` / `npm` even when it's right next to them on disk.

The user-facing symptom is the case that prompted this change: `where npm` returns nothing on Windows even though `<app>/resources/node/node.exe` exists, because (a) `npm.cmd` is not copied alongside `node.exe` (a one-line bug in `docker-make.sh`), and (b) nothing prepends the bundled directory to `PATH` for spawned children. The Settings → Pi Ecosystem **Update** button calls `pi-core-updater.ts::defaultRunNpmUpdate`, which runs `spawn("npm", ...)` directly — bypassing `ToolRegistry`, bypassing `tool-overrides.json`, and producing the opaque `npm update exited with code 1` message reported in the field.

`bootstrapInstall` already owns the "first-run setup of `~/.pi-dashboard/`" boundary. `~/.pi-dashboard/` is preserved across Electron upgrades by design (it's user data, not app data). It is the obvious home for a persistent, version-locked Node runtime that the rest of the system can resolve through `ToolRegistry`.

## Goals / Non-Goals

**Goals:**

- Provide a single, persistent Node runtime under `~/.pi-dashboard/node/` that survives Electron upgrades.
- Have the server, the bridge, every pi session, and the **Update** button all use that runtime when it exists.
- Eliminate the `where npm` ENOENT failure class on Windows.
- Keep standalone CLI installs (no Electron, no bundled resources) working unchanged via the existing `where`/PATH fallback.
- Make first-install repair re-create the managed Node when missing or corrupt.

**Non-Goals:**

- Updating the managed Node after install (deferred to `manage-node-runtime-updates`).
- Downloading Node from the internet (we copy from already-bundled resources only).
- Replacing or removing the existing `<app>/resources/node/` bundle (keeps working as today's bootstrap source).
- Changing how `ToolRegistry` resolves any tool other than `node` and `npm`.
- Auto-detecting and switching between multiple installed Node versions.

## Decisions

### Decision 1: Copy bundled Node into the managed dir on bootstrap, don't symlink

Copy `<bundledNodeDir>/*` → `<managedDir>/node/` recursively. Don't symlink.

**Why:** The bundled dir is wiped on Electron upgrade; a symlink would dangle. Symlinks on Windows require admin or developer mode. Disk cost is ~80 MB once, paid only on machines that actually have Electron-bundled resources; standalone CLI installs are a no-op. Copy is simple, atomic at the file level via `fs.cp`, and gives us a stable target for `ToolRegistry`.

**Alternatives considered:**
- *Hard link the binaries* — survives bundled-dir deletion only on the same filesystem, breaks across Electron upgrade reinstalls that put resources on a different mount point.
- *Just always read from `<app>/resources/node/`* — requires every tool consumer to know about Electron's `process.resourcesPath`, and breaks the moment the app updates.

### Decision 2: Layout matches the upstream Node Windows / Unix zip layout

Mirror the official Node distribution exactly:

- Windows: `~/.pi-dashboard/node/node.exe`, `~/.pi-dashboard/node/npm.cmd`, `~/.pi-dashboard/node/npx.cmd`, `~/.pi-dashboard/node/node_modules/npm/bin/npm-cli.js`.
- Unix: `~/.pi-dashboard/node/bin/node`, `~/.pi-dashboard/node/bin/npm`, `~/.pi-dashboard/node/lib/node_modules/npm/`.

**Why:** Matches what `bundled-node-runtime`'s `getBundledNpmPath()` already looks at. Matches what `where npm` and shell-completion users expect. Lets a curious user just `cd ~/.pi-dashboard/node && ./node -v` without help text. Lets us reuse upstream's `npm.cmd` shim verbatim instead of hand-rolling one (which is also why the docker-make.sh fix matters — the shim has to actually exist in the bundled source).

### Decision 3: Track the installed runtime with a single-line `.version` marker

Write `~/.pi-dashboard/node/.version` containing the bundled Node version (e.g. `v22.12.0`) at the end of a successful copy.

**Why:** Cheap, atomic-after-copy, human-readable, and enough to drive idempotency ("skip if marker matches source") and Doctor's repair check ("re-copy if marker missing or mismatched"). Not a manifest, not JSON — every single-line marker file we've added so far has stayed single-line. If we later need richer metadata, it can co-exist as `~/.pi-dashboard/node/.runtime.json`.

### Decision 4: New `managedRuntime` strategy; prepend, not replace

Add a `managedRuntime(toolName)` strategy to `src/shared/tool-registry/strategies.ts`. Prepend it to the `node` and `npm` chains in `definitions.ts`. The override file (`tool-overrides.json`) still wins; the existing `where`/PATH lookup still runs as a fallback when the managed copy is absent.

**Why:** Override-still-wins matches every other tool in the registry — users who pinned a custom Node via `tool-overrides.json` keep it. Fallback-still-runs matches the standalone CLI case where there are no bundled resources to copy. Prepending (not replacing) means we never reduce capability for an existing setup, only add a new preferred source.

### Decision 5: PATH injection happens once, in a shared helper

`prependManagedNodeToPath(env)` in `src/shared/platform/`. Returns a shallow-cloned env with `~/.pi-dashboard/node/` (Windows) or `~/.pi-dashboard/node/bin/` (Unix) prepended to `PATH`. Apply it at exactly two spawn sites today: `src/server/process-manager.ts` (every pi session spawn) and `packages/server/src/pi-core-updater.ts` (the bare-`npm` spawn that bypasses the registry).

**Why:** Two sites today, but the helper makes it a one-liner to wire any future spawn site. Putting it in `src/shared/platform/` keeps it next to `process.ts`, `node-spawn.ts`, and the rest of the spawn primitives — the same module everything else already imports for cross-OS spawn behavior. No global mutation of `process.env` (which would leak into the dashboard server itself unpredictably).

### Decision 6: Plug the `pi-core-updater` registry bypass in this change, not a follow-up

`packages/server/src/pi-core-updater.ts::defaultRunNpmUpdate` is refactored to call `getDefaultRegistry().resolve("npm")` instead of `spawn("npm", ...)`.

**Why:** Without this, the user-visible result of the whole change is half-broken: `bootstrapInstall` would use managed Node correctly, but the **Update** button — the entire reason the user reported the bug — would still fail on a system without `npm` on `PATH`. The refactor is small (~10 lines) and locally testable. Splitting it into a follow-up risks shipping the cosmetic part of the fix without the load-bearing part.

### Decision 7: Doctor / repair re-runs `installManagedNode` unconditionally

When the user runs Doctor or `pi-dashboard repair`, re-invoke `installManagedNode(managedDir)`. The function is idempotent (skip if `.version` matches source) so a no-op is fast, and a mismatch triggers a clean re-copy.

**Why:** Repair flows already exist for `node_modules/` corruption; piggybacking is cheaper than inventing a separate "node-runtime-repair" surface. Idempotency keeps it safe to run on every Doctor invocation.

## Risks / Trade-offs

- **+~80 MB per user under `~/.pi-dashboard/node/`** → Acceptable. Negligible compared to typical `node_modules/`. Documented in proposal.
- **First-run install adds 1–3 s for the copy step** → Mitigated by emitting progress through the existing `onProgress` channel so the wizard reflects the work.
- **Copy can fail mid-flight (disk full, permission denied)** → Mitigated by writing the `.version` marker only on success; a partial copy looks "missing" to the next bootstrap and gets re-attempted, not "succeeded but broken."
- **Windows `node.exe` is locked while the dashboard server is running** → Not a concern for `embed-managed-node-runtime` (we only copy in during first install / Doctor, both of which run before / outside the running server). Becomes a real concern for the follow-up `manage-node-runtime-updates` change, which is why that one introduces stage-and-swap.
- **Two Node binaries on disk per user (managed + bundled)** → Acceptable. The bundled copy is the source of truth for fresh installs and disaster recovery; the managed copy is the runtime users actually execute.
- **`pi-core-updater` regression risk from the registry-resolution refactor** → Mitigated by extending `src/server/__tests__/pi-core-updater.test.ts` (or `packages/server/src/__tests__/pi-core-updater.test.ts`) to assert the resolved binary is invoked, not bare `"npm"`. The existing `runNpmUpdate` test seam already isolates the spawn for assertion.
- **Standalone CLI users see no behavior change** → By design. `getBundledNodePath()` returns `null`, `installManagedNode` no-ops, `managedRuntime` strategy returns null, `ToolRegistry` falls through to PATH lookup as today.
- **`tool-overrides.json` precedence is invisible to users** → Acceptable for this change. Doctor already lists resolved tool paths; `/api/tools` already exposes them. No new UI needed.

## Migration Plan

1. **Bundle fix lands first.** `packages/electron/scripts/docker-make.sh` Windows branch picks up `npm.cmd` + `npx.cmd`. Verify by inspecting the next nightly Windows build's `<app>/resources/node/` contents in CI (add an assertion in `packages/electron/src/__tests__/` that the bundled dir contains `npm.cmd` after package, or grep the script directly in a test).
2. **Pure helpers second.** `installManagedNode`, `prependManagedNodeToPath`, and the `managedRuntime` strategy land with their unit tests. No production code calls them yet.
3. **Wire-up third.** `dependency-installer.ts::installAllTools` calls `installManagedNode` before `bootstrapInstall`; `process-manager.ts` and `pi-core-updater.ts` call `prependManagedNodeToPath`; `pi-core-updater.ts` resolves `npm` via the registry; `definitions.ts` prepends the strategy. Each wire-up is ≤ 10 lines.
4. **Doctor opt-in fourth.** Doctor calls `installManagedNode` as part of its checks. Surfaced in the existing Doctor UI rows.
5. **Rollback strategy.** If a regression surfaces, revert wire-up step 3 only — pure helpers and bundle fix from steps 1–2 are inert without it. The managed `~/.pi-dashboard/node/` copy that exists on already-upgraded users' disks becomes harmless (nothing references it).

## Open Questions

- **Should the `.version` marker include the source of the copy?** (e.g. `v22.12.0 from-bundled`). Useful when the follow-up `manage-node-runtime-updates` lands, since at that point markers can come from either the Electron bundle or a fresh nodejs.org download. Easy to extend later; for this change, a bare version line is enough.
- **Does the bridge extension need PATH injection, or is "everything pi-spawned inherits the server's environment" enough?** Initial read of `process-manager.ts` says yes-already-inherits, but the bridge has its own spawn paths for `!`/`!!` shell commands. Worth a one-line audit in the implementation pass; if true, extending `prependManagedNodeToPath` to one more site is trivial.
- **Should we expose the managed Node version on `/api/health`?** Probably yes for diagnostic value, but it can ride along in the follow-up update-tracking change since that's where Node-runtime metadata becomes load-bearing.
