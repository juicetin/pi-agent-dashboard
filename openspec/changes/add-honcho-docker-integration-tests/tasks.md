# Tasks

## 1. Scripts

- [ ] 1.1 Create `qa/tests/honcho-docker/` directory.
- [ ] 1.2 Author `01-happy-path.sh`:
  - [ ] 1.2.1 Skip-clean when `docker version` fails (exit 0, "SKIP: no docker" message).
  - [ ] 1.2.2 `mktemp -d` HOME; `trap` cleanup that kills any spawned dashboard, runs `docker compose -f <tmp>/.honcho/docker-compose.yml down -v`, and `rm -rf` the HOME.
  - [ ] 1.2.3 `docker pull pgvector/pgvector:pg16` up-front.
  - [ ] 1.2.4 Spawn `pi-dashboard start --port=<rand>` against the tmp HOME; wait for `/api/health` 200.
  - [ ] 1.2.5 `POST /api/plugins/honcho/config` with `{ mode: "self-host", selfHost: { autoStart: true, apiPort: 8765, dbPort: 5455, storageBackend: "host-directory", llm: { source: "anthropic", apiKey: "stub-key" } } }`.
  - [ ] 1.2.6 Poll `GET /api/plugins/honcho/status` for `state="running"` with 60 s budget.
  - [ ] 1.2.7 Re-issue the same config write (no-op) and assert: status stays `running`; `migrationsApplied: true` persists; second-pass server.log shows no `alembic upgrade head` lines.
  - [ ] 1.2.8 Assert `~/.honcho/docker-compose.yml` byte-identical to first pass (no regeneration).
- [ ] 1.3 Author `02-port-conflict.sh`:
  - [ ] 1.3.1 Same skip + cleanup pattern as 1.2.1–1.2.2.
  - [ ] 1.3.2 Pre-occupy port 8765 with `nc -l 8765 &`; record PID for cleanup.
  - [ ] 1.3.3 Spawn dashboard, write self-host config with `selfHost.apiPort=8765`.
  - [ ] 1.3.4 Poll `GET /api/plugins/honcho/status` for `state="port-conflict"` with 30 s budget.
  - [ ] 1.3.5 Assert `lastError` contains the literal string `"8765"`.
- [ ] 1.4 Author `qa/tests/honcho-docker/README.md`: per-script contract (inputs, asserts, expected runtime, failure modes), local-run recipe, `SKIP_DOCKER=1` env-var override.

## 2. Make wiring

- [ ] 2.1 Add `test-honcho-docker` target to `qa/Makefile` running 01 then 02 in sequence.
- [ ] 2.2 Add `test-honcho-docker-happy-path` and `test-honcho-docker-port-conflict` targets for narrow re-runs.
- [ ] 2.3 Update `qa/Makefile` help text / `qa/README.md` to list the new target.

## 3. CI

- [ ] 3.1 Add `honcho-docker-integration` job to `.github/workflows/publish.yml`:
  - [ ] 3.1.1 Trigger only on tag push (`refs/tags/v*`).
  - [ ] 3.1.2 `runs-on: ubuntu-latest`.
  - [ ] 3.1.3 Cache + pre-pull the pgvector image to keep wall-clock under 90 s.
  - [ ] 3.1.4 Run `make -C qa test-honcho-docker`.
  - [ ] 3.1.5 Upload `~/.pi/dashboard/server.log` + `docker compose logs` as job artifacts on failure.

## 4. Documentation

- [ ] 4.1 Add a "Self-host troubleshooting → Run integration scripts locally" subsection to `packages/honcho-plugin/README.md` linking to `qa/tests/honcho-docker/README.md`.
- [ ] 4.2 Add a row to `docs/file-index-server.md` (or appropriate split) for `qa/tests/honcho-docker/` (caveman style, one line).

## 5. Verification

- [ ] 5.1 Run `make -C qa test-honcho-docker` locally on a Docker-equipped host; both scripts exit 0.
- [ ] 5.2 Run on a Docker-less host (or with `SKIP_DOCKER=1`); both scripts exit 0 with "SKIP: no docker" message.
- [ ] 5.3 Tag a release candidate and confirm the new CI job runs and passes.
