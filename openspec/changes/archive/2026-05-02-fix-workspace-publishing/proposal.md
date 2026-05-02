## Why

The published `@blackbelt-technology/pi-agent-dashboard@0.3.0` is **broken on npm**: a fresh `npm install @blackbelt-technology/pi-agent-dashboard` fails with E404 because the root package declares three workspace dependencies (`pi-dashboard-extension`, `pi-dashboard-server`, `pi-dashboard-web`) that **were never published to the registry**.

Root cause: `.github/workflows/publish.yml` runs `npm publish --provenance --access public` without `--workspaces`, publishing only the root. Meanwhile the root's `dependencies` field uses `"workspace:*"` specifiers that npm rewrites to `"*"` at publish time — pointing at non-existent packages. The shared package (`@blackbelt-technology/pi-dashboard-shared`), on which every runtime import depends (`import … from "@blackbelt-technology/pi-dashboard-shared/…"`), is also absent from the registry, so even if a user sideloaded the root tarball the imports would fail to resolve.

Comparable monorepos (e.g. `@mariozechner/pi-coding-agent` in `badlogic/pi-mono`) publish every non-private workspace with real semver cross-references (`"^0.70.0"`, not `workspace:*`) using `npm publish -ws`. We need the same — with the tweak that our root metapackage stays public for backward compatibility.

## What Changes

- **Publish all runtime workspaces to npm on every tagged release**: `@blackbelt-technology/pi-dashboard-shared`, `-extension`, `-server`, `-web`. The root `@blackbelt-technology/pi-agent-dashboard` continues to be published as a convenience metapackage.
- **Replace `"workspace:*"` with real semver ranges** (e.g. `"^0.3.0"`) in every cross-package dependency reference (root `package.json` and `packages/*/package.json`). npm's CLI does not support the `workspace:` protocol with anything other than `*`, and even `workspace:*` fails on fresh installs without a pre-existing lockfile (`npm error EUNSUPPORTEDPROTOCOL`). Real semver works identically for local dev (npm workspaces still symlinks `packages/*` into `node_modules/` when the local version satisfies the range) AND for the published tarball (no rewrite needed).
- **Update `.github/workflows/publish.yml`** to run `npm publish --workspaces --include-workspace-root --provenance --access public` (replacing the current root-only publish). `packages/electron` is excluded via `"private": true` because it ships as DMG/DEB/EXE through the GitHub Release artifacts, not via npm.
- **Add `scripts/sync-versions.js`** (~100 lines, zero deps, ported from pi-mono) that runs after `npm version -ws --include-workspace-root` during the `release-cut` flow. It reads every workspace `package.json`, verifies lockstep versions, and rewrites every inter-package dep specifier to `^<current-version>`. Without this script, bumping the root + workspaces from 0.3.0 to 0.3.1 would leave every `"@blackbelt-technology/pi-dashboard-*": "^0.3.0"` stale, published as 0.3.0 ranges while the workspaces ship as 0.3.1.
- **Add `"publishConfig": { "access": "public" }`** to every workspace `package.json` that is published, so the `-ws` publish can find the access setting per-workspace (not just on the root).
- **Mark `packages/electron/package.json` as `"private": true`** so `npm publish -ws` automatically skips it.
- **Document the `workspace:^` → real-semver rewrite** and the `-ws` publish step in `docs/release-process.md` and the `release-cut` skill so future release authors understand the mechanism.

This is **not** a breaking change for end users. The 0.3.0 tarball on npm is already uninstallable (404 on dependencies), so any consumer currently relying on `npm i @blackbelt-technology/pi-agent-dashboard` is already broken; 0.3.1 fixes them. Consumers reaching the dashboard via the Electron installer or pi's `bootstrapInstall` path were never affected and remain unaffected.

## Capabilities

### New Capabilities

- `workspace-publishing`: Defines which workspaces are published to npm, the cross-package dependency specifier convention (`workspace:^`), the publish command (`npm publish -ws --include-workspace-root`), and which workspaces are deliberately private (`packages/electron`).

### Modified Capabilities

