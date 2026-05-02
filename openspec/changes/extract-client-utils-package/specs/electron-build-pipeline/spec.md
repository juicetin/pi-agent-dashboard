## ADDED Requirements

### Requirement: No cross-package deep relative imports
Workspace packages SHALL NOT import from sibling workspace packages via
deep relative paths (e.g. `from "../../../<other-package>/src/..."`).
Cross-workspace imports MUST use the canonical npm package name. This
ensures that published tarballs do not contain broken paths that only
work inside the monorepo's symlink topology.

#### Scenario: Lint catches new deep relative imports
- **WHEN** any `*.ts` or `*.tsx` file under `packages/<a>/src/`
  contains an import that resolves into `packages/<b>/`
- **THEN** the repo-lint test
  `packages/shared/src/__tests__/no-cross-package-deep-imports.test.ts`
  SHALL fail with a `file:line:col` citation pointing at the offending
  import
- **AND** the failure message SHALL reference change
  `extract-client-utils-package` so the contributor knows where the
  rule comes from

#### Scenario: Per-line opt-out via comment
- **WHEN** a deep relative import is genuinely necessary (e.g. dev
  tooling that's never published)
- **THEN** the contributor MAY add `// ban:cross-package-deep-import-ok`
  on the same line as a documented opt-out
- **AND** the lint SHALL skip that line

#### Scenario: Plugin-to-client-utils import is allowed
- **WHEN** `packages/flows-plugin/` or `packages/jj-plugin/` imports
  from `@blackbelt-technology/pi-dashboard-client-utils`
- **THEN** the lint SHALL accept the import (canonical package name,
  not a deep relative path)
- **AND** the resolved path SHALL go through the workspace symlink in
  development and through `node_modules/` in CI / consumer installs
  identically

### Requirement: Plugin tarball cleanliness
Published plugin tarballs SHALL NOT contain any deep relative import that traverses into a sibling workspace's source tree, and verification MUST run at npm pack dry-run time during the publish workflow.

#### Scenario: Pre-publish smoke verifies tarball cleanliness
- **WHEN** the publish workflow's per-package loop runs `npm pack --dry-run` for a plugin
- **THEN** a follow-up grep over the listed files SHALL fail the build if any file contains a deep relative import targeting a sibling package's source tree
- **AND** the failure message SHALL cite this scenario and change `extract-client-utils-package`
