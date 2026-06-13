## 0. Prerequisite amendment to docker-packaging

- [ ] 0.1 In `docker-packaging`'s Dockerfile `base`/`app` stage, install `jj` (jujutsu, pinned via `ARG`), `gh` (GitHub CLI, pinned), and `openspec` (global). Add matching rows to that change's tasks. (Packaging gap — fixed there, blocks this change.)

## 1. Test compose overlay

- [ ] 1.1 Create `docker/compose.test.yml` overlaying `compose.yml`: set `PI_DASHBOARD_NO_MDNS=1`, `DASHBOARD_PORT=18000`, `PI_GATEWAY_PORT=18999`, `PI_GATEWAY_BIND=127.0.0.1`, `TUNNEL_ENABLED=false`
- [ ] 1.2 Override `pi-state` volume to `tmpfs` (ephemeral); keep default bridge network (no multicast leak)
- [ ] 1.3 Add `cap_add: [SYS_ADMIN]` and the path-parity bind + tmpfs mounts (`${HOST_CWD}` lower, upper, work) needed by the overlay entrypoint
- [ ] 1.4 Ensure code-server is present-but-not-auto-launched and `PI_AUTH_*` unset by default in this overlay

## 2. Path-parity overlay entrypoint

- [ ] 2.1 Create `docker/test-entrypoint.sh`: if `HOST_CWD` set, `mkdir -p ${HOST_CWD}` then `mount -t overlay overlay -o lowerdir=/mnt/test-lower,upperdir=/mnt/test-upper,workdir=/mnt/test-work ${HOST_CWD}`
- [ ] 2.2 Add `TEST_COPY_MODE=1` fallback branch: `cp -a /mnt/test-lower/. ${HOST_CWD}` onto a tmpfs (no overlay, no cap)
- [ ] 2.3 Run fail-fast smoke: `curl -f http://localhost:${DASHBOARD_PORT}/api/health` + one WS connect; exit non-zero on failure before delegating to the base entrypoint
- [ ] 2.4 Exec the docker-packaging base entrypoint for the rest of startup (auth seed, tmux, `pi-dashboard`)
- [ ] 2.5 Wire `test-entrypoint.sh` as the overlay's entrypoint (COPY + chmod in image or `entrypoint:` in compose.test.yml)

## 3. Spin / teardown scripts

- [ ] 3.1 Create `docker/test-up.sh`: `export HOST_CWD="$PWD"`, run `docker compose -f compose.yml -f compose.test.yml up`, print `http://localhost:18000` and path-parity note
- [ ] 3.2 Create `docker/test-down.sh`: `docker compose -f compose.yml -f compose.test.yml down -v` (drops tmpfs upper + ephemeral state)
- [ ] 3.3 `chmod +x` both; add `.env` / `compose.override.yml` exclusions already covered by docker-packaging's `.gitignore`

## 4. Fixtures

- [ ] 4.1 Create `docker/fixtures/sample-git/`: a small initialized git repo (one commit, a couple files) baked into the image
- [ ] 4.2 Create `docker/fixtures/sample-jj/`: a small initialized jj repo baked into the image
- [ ] 4.3 Add `COPY docker/fixtures /fixtures` (or test-overlay mount) so both appear as pinnable workspaces

## 5. Documentation

- [ ] 5.1 Create `docker/TESTING.md`: quick start, isolation-guarantee table, path-parity explanation, overlay-vs-copy tradeoff, fixtures-vs-mount usage, UI-only-vs-e2e key seeding, `agent-browser → http://localhost:18000` manual-QA entry
- [ ] 5.2 Add a one-line pointer to `docker/TESTING.md` from the project `README.md` Docker section (created by docker-packaging)
- [ ] 5.3 Add a row for each new file to the matching `docs/file-index-<area>.md` split (path-alphabetical, caveman style) per the Documentation Update Protocol

## 6. Verification

- [ ] 6.1 With the host dashboard running, `test-up.sh` brings up a second dashboard with no home-lock fight, no port clash, no new mDNS peer on the host
- [ ] 6.2 `http://localhost:18000` serves the dashboard; `cd <some-project> && test-up.sh` shows that project at its identical host path in the UI
- [ ] 6.3 Agent writes inside the mounted project do NOT appear on the host after teardown (overlay isolation proven)
- [ ] 6.4 `test-down.sh` leaves `~/.pi` and the host project byte-identical to before the run
- [ ] 6.5 Broken/missing build → smoke check exits non-zero before the URL is printed
