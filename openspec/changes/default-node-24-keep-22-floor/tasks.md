# Tasks

## 1. Bump default runtime to Node 24
- [ ] 1.1 `docker/Dockerfile`: change `FROM node:22-bookworm-slim AS base` → `node:24-bookworm-slim`; update the Stage `base` comment (line ~5) from "Node 22 LTS" → "Node 24 LTS". → verify: `grep -n 'node:24-bookworm-slim' docker/Dockerfile`
- [ ] 1.2 `scripts/test-standalone-npm-install-docker.sh`: set `IMAGE="node:24-bookworm-slim"` (line ~37); update usage comments to show 24 as default and keep a `node:22-bookworm-slim` example. → verify: `grep -nE '^IMAGE=' scripts/test-standalone-npm-install-docker.sh`

## 2. Confirm non-breaking invariants (no edits expected)
- [ ] 2.1 `package.json` `engines.node` stays `>=22.19.0 <26` (already permits 24). → verify: `grep -n '"node"' package.json`
- [ ] 2.2 `.github/workflows/ci.yml` PR lane stays `node-version: 22` (guards the floor). → verify: `grep -n 'node-version' .github/workflows/ci.yml`
- [ ] 2.3 Image stays glibc (`-bookworm-`, not Alpine) for node-pty. → verify: `grep -n 'bookworm' docker/Dockerfile`

## 3. Verify
- [ ] 3.1 Default standalone install on Node 24: `./scripts/test-standalone-npm-install-docker.sh` → exit 0.
- [ ] 3.2 Floor still green on Node 22: `./scripts/test-standalone-npm-install-docker.sh node:22-bookworm-slim` → exit 0.
- [ ] 3.3 All-in-one image builds + boots on 24: `cd docker && docker compose up -d --build`, then `curl -s localhost:8000/api/health | jq .` returns healthy; spawn a terminal to confirm node-pty allocates a PTY.
- [ ] 3.4 `npm test` passes.

## 4. Docs
- [ ] 4.1 Update `docs/file-index-docker.md` row for `docker/Dockerfile` if it pins the Node version (delegate per Documentation Update Protocol, caveman style).
- [ ] 4.2 Grep `README.md` / `docs/` for "Node 22" prereq mentions tied to the Docker image; update to 24 where they describe the shipped image (not the supported floor).
