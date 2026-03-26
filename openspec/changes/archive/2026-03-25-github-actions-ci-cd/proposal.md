## Why

There is no automated testing or publishing pipeline. Every release is manual and untested. GitHub Actions will ensure PRs are validated (lint, test, build) and npm publishing happens automatically on version tags.

## What Changes

- Add a CI workflow (`.github/workflows/ci.yml`) that runs on pushes and PRs to `main`: lint, test, build
- Add a publish workflow (`.github/workflows/publish.yml`) that triggers on `v*` tags: runs CI checks then publishes to npm under `@blackbelt-technology` scope
- Requires `NPM_TOKEN` repository secret configured in GitHub

## Capabilities

### New Capabilities
- `ci-cd-pipeline`: GitHub Actions workflows for continuous integration (lint, test, build) and automated npm publishing on version tags

### Modified Capabilities
_(none — this is infrastructure only, no spec-level behavior changes)_

## Impact

- New `.github/workflows/ci.yml`
- New `.github/workflows/publish.yml`
- GitHub repo settings: needs `NPM_TOKEN` secret
