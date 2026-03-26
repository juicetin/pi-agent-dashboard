### Requirement: CI workflow on push and PR
The project SHALL have a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every push to `main` and on every pull request targeting `main`. The workflow SHALL execute lint, test, and build steps in sequence on Node.js 22.

#### Scenario: PR triggers CI
- **WHEN** a pull request is opened or updated targeting the `main` branch
- **THEN** the CI workflow SHALL run `npm ci`, `npm run lint`, `npm test`, and `npm run build` in that order

#### Scenario: Push to main triggers CI
- **WHEN** a commit is pushed directly to `main`
- **THEN** the CI workflow SHALL run the same lint, test, and build steps

#### Scenario: CI failure blocks merge
- **WHEN** any CI step (lint, test, or build) fails
- **THEN** the workflow SHALL report a failed status check on the PR

### Requirement: Publish workflow on version tags
The project SHALL have a GitHub Actions workflow (`.github/workflows/publish.yml`) that triggers when a tag matching `v*` is pushed. The workflow SHALL run CI checks (lint, test, build) and then publish the package to npm with public access and provenance.

#### Scenario: Version tag triggers publish
- **WHEN** a tag matching `v*` (e.g., `v1.0.0`) is pushed
- **THEN** the publish workflow SHALL run lint, test, build, and then `npm publish --access public --provenance`

#### Scenario: Publish uses NPM_TOKEN secret
- **WHEN** the publish step runs
- **THEN** it SHALL authenticate to npm using the `NPM_TOKEN` repository secret via the `NODE_AUTH_TOKEN` environment variable

#### Scenario: CI failure prevents publish
- **WHEN** lint, test, or build fails during the publish workflow
- **THEN** the npm publish step SHALL NOT execute

### Requirement: Node.js version
Both CI and publish workflows SHALL use Node.js 22 as the runtime version.

#### Scenario: Node 22 used in CI
- **WHEN** the CI workflow runs
- **THEN** it SHALL set up Node.js 22 using `actions/setup-node`

### Requirement: npm provenance
The publish workflow SHALL use the `--provenance` flag when publishing to npm to provide supply chain transparency.

#### Scenario: Package published with provenance
- **WHEN** the package is published to npm
- **THEN** the published package SHALL include provenance attestation linking it to the source commit and GitHub Actions build
