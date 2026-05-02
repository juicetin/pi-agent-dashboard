## ADDED Requirements

### Requirement: Runtime packages are public on npm, Electron package is private

Each of the four runtime workspace packages (`shared`, `extension`, `server`, `client`/`-web`) SHALL be published to the public npm registry. The `packages/electron` workspace SHALL be marked `"private": true` and SHALL NOT be published to npm; it is distributed exclusively as platform-native installers through GitHub Releases.

#### Scenario: Runtime packages published, Electron excluded

- **WHEN** listing `@blackbelt-technology/pi-dashboard-*` packages on the npm registry after a release
- **THEN** `shared`, `extension`, `server`, and `web` SHALL each have a published version
- **AND** `electron` SHALL NOT be present on the registry

#### Scenario: Electron workspace declares private

- **WHEN** reading `packages/electron/package.json`
- **THEN** `"private": true` SHALL be set at the top level

### Requirement: Cross-package dependency specifiers use plain semver ranges

All cross-package dependency entries in every workspace `package.json` (including the root) SHALL use plain semver caret ranges (e.g. `"^0.3.0"`). The `workspace:` protocol (any variant) is NOT supported by the npm CLI and MUST NOT be used. Lockstep version consistency across the monorepo is maintained by `scripts/sync-versions.js` at release time.

#### Scenario: No workspace: protocol specifiers exist

- **WHEN** scanning all `package.json` files in the repository for inter-package dependencies within the `@blackbelt-technology/pi-dashboard-*` scope
- **THEN** every such entry SHALL match a plain semver caret range pattern (`^<digits>.<digits>.<digits>`)
- **AND** no entry SHALL contain the string `"workspace:"`

#### Scenario: Development install symlinks local workspaces

- **WHEN** running `rm -rf node_modules package-lock.json && npm install` from the repository root with plain-semver specifiers in place
- **THEN** the install SHALL succeed without `EUNSUPPORTEDPROTOCOL` errors
- **AND** `node_modules/@blackbelt-technology/pi-dashboard-shared` SHALL be a symlink to `packages/shared`
- **AND** the server, extension, and client workspaces SHALL similarly symlink to their local copies
