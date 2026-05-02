## ADDED Requirements

### Requirement: Runtime workspaces are published to the public npm registry

Every runtime workspace under `packages/` — specifically `shared`, `extension`, `server`, and `client` (published as `-web`) — SHALL be published to the public npm registry under the `@blackbelt-technology/pi-dashboard-*` scope on every tagged release.

#### Scenario: All runtime workspace names resolve on registry after release

- **WHEN** a `v<version>` tag is pushed and the release workflow completes
- **THEN** `npm view @blackbelt-technology/pi-dashboard-shared version` SHALL return `<version>`
- **AND** `npm view @blackbelt-technology/pi-dashboard-extension version` SHALL return `<version>`
- **AND** `npm view @blackbelt-technology/pi-dashboard-server version` SHALL return `<version>`
- **AND** `npm view @blackbelt-technology/pi-dashboard-web version` SHALL return `<version>`
- **AND** `npm view @blackbelt-technology/pi-agent-dashboard version` SHALL return `<version>`

#### Scenario: Fresh install of the root metapackage succeeds

- **WHEN** a user runs `npm install @blackbelt-technology/pi-agent-dashboard` in an empty project directory
- **THEN** the install SHALL complete without E404 errors
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-shared/` SHALL exist
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-extension/` SHALL exist
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-server/` SHALL exist
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-web/` SHALL exist

### Requirement: Cross-workspace dependencies use plain semver ranges

Every `dependencies` entry in any workspace's `package.json` that references another package in the same monorepo SHALL use a plain semver caret range (e.g. `"^0.3.0"`), not the `workspace:` protocol. The npm CLI does not implement the `workspace:` protocol and rejects all variants (`workspace:*`, `workspace:^`, `workspace:~`, `workspace:<ver>`) with `EUNSUPPORTEDPROTOCOL` on fresh installs; plain semver is the only specifier form that works on both development installs (via workspace symlink resolution) and published tarballs.

#### Scenario: No workspace: protocol specifiers exist

- **WHEN** grepping any `package.json` in the repository for the literal string `"workspace:"`
- **THEN** zero matches SHALL be found in any `dependencies`, `devDependencies`, or `peerDependencies` block

#### Scenario: Root package cross-refs use plain semver

- **WHEN** reading the root `package.json` `dependencies` field
- **THEN** `@blackbelt-technology/pi-dashboard-extension` SHALL match the pattern `^<digits>.<digits>.<digits>`
- **AND** `@blackbelt-technology/pi-dashboard-server` SHALL match the same pattern
- **AND** `@blackbelt-technology/pi-dashboard-web` SHALL match the same pattern

#### Scenario: Server package cross-refs use plain semver

- **WHEN** reading `packages/server/package.json`
- **THEN** `@blackbelt-technology/pi-dashboard-shared` SHALL match the pattern `^<digits>.<digits>.<digits>`
- **AND** `@blackbelt-technology/pi-dashboard-extension` SHALL match the same pattern

#### Scenario: Extension, client, and electron cross-refs use plain semver

- **WHEN** reading `packages/extension/package.json`, `packages/client/package.json`, and `packages/electron/package.json`
- **THEN** each `@blackbelt-technology/pi-dashboard-shared` entry SHALL match the pattern `^<digits>.<digits>.<digits>`

#### Scenario: Local development install symlinks workspaces

