## Context

The published `@blackbelt-technology/pi-agent-dashboard@0.3.0` npm tarball cannot be installed in a clean environment because three of its runtime `dependencies` (`pi-dashboard-extension`, `pi-dashboard-server`, `pi-dashboard-web`) resolve to `"*"` at publish time but no package with those names exists on the registry. A fourth package — `pi-dashboard-shared` — is imported by every runtime workspace (`import … from "@blackbelt-technology/pi-dashboard-shared/…"`) but is likewise absent.

**Current state (2026-04-24)**:
- `npm view @blackbelt-technology/pi-agent-dashboard@0.3.0 dependencies` returns three `"*"` specifiers pointing at unpublished packages.
- `.github/workflows/publish.yml` line 31: `npm publish --provenance --access public` — no `--workspaces` flag.
- Every `packages/*/package.json` uses `"workspace:*"` for cross-package dependencies. At publish, npm rewrites `workspace:*` → `"*"`, which is a valid specifier syntactically but unresolvable because the target packages were never uploaded.
- `packages/electron/package.json` has no `"private"` field. It ships as DMG/DEB/AppImage/EXE through GitHub Release artifacts, never as an npm tarball.

**Constraints**:
1. **No breaking rename.** The root package name `@blackbelt-technology/pi-agent-dashboard` is referenced in README, bundled into the Electron installer's `bootstrapInstall` offline cache, and potentially cited by downstream pi users. It must remain publicly published under the same name.
2. **Keep `src/`-publish.** pi's extension loader reads `pi.extensions` and `pi.skills` paths from `package.json` and uses jiti to load TypeScript sources at runtime. Switching to a `dist/`-publish model would require dual-resolution logic in pi itself and break first-party consumers.
3. **Preserve GitHub Actions release flow.** The existing `publish.yml` + `release-cut` skill pipeline is documented, tested end-to-end, and integrates with the Electron artifact build matrix and the draft GitHub Release with auto-extracted CHANGELOG body. Moving to a local `release.mjs` orchestrator (pi-mono style) would regress reproducibility and provenance signing.
4. **Keep lockstep versioning.** Every workspace currently shares one version (`0.3.0`); the `release-cut` skill uses `npm version <ver> --workspaces --include-workspace-root` to bump them together. We rely on this invariant.

**Stakeholders**: release authors (use `release-cut` skill), end users installing via `npm i -g`, Electron installer's `bootstrapInstall` path, the pi ecosystem's recommended-extensions consumers.

## Goals / Non-Goals

**Goals:**
- Make `npm install @blackbelt-technology/pi-agent-dashboard` succeed in a fresh environment (no 404s).
- Make each of `@blackbelt-technology/pi-dashboard-{shared,extension,server,web}` independently installable so downstream projects can depend on just the piece they need.
- Automate the fix in the existing release pipeline — no new manual steps for release authors beyond what `release-cut` already does.
- Keep the change minimally invasive: no package renames, no publish-format migration, no new scripts to maintain.

**Non-Goals:**
- Publishing `@blackbelt-technology/pi-dashboard-electron` to npm. It is a desktop app, distributed as native installers via GitHub Releases.
- Introducing a `sync-versions.js`-style custom script. The `workspace:^` protocol covers the same need natively.
- Switching from `src/`-publish to `dist/`-publish. The pi-extension convention requires TypeScript sources in the tarball.
- Changing the release trigger or orchestrator (tag-push → GitHub Actions stays).
- Migrating the monorepo to a different tooling (pnpm, yarn, turbo). The fix works with plain `npm@9+` workspaces.

## Decisions

### D1. Use plain semver cross-refs (`^0.3.0`) backed by `scripts/sync-versions.js`

**Choice**: Replace every `"workspace:*"` specifier in `package.json` files with a plain semver range matching the current workspace version (e.g. `"^0.3.0"`). Add a `scripts/sync-versions.js` helper that runs after `npm version -ws --include-workspace-root` to rewrite every inter-package dep to `^<new-version>`.

**Empirical justification**: An earlier version of this design proposed `workspace:^` as a zero-maintenance alternative. Verification against npm 10.9.4 disproved it:

