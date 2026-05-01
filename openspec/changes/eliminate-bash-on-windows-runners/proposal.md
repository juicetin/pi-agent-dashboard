## Why

Every Windows electron CI failure since v0.4.0 has had the same root cause: **bash on a Windows runner**. Git-Bash's MSYS2 layer translates Win32 paths (`D:\a\...`) to POSIX-form (`/d/a/...`) for any variable produced by `pwd`, `dirname`, `realpath`, etc. That POSIX-form string is then handed to native binaries — most often `node.exe` — which have no MSYS awareness and reject `/d/a/...` outright. The most recent symptom was `bundle-offline-packages.sh`'s `node -e "require('$PINS_FILE')"` failing with `MODULE_NOT_FOUND`. The next would be the same pattern in any other shell-spawn-Node bridge.

This is structural, not a one-off bug. **MSYS exists because legacy projects (GCC, Autotools, git itself) were already POSIX-shaped and could not be rewritten.** That argument does not apply to a Node project. We have Node's own cross-OS abstractions (`node:path`, `node:fs`, `node:child_process`); using bash on Windows costs us a translation layer with zero benefit. Every `shell: bash` step that runs on a Windows runner is technical debt accepted by accident — none of the historical commits chose bash on Windows for a positive reason.

Recurring symptoms include slow ~10× process exec via `msys-2.0.dll`, untestable scripts on Linux dev machines (the translation layer only exists on Windows), implicit dependence on Git for Windows being installed on the runner, and a perpetual class of latent path-in-string bugs that surface only at release time.

## What Changes

- **Eliminate every `shell: bash` step that runs on a Windows runner** in `.github/workflows/publish.yml`. This is not a partial purge — the goal is zero MSYS/bash interaction for Windows builds.
- **Port `packages/electron/scripts/bundle-server.sh` to `bundle-server.mjs`.** The script is the only nontrivial bash content that currently runs on Windows. Replaces `cp -R`, `find`, `chmod`, `du`, `rm -rf`, and `xattr` with their `node:fs` equivalents; replaces the `npm install` invocation with `child_process.spawnSync`.
- **Pin the electron devDependency** in `packages/electron/package.json` to a literal version (drop the `^`). `app-builder-lib`'s `getElectronVersionFromInstalled` does not walk up the workspace tree to find hoisted electron, so it falls back to reading the version literal — which the regex `/^\d/` rejects when the value is `^32.0.0`. Pinning unblocks the NSIS maker (Windows-only consumer of electron-builder) without changing behaviour on Linux/macOS.
- **Add a repo-lint test** `no-bash-on-windows.test.ts` that parses `publish.yml` and `ci.yml`, computes for each step the set of operating systems it will run on (matrix × `if:` filter), and fails when any `shell: bash` step is reachable on a Windows runner. The test cites change `eliminate-bash-on-windows-runners` in its failure message.
- **Document the architectural principle** in `docs/architecture.md` and `AGENTS.md`: cross-OS build logic SHALL live in `.mjs` scripts; POSIX-only steps MAY use `shell: bash` gated by `if: matrix.platform != 'win32'`; Windows-only steps MAY use `shell: pwsh`. No step combines `shell: bash` with a Windows-runnable matrix.

This is not a feature change. No user-visible behaviour changes. The release pipeline becomes more reproducible (Linux dev machines can dry-run every Windows-targeted script), faster (no MSYS fork overhead), and structurally immune to the path-in-string bug class.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `ci-cd-pipeline`: add a requirement that no Windows-runnable workflow step uses `shell: bash`, locked by an automated test.
- `electron-build-pipeline`: replace the existing "Bundled dashboard server" requirement's reference to `bundle-server.sh` with `bundle-server.mjs`; pin the electron devDependency.

## Impact

- **Files changed**: `.github/workflows/publish.yml` (~50 line YAML reshape), `packages/electron/scripts/bundle-server.sh` (deleted) → `bundle-server.mjs` (new, ~100 lines), `packages/electron/package.json` (`"electron": "^32.0.0"` → `"32.3.3"`), `docs/architecture.md` and `AGENTS.md` (documentation), `packages/shared/src/__tests__/no-bash-on-windows.test.ts` (new, ~80 lines), four documentation comment refs from `.sh` → `.mjs` (already done in commit `6b069c4`; re-verified here).
- **Behaviour change on Linux/macOS**: zero. Their `shell: bash` steps are unchanged.
- **Behaviour change on Windows**: every Windows step now runs in either `cmd.exe` (default), `pwsh`, or directly via `node` — never bash. MSYS2 / `msys-2.0.dll` is no longer in the call graph.
- **Wallclock**: small improvement — removes 4-6 MSYS fork operations per release on each Windows variant.
- **Tests**: new repo-lint plus reuse of the existing pure-helper unit-test pattern for `bundle-server.mjs`.
- **Risk**: low. The only nontrivial port is `bundle-server.sh` → `.mjs`, which is mostly mechanical (1:1 replacement of POSIX coreutils with `node:fs`). Verified locally on Linux first; validated in CI matrix on every OS.