- **WHEN** running `rm -rf node_modules package-lock.json && npm install` at the repo root
- **THEN** the install SHALL complete successfully
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-shared` SHALL be a symlink to `packages/shared`
- **AND** the server, extension, and client workspaces SHALL similarly symlink to their local copies

### Requirement: A sync-versions script keeps inter-package dep specifiers aligned

The repository SHALL provide a `scripts/sync-versions.js` helper that, given a lockstep-bumped monorepo, rewrites every inter-package dependency specifier in every workspace `package.json` to `^<current-version>`. It SHALL be invoked as part of any version bump in the release flow, after `npm version -ws --include-workspace-root`.

#### Scenario: Script exists and is executable

- **WHEN** listing `scripts/sync-versions.js`
- **THEN** the file SHALL exist
- **AND** it SHALL be a valid Node.js ES module or CommonJS script with no runtime dependencies beyond Node built-ins

#### Scenario: Script verifies lockstep versioning

- **WHEN** the script is invoked while any `packages/*/package.json` version differs from the root `package.json` version
- **THEN** the script SHALL exit non-zero with an error indicating lockstep violation
- **AND** no `package.json` file SHALL be modified

#### Scenario: Script rewrites inter-package dep specifiers

- **WHEN** every workspace and the root share version `X.Y.Z` and the script is invoked
- **THEN** every `dependencies` or `devDependencies` entry whose name matches a known `@blackbelt-technology/pi-dashboard-*` workspace SHALL be rewritten to `^X.Y.Z`
- **AND** no other fields in any `package.json` SHALL be modified

#### Scenario: Script is a no-op when already in sync

- **WHEN** the script is invoked after a fresh bump + sync, with no intermediate changes
- **THEN** the script SHALL exit zero
- **AND** no files SHALL be written

### Requirement: Published tarballs contain resolvable concrete semver dependencies

Every published tarball's `package.json` `dependencies` field SHALL contain concrete semver ranges matching the current release's version. No `dependencies` value SHALL be `"*"`, the empty string, or any `workspace:` protocol specifier.

#### Scenario: Published root metapackage has correct deps

- **WHEN** running `npm view @blackbelt-technology/pi-agent-dashboard@<version> dependencies`
- **THEN** `@blackbelt-technology/pi-dashboard-extension` SHALL match the pattern `^<version>`
- **AND** `@blackbelt-technology/pi-dashboard-server` SHALL match the pattern `^<version>`
- **AND** `@blackbelt-technology/pi-dashboard-web` SHALL match the pattern `^<version>`
- **AND** no value SHALL be `"*"` or contain `"workspace:"`

#### Scenario: Dry-run output shows no workspace protocol strings

- **WHEN** running `npm publish --workspaces --include-workspace-root --dry-run` locally
- **THEN** the dry-run output for each workspace SHALL NOT contain the string `"workspace:"`

### Requirement: The Electron workspace is private and not published to npm

`packages/electron` SHALL declare `"private": true` in its `package.json` so that `npm publish --workspaces` automatically skips it. The Electron package ships as native installers (DMG, DEB, AppImage, EXE) attached to the GitHub Release, never as an npm tarball.

#### Scenario: Electron package is marked private

- **WHEN** reading `packages/electron/package.json`
- **THEN** the top-level `"private"` field SHALL be `true`

#### Scenario: Electron package is absent from npm registry after release

- **WHEN** running `npm view @blackbelt-technology/pi-dashboard-electron` after a release
- **THEN** npm SHALL return a 404 / "not found" response
- **AND** no version of the package SHALL be present on the registry

#### Scenario: Electron build pipeline still works

- **WHEN** running `npm run electron:make` after the private marker is added
- **THEN** the Electron Forge build SHALL complete and produce platform-native installers in `packages/electron/out/`

### Requirement: Each published workspace declares public access

Every workspace that is published to npm SHALL declare `"publishConfig": { "access": "public" }` in its `package.json`. This is required because `npm publish --workspaces` iterates per-workspace and consults each workspace's own `publishConfig` (the top-level `--access` CLI flag does not propagate).

#### Scenario: Root has public publishConfig

- **WHEN** reading the root `package.json`
- **THEN** `publishConfig.access` SHALL be `"public"`

#### Scenario: Shared has public publishConfig

- **WHEN** reading `packages/shared/package.json`
- **THEN** `publishConfig.access` SHALL be `"public"`

#### Scenario: Extension has public publishConfig

- **WHEN** reading `packages/extension/package.json`
- **THEN** `publishConfig.access` SHALL be `"public"`

#### Scenario: Server has public publishConfig

- **WHEN** reading `packages/server/package.json`
- **THEN** `publishConfig.access` SHALL be `"public"`

#### Scenario: Client has public publishConfig

- **WHEN** reading `packages/client/package.json`
- **THEN** `publishConfig.access` SHALL be `"public"`

### Requirement: Release workflow publishes all workspaces with provenance

The GitHub Actions `publish` job in `.github/workflows/publish.yml` SHALL publish all non-private workspaces and the root in a single invocation, with npm provenance attestation.

#### Scenario: Publish command uses --workspaces --include-workspace-root

- **WHEN** reading `.github/workflows/publish.yml`
- **THEN** the publish step SHALL invoke `npm publish` with flags `--workspaces --include-workspace-root --provenance --access public`

#### Scenario: Provenance attestation exists for each published package

- **WHEN** running `npm view @blackbelt-technology/pi-dashboard-<name>@<version>` for any published workspace after a tag release
- **THEN** the registry metadata SHALL include a `dist.attestations` field referencing the corresponding GitHub Actions workflow run

### Requirement: Lockstep versioning across published workspaces

All published workspaces and the root SHALL share one version number, bumped atomically at release time and kept in sync by `scripts/sync-versions.js` as a post-bump step.

#### Scenario: All versions match after release

- **WHEN** comparing `version` fields in the root `package.json` and every `packages/*/package.json`
- **THEN** every `version` field SHALL contain the identical string

#### Scenario: Registry versions match across the package set

- **WHEN** querying `npm view @blackbelt-technology/pi-<name> version` for root + 4 runtime packages after a tagged release
- **THEN** all five SHALL return the same version string