```
$ mkdir -p /tmp/wstest/packages/{a,b}
$ cat > /tmp/wstest/package.json <<< '{"name":"r","workspaces":["packages/*"]}'
$ cat > /tmp/wstest/packages/a/package.json <<< '{"name":"@t/a","version":"1.0.0"}'
$ cat > /tmp/wstest/packages/b/package.json <<< '{"name":"@t/b","version":"1.0.0","dependencies":{"@t/a":"workspace:^"}}'
$ cd /tmp/wstest && npm install
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:^
```

Repeated with `workspace:*`, `workspace:~`, and `workspace:1.0.0` — all four fail identically. The `workspace:` protocol is a pnpm/yarn convention; npm's CLI has never implemented it. The existing `workspace:*` specifiers in our repo only "work" because `package-lock.json` caches a pre-resolved `"*"` value from a previous install state; any genuine clean-install (`rm -rf node_modules package-lock.json && npm install`) reproduces the same `EUNSUPPORTEDPROTOCOL`.

**How plain semver resolves locally**: npm's workspace linker inspects every `packages/*/package.json`, builds a name→version map, and for any `dependencies` entry whose name matches a workspace and whose semver range is satisfied by the local version, it creates a `node_modules/<name>` symlink to the workspace directory. `"^0.3.0"` satisfies any local version in `0.x` range `>= 0.3.0 < 1.0.0`, so as long as every workspace bumps in lockstep, the symlinks are always created. We verified this: after applying plain-semver specifiers, `rm -rf node_modules package-lock.json && npm install` succeeds and produces symlinks under `node_modules/@blackbelt-technology/`.

**Why the sync script is mandatory**: `npm version 0.3.1 -ws --include-workspace-root` bumps the `version` field in every `package.json` but leaves `dependencies` untouched. Without a post-bump step, the root's `"@blackbelt-technology/pi-dashboard-server": "^0.3.0"` would ship inside the 0.3.1 tarball — the published root would depend on a 0.3.0 range while the published server tarball is 0.3.1. On a fresh registry install the `^0.3.0` range still admits `0.3.1` (because 0.3.1 is `^0.3.0`-compatible), so it would technically work — but we'd be publishing inconsistent metadata. The sync script removes this drift by rewriting `dependencies` in lockstep.

