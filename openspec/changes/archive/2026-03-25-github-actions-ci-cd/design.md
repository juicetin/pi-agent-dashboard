## Context

The project has no CI/CD pipeline. Tests, linting, and builds are run manually. The package will be published to npm under `@blackbelt-technology/pi-dashboard`. We need automated quality gates on PRs and automated publishing on version tags.

## Goals / Non-Goals

**Goals:**
- Automated lint + test + build on every push and PR to `main`
- Automated npm publish when a `v*` tag is pushed
- Simple, maintainable workflow files

**Non-Goals:**
- Docker builds or container publishing
- Deployment to any hosting platform
- Auto-versioning or changelog generation
- Branch protection rule configuration (done manually in GitHub settings)

## Decisions

### Decision: Tag-based publishing (not merge-to-main)
Publishing triggers on `v*` tags rather than every merge to `main`. This gives explicit control over when releases happen. The developer bumps `package.json` version, commits, tags with `vX.Y.Z`, and pushes.

**Alternative considered**: Auto-publish on merge to main with `semantic-release`. Rejected — adds complexity and dependencies for a project that doesn't need frequent automated releases.

### Decision: Single CI workflow + separate publish workflow
Two workflow files:
- `ci.yml` — runs on push/PR, does lint + test + build
- `publish.yml` — runs on `v*` tags, runs CI checks then publishes

**Alternative considered**: Single workflow with conditional publish job. Rejected — separate files are clearer and easier to maintain.

### Decision: Node 22 only
Use Node.js 22 (LTS) as the single CI matrix version. The project uses ESM, modern Node APIs, and tsx — no need to test older versions.

### Decision: Use npm provenance
Enable `--provenance` flag on `npm publish` to provide supply chain transparency (links published package to its source commit and build).

## Risks / Trade-offs

- [Risk] `NPM_TOKEN` secret expires or is revoked → Publish workflow fails silently. Mitigation: token expiry notifications from npm, document the secret setup.
- [Risk] `prepare` script runs `vite build` during `npm install` in CI → Mitigation: this is expected and ensures the client bundle is built before publish.
- [Trade-off] Tag-based publish requires manual version bumping → acceptable for current project scale.