- `monorepo-workspace-structure`: Existing spec declares the four runtime packages and their internal dependency graph but says nothing about publication. Add requirements that each runtime package (`shared`, `server`, `extension`, `web`) MUST be published to the public npm registry with `publishConfig.access = "public"`, and that `packages/electron` MUST be `private: true`.
- `release-notes`: The release process doc (`docs/release-process.md`) currently describes "CI publishes npm" as a single `npm publish` step. Update the "What CI Does" section to reflect that `-ws --include-workspace-root` now fans out to five packages, and document the `sync-versions.js` step that must run before tagging.

## Impact

**Files changed**:
- `package.json` (root) — `workspace:*` → `^<ver>` for the three runtime deps
- `packages/shared/package.json` — add `publishConfig.access`
- `packages/server/package.json` — `workspace:*` → `^<ver>`, add `publishConfig.access`
- `packages/extension/package.json` — `workspace:*` → `^<ver>`, add `publishConfig.access`
- `packages/client/package.json` — `workspace:*` → `^<ver>`, add `publishConfig.access`
- `packages/electron/package.json` — `workspace:*` → `^<ver>`, add `"private": true`
- `.github/workflows/publish.yml` — `npm publish` → `npm publish -ws --include-workspace-root --provenance --access public`
- `scripts/sync-versions.js` — **NEW**, ~100 lines, verifies lockstep and rewrites inter-package dep specifiers to `^<current-version>` after a bump
- `docs/release-process.md` — document the `-ws` fan-out and the `sync-versions.js` step
- `.pi/skills/release-cut/SKILL.md` — add the `sync-versions.js` invocation to the bump flow
- `CHANGELOG.md` — note under `## [Unreleased] → Fixed` that 0.3.0 was unpublishable and 0.3.1 makes the full package set installable via npm

**Registry state after this change lands (next tagged release)**:
- `@blackbelt-technology/pi-agent-dashboard` — continues (metapackage)
- `@blackbelt-technology/pi-dashboard-shared` — NEW on registry
- `@blackbelt-technology/pi-dashboard-extension` — NEW on registry
- `@blackbelt-technology/pi-dashboard-server` — NEW on registry
- `@blackbelt-technology/pi-dashboard-web` — NEW on registry
- `@blackbelt-technology/pi-dashboard-electron` — intentionally absent (private)

**Risk**: Minimal. The change only affects the publish step and dependency specifiers; no runtime code changes. The first post-change release should be dry-run tested with `npm publish -ws --dry-run` in CI or locally before tagging.

**No impact on**: the Electron installer bundle, the `bootstrapInstall` offline-cache path, source-publishing (`src/` stays in `files:` — still pi-extension compatible, jiti-loader runs unchanged), or the OpenSpec schema/workflow.

## Alternatives Considered

Before proposing the `workspace:^` + `npm publish -ws` approach, we studied how `badlogic/pi-mono` (the upstream pi ecosystem — ships `@mariozechner/pi-coding-agent`, `pi-ai`, `pi-tui`, `pi-agent-core` as separate npm packages from a single monorepo) solves the same problem. Their solution has four moving parts; we adopt two, reject two.

### What pi-mono does

1. **Root `package.json` is `"private": true`** — never published; serves only as a dev orchestrator.
2. **Cross-package deps use real semver** (`"@mariozechner/pi-tui": "^0.70.0"`), not `workspace:*`. npm workspaces still symlinks `packages/tui` into `node_modules/@mariozechner/pi-tui` at install time because the local version satisfies the range (lockstep versioning — every package shares one version number).
3. **`scripts/sync-versions.js`** (~100 lines, zero deps) runs after `npm version -ws`: reads every `packages/*/package.json`, verifies lockstep, rewrites every inter-package dep to `^<current-version>`. Called from `version:patch` / `version:minor` / `version:major` npm scripts.
4. **`npm publish -ws --access public`** in a local `release.mjs` orchestrator (not GitHub Actions) — `prepublishOnly` builds each workspace's `dist/` before upload, `files: ["dist/**/*"]` ships prebuilt JS.

### Comparison — what we adopt, what we reject

