## 1. Package manifest changes

- [x] 1.1 In root `package.json`, change all three inter-package `dependencies` from `"workspace:*"` to `"^<current-version>"` (e.g. `^0.3.0`): `@blackbelt-technology/pi-dashboard-extension`, `-server`, `-web`
- [x] 1.2 In `packages/shared/package.json`, add `"publishConfig": { "access": "public" }`
- [x] 1.3 In `packages/extension/package.json`, change `@blackbelt-technology/pi-dashboard-shared` to `"^<current-version>"` and add `"publishConfig": { "access": "public" }`
- [x] 1.4 In `packages/server/package.json`, change both inter-package deps to `"^<current-version>"` (`pi-dashboard-shared`, `pi-dashboard-extension`) and add `"publishConfig": { "access": "public" }`
- [x] 1.5 In `packages/client/package.json`, change `@blackbelt-technology/pi-dashboard-shared` to `"^<current-version>"` and add `"publishConfig": { "access": "public" }`
- [x] 1.6 In `packages/electron/package.json`, change `@blackbelt-technology/pi-dashboard-shared` to `"^<current-version>"` and add `"private": true` at the top level
- [x] 1.7 Verify with `grep -rn '"workspace:' package.json packages/*/package.json` — zero matches expected

## 1b. sync-versions.js helper

- [x] 1b.1 Create `scripts/sync-versions.js` (port of pi-mono's script, ~100 lines, Node built-ins only). Steps: enumerate `packages/*/package.json` + root, build name→version map, assert lockstep, rewrite every inter-package `dependencies`/`devDependencies` entry to `^<that-workspace's-version>`, write only on change.
- [x] 1b.2 Make the script executable (`chmod +x scripts/sync-versions.js`) and verify it runs as `node scripts/sync-versions.js` with no args.
- [x] 1b.3 Add a smoke test: invoke `node scripts/sync-versions.js` on the current tree — expected output: "All inter-package dependencies already in sync" (no files rewritten, zero exit code).

## 2. CI workflow

- [x] 2.1 In `.github/workflows/publish.yml`, change the publish step from `npm publish --provenance --access public` to `npm publish --workspaces --include-workspace-root --provenance --access public`
- [x] 2.2 Confirm the `npm version` step immediately above still uses `--workspaces --include-workspace-root` (no change needed, just verify)
- [x] 2.3 In `.github/workflows/publish.yml`, insert a step between `Set version from tag` and `npm run build` that runs `node scripts/sync-versions.js` so CI publishes a consistent version-linked set even if a human forgot to run it locally.

## 3. Install & dry-run verification (local, before tagging)

- [x] 3.1 Run `npm install` at the repo root — should succeed, symlink `packages/*` into `node_modules/@blackbelt-technology/`
- [x] 3.2 Run `npm test` — full test suite passes (no behavioural code changes, so this is a regression check)
- [x] 3.3 Run `npm run build` — client dist produces without errors
- [x] 3.4 Run `npm publish --workspaces --include-workspace-root --dry-run` and inspect output:
  - Each of root + `shared`, `extension`, `server`, `web` appears in the output with a `Tarball Details` block
  - `electron` is skipped with `npm warn publish Skipping workspace ... marked as private`
  - Zero `"workspace:"` strings in any packed manifest
  - 5 `+` lines at the end confirm the 5 packages that would publish

## 4. Electron build regression check

- [x] 4.1 Run `npm run electron:make` (or at minimum `npm run electron:package`) — verified: `packages/electron && npm run package` completes successfully with the `private: true` marker in place. The Forge build packages the app into `packages/electron/out/` without issues.

## 5. Documentation

- [x] 5.1 Update `docs/release-process.md` "What CI Does" section: replace the one-line "publishes the npm package" bullet with an explicit description of the fan-out: root + 4 runtime workspaces, `sync-versions.js` step, Electron skipped via `private: true`
- [x] 5.2 Update `.pi/skills/release-cut/SKILL.md` to (a) add a step that invokes `node scripts/sync-versions.js` immediately after `npm version ... --workspaces --include-workspace-root`, and (b) reference the multi-workspace publish behaviour in the "What CI Does" callout
- [x] 5.3 Update root `AGENTS.md` key-files section to note the `sync-versions.js` helper, the plain-semver cross-ref convention, and the Electron `private: true` marker
- [x] 5.4 Add a `CHANGELOG.md` entry under `## [Unreleased] → Fixed` describing the fix and its end-user impact

## 6. Release & post-release verification

- [ ] 6.1 Invoke the `release-cut` skill for the next version (0.3.1) — follows the standard flow, no special instructions needed
- [ ] 6.2 After `v0.3.1` tag CI run completes, verify on the live registry:
  - `npm view @blackbelt-technology/pi-dashboard-shared version` returns `0.3.1`
  - Same for `-extension`, `-server`, `-web`, and root `pi-agent-dashboard`
  - `npm view @blackbelt-technology/pi-dashboard-electron` returns 404
  - `npm view @blackbelt-technology/pi-agent-dashboard@0.3.1 dependencies` shows `"^0.3.1"` values, no `"*"`
- [ ] 6.3 Install-verify in a scratch directory: `cd $(mktemp -d) && npm init -y && npm install @blackbelt-technology/pi-agent-dashboard` — completes without E404
- [ ] 6.4 Deprecate the broken 0.3.0: `npm deprecate '@blackbelt-technology/pi-agent-dashboard@0.3.0' 'Unresolvable dependencies on npm; upgrade to 0.3.1+'` (do the same for any sub-package that had a 0.3.0 if relevant — none did, because they were never published)

## 7. OpenSpec sync

- [ ] 7.1 After the release ships and verification passes, run the `openspec-archive-change` skill to archive `fix-workspace-publishing` and sync the new/modified requirements into `openspec/specs/workspace-publishing/spec.md` and `openspec/specs/monorepo-workspace-structure/spec.md`
