## ADDED Requirements

### Requirement: No `shell: bash` on Windows-runnable workflow steps
No step in `.github/workflows/publish.yml` or `.github/workflows/ci.yml` SHALL combine `shell: bash` with a runtime configuration that can run on a Windows runner. The combination is forbidden because Git for Windows' MSYS2 layer translates POSIX-style paths in a way that does not survive being embedded in arguments to native binaries (notably `node.exe` and `cmd.exe` shims), producing a recurring class of latent bugs. Cross-OS build orchestration SHALL be expressed in `.mjs` scripts invoked by `node`. POSIX-only steps MAY use `shell: bash` provided they are gated by an `if:` filter that excludes Windows. Windows-only steps MAY use `shell: pwsh`.

#### Scenario: workflow has zero Windows-reachable bash steps
- **WHEN** `.github/workflows/publish.yml` is parsed and each step's matrix-platform reachability is computed
- **THEN** no step that is reachable on `windows-latest` SHALL declare `shell: bash`

#### Scenario: POSIX-only bash step is allowed
- **WHEN** a step declares `shell: bash` AND its `if:` filter evaluates to false on every Windows matrix variant
- **THEN** the step is permitted (the bash invocation never reaches a Windows runner)

#### Scenario: Windows-only pwsh step is allowed
- **WHEN** a step declares `shell: pwsh` AND its `if:` filter restricts execution to Windows variants
- **THEN** the step is permitted (Windows-native shell, no MSYS dependency)

### Requirement: Repo-lint test enforces the no-bash-on-Windows invariant
The repository SHALL contain an automated test (`packages/shared/src/__tests__/no-bash-on-windows.test.ts`) that parses the relevant workflow YAML files, computes per-step Windows reachability from the `electron` job's matrix and each step's `if:` filter, and fails when any `shell: bash` step is reachable on a Windows runner. The test SHALL run as part of `npm test` so a future workflow refactor cannot silently violate the invariant.

#### Scenario: Test fails when a Windows-reachable bash step is added
- **WHEN** a contributor adds a step with `shell: bash` and an `if:` filter that includes Windows variants (or no filter at all)
- **THEN** `npm test` SHALL fail with a message that names the step and cites change `eliminate-bash-on-windows-runners`

#### Scenario: Test passes when all bash steps are POSIX-gated
- **WHEN** every `shell: bash` step in the workflow is gated by an `if:` filter that excludes Windows
- **THEN** `npm test` SHALL pass without warnings related to the bash-on-Windows invariant

#### Scenario: Test ignores `ci.yml` steps that don't match a Windows matrix
- **WHEN** the CI workflow runs on `ubuntu-latest` only (no Windows matrix)
- **THEN** its `shell: bash` steps are NOT flagged because they are unreachable on Windows by definition

## MODIFIED Requirements

### Requirement: Publish workflow on version tags
The project SHALL have a GitHub Actions workflow (`.github/workflows/publish.yml`) that triggers when a tag matching `v*` is pushed (or via `workflow_dispatch` with a `version` input). The workflow SHALL run lint, test, and build steps and then publish the package to npm with public access and provenance, then build Electron distributables on a per-OS matrix (macOS, Linux x64, Linux arm64, Windows x64, Windows arm64). The Electron matrix SHALL execute build orchestration via `.mjs` scripts (Node-native) for any logic that runs on more than one OS; SHALL NOT use `shell: bash` on any Windows-reachable step.

#### Scenario: Version tag triggers publish
- **WHEN** a tag matching `v*` (e.g., `v1.0.0`) is pushed
- **THEN** the publish workflow SHALL run lint, test, build, and then `npm publish --access public --provenance`

#### Scenario: Publish uses NPM_TOKEN secret
- **WHEN** the publish step runs
- **THEN** it SHALL authenticate to npm using the `NPM_TOKEN` repository secret via the `NODE_AUTH_TOKEN` environment variable

#### Scenario: CI failure prevents publish
- **WHEN** lint, test, or build fails during the publish workflow
- **THEN** the npm publish step SHALL NOT execute

#### Scenario: Windows electron build invokes only Windows-native tooling
- **WHEN** the electron matrix's `windows-latest` variant runs
- **THEN** every step SHALL execute via `cmd.exe` (default), `pwsh`, or directly via `node` — no step SHALL execute via `bash`