| pi-mono choice | Our decision | Rationale |
|---|---|---|
| `npm publish -ws` | **Adopt** | Core fix — without this, workspace packages never reach the registry. |
| Mark non-published workspaces `private: true` | **Adopt** (for `packages/electron` only) | Keeps the Electron package out of `-ws` publishing cleanly, without per-command `--workspace` filtering. |
| Cross-package deps as plain semver (`"^0.70.0"`) | **Adopt** | Verified empirically: npm CLI 10.9.4 rejects every `workspace:` specifier variant (`workspace:*`, `workspace:^`, `workspace:~`, `workspace:<ver>`) with `EUNSUPPORTEDPROTOCOL` on fresh installs. The `workspace:` protocol is a pnpm/yarn convention, not a true npm feature. Plain semver (`"^0.3.0"`) works identically for local dev (npm workspaces still symlinks when the local version satisfies the range) and for the published tarball. The only "cost" is needing a sync script at bump time — which we accept. |
| `sync-versions.js` custom script | **Adopt** | Required because plain semver cross-refs don't auto-update when `npm version -ws` bumps the version field. Without it, bumping root+workspaces from 0.3.0 → 0.3.1 would leave every cross-ref pinned to `^0.3.0`, shipping a tarball whose deps don't match reality. Port verbatim from pi-mono's 100-line script. |
| Root package is `"private": true` | **Reject** — keep `@blackbelt-technology/pi-agent-dashboard` public | Backward compatibility: this name is already in the wild (documented in README, used by the Electron installer's `bootstrapInstall` offline cache, referenced in pi's recommended-extensions manifest). Breaking it would force every downstream reference to migrate to a new package name. The metapackage model (root re-exports the runtime workspaces via `dependencies`) is a valid pattern — it was just incorrectly wired because the sub-packages weren't actually published. |
| Prebuilt `dist/` publish | **Reject** — keep `src/` publish | pi-extension convention: `pi.extensions` in `package.json` points at source paths (`packages/extension/src/bridge.ts`), and pi's bootstrap loads them via jiti. Shipping `dist/` would require dual-resolution logic in pi itself. This is a deliberate difference from upstream pi-mono, which doesn't ship any pi-extensions. |
| Local `release.mjs` orchestrator | **Reject** — keep GitHub Actions `publish.yml` | Our existing release pipeline (tag push → CI builds + publishes + attaches Electron artifacts to GitHub Release draft) is documented, tested, and integrates with the `release-cut` skill. Moving to a developer-machine publish would be a regression in reproducibility and provenance. `publish.yml` only needs one flag added (`-ws --include-workspace-root`). |

### Why not just copy pi-mono wholesale?

Two constraints differentiate us:

1. **Public root-metapackage commitment** — 0.3.0 is already on npm under `@blackbelt-technology/pi-agent-dashboard`. Renaming breaks every downstream reference. pi-mono started private and never had this obligation.
2. **pi-extension convention** — our `extension/` and `server/` packages are *consumed by pi itself* (jiti-loaded source). pi-mono's packages are consumed by end-user applications (prebuilt dist). Different distribution model, different `files:` layout.

The net result: we converge on ~75% of pi-mono's mechanism (plain semver + sync-versions.js + `-ws` publish) while keeping our own release orchestrator (GitHub Actions). The one place we *tried* to diverge (`workspace:^` protocol) failed empirical verification — npm doesn't support it.

### Post-mortem: the failed `workspace:^` assumption

An earlier draft of this proposal (now corrected) proposed `workspace:^` as a zero-maintenance alternative to pi-mono's sync script, under the assumption that npm 7+ supports the workspace protocol with semver modifiers. Verification against npm 10.9.4 showed otherwise: all four `workspace:` variants (`*`, `^`, `~`, `<ver>`) fail with `EUNSUPPORTEDPROTOCOL` on lockfile-less installs. The lockfile in our repo happened to cache a legacy `"*"` resolution from a previous state, which made the problem invisible until a genuine clean-install was attempted. Lesson: always verify `workspace:` protocol support empirically with `rm -rf node_modules package-lock.json && npm install` before relying on it.
