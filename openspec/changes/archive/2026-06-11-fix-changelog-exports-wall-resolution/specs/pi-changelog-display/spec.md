# pi-changelog-display — delta

## ADDED Requirements

### Requirement: CHANGELOG file resolution robustness

The server SHALL locate an installed core package's `CHANGELOG.md` even when the
package's `package.json#exports` field blocks module-resolution access to its
subpaths. Resolution SHALL try, in order: (1) the managed install directory,
(2) bare-import via `require.resolve`, (3) a filesystem walk up `node_modules`
from the server module's own location. The "package not installed returns empty"
response SHALL be produced only when all three strategies fail.

#### Scenario: Exports field blocks require.resolve but file present

- **WHEN** the requested package is in the core whitelist
- **AND** the managed install directory does not contain the package
- **AND** the package's `exports` field omits `"./package.json"` and declares no
  `require`/`default` condition, so `require.resolve("<pkg>/package.json")` throws
- **AND** `CHANGELOG.md` exists at `node_modules/<pkg>/CHANGELOG.md` reachable by
  walking up from the server module location
- **THEN** the server SHALL locate that `CHANGELOG.md` via the filesystem walk
- **AND** SHALL NOT return the empty "package not installed" response
- **AND** the route SHALL proceed to derive `changelogUrl` and run the
  remote-first / local-fallback fetch flow

#### Scenario: Strategy precedence preserved

- **WHEN** the managed install directory contains the package's `CHANGELOG.md`
- **THEN** the server SHALL use the managed copy
- **AND** SHALL NOT perform the filesystem walk

#### Scenario: All strategies fail returns empty

- **WHEN** the package is not in the managed directory
- **AND** bare-import resolution fails
- **AND** no `node_modules/<pkg>/CHANGELOG.md` is found by walking up from the
  server module location
- **THEN** the server SHALL respond `200` with `releases: []`, `hasBreaking: false`,
  `changelogUrl: null` per the existing "Package not installed returns empty"
  scenario
