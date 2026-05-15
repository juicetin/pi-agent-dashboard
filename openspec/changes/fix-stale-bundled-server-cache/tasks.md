## Tasks

### 1. build-installer.sh — freshness check

- [ ] 1.1 Replace the `[ ! -d "$ELECTRON_DIR/resources/server/node_modules" ]` gate with a stamp-file mtime comparison against the four watched sources (server/src, extension/src, dist/client/index.html, bundle-server.mjs).
- [ ] 1.2 Preserve the cross-arch invocation (`TARGET_ARCH="$cross_target_arch_env" $cross_prefix node ...`) inside the new gate.
- [ ] 1.3 Update the "✓ Bundled server already present" message to "✓ Bundled server cache is fresh (stamp <ts>)" when skipping.

### 2. bundle-server.mjs — hard failures

- [ ] 2.1 Replace the `"WARNING: No built client found"` block with `console.error(...)` + `process.exit(1)`. Error message SHALL name the searched paths and instruct running `npm run build`.
- [ ] 2.2 At end of script (after materialization step), assert `<SERVER_BUNDLE>/node_modules/@blackbelt-technology/pi-dashboard-web/dist/index.html` exists. If absent, exit non-zero with a message identifying the materialization step.
- [ ] 2.3 On successful exit, write `<SERVER_BUNDLE>/.bundle-stamp` containing `<git-sha-short>-<unix-ts>`.

### 3. Repo-lint test

- [ ] 3.1 Add `packages/shared/src/__tests__/bundled-server-materialization.test.ts` that walks every `resources/server/` under the workspace and asserts the `pi-dashboard-web/dist/index.html` materialization is present.
- [ ] 3.2 Verify the test fails on a deliberately-broken bundle and passes after running `bundle-server.mjs`.

### 4. Documentation

- [ ] 4.1 Update `docs/file-index-electron.md` row for `bundle-server.mjs` to describe the stamp-file contract and the hard-fail post-condition.
- [ ] 4.2 Update `docs/file-index-electron.md` row for `build-installer.sh` to describe the freshness check.
- [ ] 4.3 Add a `docs/faq.md` entry: "Electron build shows 'Bundled server already present' but my changes don't appear — what now?" → "Delete `packages/electron/resources/server/.bundle-stamp` and rebuild; or `rm -rf packages/electron/resources/server/` for a full reset."

### 5. Smoke-test the new pipeline

- [ ] 5.1 Run `./packages/electron/scripts/build-installer.sh` on a clean checkout; confirm bundler runs (no stamp yet).
- [ ] 5.2 Run again immediately; confirm bundler skips with the new "cache is fresh" message.
- [ ] 5.3 `touch packages/server/src/server.ts`; run again; confirm bundler re-runs.
- [ ] 5.4 Temporarily break `bundle-server.mjs`'s materialization step; confirm post-verify fails with the expected message.

### 6. Release

- [ ] 6.1 CHANGELOG entry under `## [Unreleased]` → `### Build`: "Electron: rebundle dashboard server when sources change; fail loudly when client materialization is missing (fix-stale-bundled-server-cache)".