**Sync script design** (port of pi-mono's `scripts/sync-versions.js`):
1. Enumerate `packages/*/package.json` + root `package.json`.
2. Build a `{name: version}` map.
3. Assert all versions are identical (lockstep invariant).
4. For every `dependencies` and `devDependencies` entry whose name matches a known workspace, rewrite the specifier to `^<that-workspace's-version>`.
5. Write changed files atomically; log every rewrite.

**Alternatives considered**:
- `workspace:*` / `workspace:^`: rejected empirically (see above).
- Manual version bump per file: rejected — error-prone, defeats lockstep invariant.
- Use pnpm instead of npm: rejected — out of scope, would cascade into CI / Electron / `bootstrapInstall` changes.
- Use a git pre-commit hook to enforce dep-version sync: rejected — release authors using `release-cut` already run the sync step explicitly; a hook adds friction for everyday commits without preventing a tagged release from being wrong.

### D2. Publish root + 4 runtime workspaces, skip Electron

**Choice**: `npm publish --workspaces --include-workspace-root --provenance --access public`

**Packages published**:
| Package | Scope | Rationale |
|---|---|---|
| `pi-agent-dashboard` (root) | Public, metapackage | Backward compatibility, existing users' install command keeps working. |
| `pi-dashboard-shared` | Public, runtime | Every other runtime package imports from it; currently unresolvable in published 0.3.0. |
| `pi-dashboard-extension` | Public, runtime | Listed in root deps; also independently useful (any pi session wanting to act as a bridge). |
| `pi-dashboard-server` | Public, runtime | Listed in root deps; standalone CLI via `pi-dashboard` bin. |
| `pi-dashboard-web` | Public, runtime | Listed in root deps; prebuilt static assets (`dist/`) that third parties could embed. |
| `pi-dashboard-electron` | **Private, not on npm** | Desktop app, ships via GitHub Release DMG/DEB/AppImage/EXE. |

**How Electron is excluded**: Add `"private": true` to `packages/electron/package.json`. `npm publish -ws` automatically skips workspaces with `private: true` — no `--workspace` allow-list needed, no silent misconfiguration risk.

**Alternatives considered**:
- Per-workspace `--workspace @bb/foo` allow-list: rejected — every new package becomes a CI edit. `private: true` is declarative.
- Publish Electron too: rejected — the `.vite/build/main.js` main entry and native module paths are Electron-specific; shipping it as a plain npm package would mislead users.

### D3. Add `publishConfig.access = "public"` per workspace

**Choice**: Each published workspace gets `"publishConfig": { "access": "public" }` in its `package.json`.

**Why**: `npm publish --access public` (CLI flag) only applies to the workspace being published *directly*. With `-ws`, npm iterates over each workspace and consults its own `publishConfig`. Without it, scoped packages (`@blackbelt-technology/…`) default to `restricted` and fail with 402.

**Applied to**: `shared`, `extension`, `server`, `client` package.json files. (Root already has it.)

### D4. Keep `src/`-publish, no `dist/` build for server/extension/shared

**Choice**: Each runtime workspace keeps `files: ["src/", …]` — no build step added for publish purposes.

**Rationale**: pi's extension loader consumes TypeScript directly via jiti. The `pi.extensions` entries in root and `packages/extension/package.json` point at `.ts` source paths. Switching to `dist/`-publish would require:
- Adding a build step and dist-copy per workspace
- Updating `pi.extensions` to a conditional resolver (dev: src, published: dist)
- Coordinating with upstream pi to support either mode

None of which is worth doing solely to match pi-mono's convention. pi-mono packages are *consumed by applications* (prebuilt JS is fine); ours are *consumed by pi itself* (TypeScript expected).

**Exception**: `packages/client` already has `files: ["dist/"]` because the browser bundle must be prebuilt (Vite → static assets). Its `prepare` script (`vite build`) runs at install time for consumers who clone the monorepo; at publish time the `dist/` is already built by the CI `npm run build` step. No change needed.

### D5. CI change is a one-line flag addition

**Choice**: In `.github/workflows/publish.yml`, change:
```yaml
- run: npm publish --provenance --access public
```
to:
```yaml
- run: npm publish --workspaces --include-workspace-root --provenance --access public
```

**Why not more**: The existing step order is correct — `npm version` bumps all workspaces (already uses `--workspaces --include-workspace-root`), `npm run build` produces the web client `dist/`, and then publish runs. Only the publish command was under-scoped.

**Provenance**: `--provenance` works with `-ws` (npm publishes a provenance attestation per workspace, each linking back to the same CI run). No extra configuration needed.

## Risks / Trade-offs

**[Risk]** A published workspace's `dependencies` still contain a `workspace:^` that fails to rewrite (bug in npm or misconfiguration).
**→ Mitigation**: Add a dry-run verification step to CI (or a pre-release manual check): `npm publish --workspaces --dry-run` and inspect the output for any `workspace:` strings in the packed `package.json`.

**[Risk]** A consumer with an older npm (< 7) cannot install our packages because `workspace:^` is not understood.
**→ Mitigation**: This is only a concern inside our own workspace, not on the registry. At publish time, `workspace:^` is rewritten to `^<ver>` before upload, so the *published* `package.json` contains no `workspace:` protocol. Any npm version that understands standard semver works. Document `node: >=22.18.0` (already declared) in the engines field.

**[Risk]** `packages/electron` getting marked `private: true` accidentally breaks the Electron build pipeline.
**→ Mitigation**: `private: true` only blocks `npm publish`, not `npm install` or `electron-forge make`. The Electron workspace still installs, still builds, still produces DMG/DEB/EXE. Verify by running `npm run electron:make` after the change.

**[Risk]** Lockstep versioning silently breaks — some workspace version lags behind (e.g. a hotfix bumps only `shared`).
**→ Mitigation**: The `release-cut` skill already uses `--workspaces --include-workspace-root` for `npm version`, which enforces lockstep. Document the invariant explicitly in `docs/release-process.md`. If we ever *want* independent versions, `workspace:^` continues to work — only the release process assumption changes.

**[Trade-off]** Publishing 5 packages instead of 1 means 5× the npm registry surface area. More package names to squat-protect, more provenance attestations.
**→ Accepted**: This is intrinsic to any multi-package monorepo on npm. The alternative (bundle everything into the root, skip sub-packages) means downstream projects can't depend on individual pieces, which we already have inbound requests for (Electron installer's `bootstrapInstall` wants just the pinned pi-dashboard-server).

