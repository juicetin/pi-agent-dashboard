## ADDED Requirements

### Requirement: client-utils package is part of the monorepo

The repository's npm workspace layout SHALL include `packages/client-utils/` as a published runtime workspace alongside the existing runtime workspaces (`shared`, `server`, `extension`, `client`). The root `package.json#workspaces` array SHALL include `"packages/client-utils"`.

The package SHALL satisfy the existing `monorepo-workspace-structure` requirements applicable to public runtime workspaces:

- Naming convention: `@blackbelt-technology/pi-dashboard-client-utils`
- Public access (`publishConfig.access: "public"`)
- Lockstep version with other runtime workspaces
- Plain semver caret ranges for inter-package deps (no `workspace:` protocol)
- Imports use package-name paths internally (no deep relative paths into other workspaces)

#### Scenario: client-utils is listed as a workspace

- **WHEN** reading the root `package.json#workspaces`
- **THEN** the array SHALL contain `"packages/client-utils"`

#### Scenario: client-utils has correct naming and public access

- **WHEN** reading `packages/client-utils/package.json`
- **THEN** `name` SHALL be `"@blackbelt-technology/pi-dashboard-client-utils"`
- **AND** `publishConfig.access` SHALL be `"public"`
- **AND** `version` SHALL match the root `package.json#version`

### Requirement: Cross-package deep imports are forbidden

Source files in any workspace under `packages/` SHALL NOT import from sibling workspaces via paths that escape the importing package's own boundary. Specifically, no source file SHALL contain an import specifier that:

- Starts with `..` and resolves outside the importing package's `src/` directory, AND
- Targets another workspace (i.e. crosses into a different `packages/<name>/` directory)

The single exception is the legacy re-export shims at `packages/client/src/{components,hooks,components/extension-ui}/<file>.tsx` that re-export from `@blackbelt-technology/pi-dashboard-client-utils/<symbol>`. These shims use the package-name path (not a deep relative path), so they comply with the rule.

A repository-level lint test SHALL enforce this rule by scanning every `*.ts` and `*.tsx` file under `packages/*/src/` and failing CI when any import specifier matches a cross-package escape pattern.

#### Scenario: Lint passes on a clean repository

- **WHEN** running `npm test` against a checkout where every cross-package import uses package-name paths
- **THEN** the lint test `no-cross-package-deep-imports.test.ts` SHALL pass

#### Scenario: Lint fails on a regression

- **WHEN** a developer adds `import { Foo } from "../../../client/src/components/Foo.js"` to a file under `packages/flows-plugin/src/`
- **THEN** the lint test SHALL fail
- **AND** the failure message SHALL identify the offending file path and the offending specifier

#### Scenario: Lint allows package-name imports

- **WHEN** a file under `packages/flows-plugin/src/` imports `from "@blackbelt-technology/pi-dashboard-client-utils/MarkdownContent"`
- **THEN** the lint test SHALL NOT flag this import

#### Scenario: Lint allows intra-package relative imports

- **WHEN** a file under `packages/flows-plugin/src/client/` imports `from "./helpers.js"` or `from "../reducer.js"`
- **THEN** the lint test SHALL NOT flag these imports (they remain inside the same package)

### Requirement: flows-plugin and jj-plugin depend on client-utils via npm

`packages/flows-plugin/package.json` and `packages/jj-plugin/package.json` SHALL each declare `@blackbelt-technology/pi-dashboard-client-utils` as a runtime `dependency` (not `peerDependency`, not `devDependency`) with a plain semver caret range matching the lockstep version.

Their source files SHALL import client-utils symbols exclusively via the package name (per the cross-package deep import lint above).

#### Scenario: flows-plugin declares client-utils dependency

- **WHEN** reading `packages/flows-plugin/package.json#dependencies`
- **THEN** the object SHALL contain `"@blackbelt-technology/pi-dashboard-client-utils": "^X.Y.Z"` where `X.Y.Z` matches the root version

#### Scenario: jj-plugin declares client-utils dependency

- **WHEN** reading `packages/jj-plugin/package.json#dependencies`
- **THEN** the object SHALL contain `"@blackbelt-technology/pi-dashboard-client-utils": "^X.Y.Z"` where `X.Y.Z` matches the root version
