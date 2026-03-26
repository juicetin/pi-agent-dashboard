## 1. CI Workflow

- [x] 1.1 Create `.github/workflows/ci.yml` with trigger on push to `main` and PRs targeting `main`
- [x] 1.2 Add steps: checkout, setup Node 22, `npm ci`, `npm run lint`, `npm test`, `npm run build`
- [x] 1.3 Verify workflow runs correctly on a test push/PR

## 2. Publish Workflow

- [x] 2.1 Create `.github/workflows/publish.yml` with trigger on `v*` tags
- [x] 2.2 Add CI steps (lint, test, build) before publish
- [x] 2.3 Add npm publish step with `--access public --provenance`, using `NODE_AUTH_TOKEN` from `NPM_TOKEN` secret
- [x] 2.4 Set `id-token: write` permission for provenance attestation

## 3. Documentation

- [x] 3.1 Document the release process in README (version bump, tag, push)
- [x] 3.2 Document `NPM_TOKEN` secret setup requirement