**[Trade-off]** Provenance attestation multi-package verification is marginally more complex for end users to audit.
**→ Accepted**: Each attestation still links back to the exact GitHub Actions run, so the audit trail per-package is just as clear as for a single package.

## Migration Plan

### Step 1 — Land the fix (0.3.1 patch release)

1. Apply all `package.json` changes (`workspace:*` → `workspace:^`, add `publishConfig`, mark electron private).
2. Update `.github/workflows/publish.yml` with the `-ws --include-workspace-root` flags.
3. Update `docs/release-process.md` and `.pi/skills/release-cut/SKILL.md` to reflect the multi-workspace publish.
4. Add a `CHANGELOG.md` entry under `[Unreleased] → Fixed`: *"0.3.0 on npm was unresolvable (sub-packages never published). 0.3.1 publishes the full workspace set so `npm i -g @blackbelt-technology/pi-agent-dashboard` works in a fresh environment."*
5. Dry-run locally: `npm publish --workspaces --include-workspace-root --dry-run`. Inspect output: each workspace should list `tarball size`, and no `workspace:` strings should appear in the packed `package.json` files.
6. Follow the standard `release-cut` skill for 0.3.1.

### Step 2 — Verify on registry (post-release)

After the `v0.3.1` tag push and CI run completes:

```bash
for p in pi-agent-dashboard pi-dashboard-shared pi-dashboard-extension pi-dashboard-server pi-dashboard-web; do
  npm view @blackbelt-technology/$p version
done
# Expected: 0.3.1 for all five, 404 for electron.

npm view @blackbelt-technology/pi-agent-dashboard@0.3.1 dependencies
# Expected: { ...: "^0.3.1" } — not "*"
```

Install-verify in a tmpdir:
```bash
cd $(mktemp -d) && npm init -y && npm install @blackbelt-technology/pi-agent-dashboard
# Expected: success, node_modules/@blackbelt-technology/ contains 4 sub-packages.
```

### Step 3 — Rollback strategy

If 0.3.1 ships broken:
1. `npm deprecate @blackbelt-technology/pi-agent-dashboard@0.3.1 "broken — use 0.3.2"` (and the same for each sub-package).
2. Fix the issue, ship 0.3.2.
3. npm does not allow unpublishing after 72 h or if any dependents exist, so `deprecate` is the standard recourse. The `release-revoke` skill automates this.

There is no "roll back to 0.3.0" option because 0.3.0 is itself broken. The fix is forward-only.

## Open Questions

1. **Should we deprecate 0.3.0 explicitly on npm?** Currently it sits installable-looking but unresolvable. Running `npm deprecate @blackbelt-technology/pi-agent-dashboard@0.3.0 "Unresolvable dependencies on npm; upgrade to 0.3.1+"` would surface the issue to anyone who tries. **Recommendation**: yes, as part of the 0.3.1 release checklist. Non-blocking for this change.

2. **Should `packages/client` publish its `src/` too?** Currently only `dist/` is shipped. If a downstream consumer wants to customize/extend the web UI, they need the TypeScript sources. **Recommendation**: defer — no known consumer asking for this, and adding `src/` increases tarball size. Can be added in a future change without breaking anything.

3. **Do we want a CI smoke test that installs the published tarball in a scratch directory after publish?** Would catch regressions like "the fix accidentally regressed". **Recommendation**: nice-to-have, out of scope for this change. File as a follow-up proposal.
