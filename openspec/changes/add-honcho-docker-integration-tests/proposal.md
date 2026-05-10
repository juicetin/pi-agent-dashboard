## Why

Tasks 9.6 and 9.7 of `honcho-dashboard-plugin` were carved out of that change so the plugin could ship without blocking on Docker-required CI. They cover the only path the unit tests cannot reach: the `compose-lifecycle.ts` orchestration calling a real `docker` CLI against a real Docker daemon and observing the resulting plugin status transitions.

The risk this addresses is integration drift between the plugin's `docker compose` invocations and Docker itself — argv shape, exit code parsing, port-conflict detection, migration idempotency. A typo in one of those would not trip any unit test (every layer is mocked) but would brick self-host mode for every user. The integration tier is the only place this surface is exercised end-to-end.

This change is intentionally deferred until the self-host docker stack ships to users (currently only available behind `mode=self-host` in v0.5.x of the plugin, no GA roadmap published). When self-host transitions from "experimental opt-in" to "supported configuration", these tests gate the release.

## What Changes

### New scripted integration suite

Add `qa/tests/honcho-docker/` containing one shell script per scenario:

- `01-happy-path.sh` — Fresh tmp HOME → `POST /api/plugins/honcho/config { mode: "self-host", selfHost: { autoStart: true, ... } }` → poll `/api/plugins/honcho/status` for `state="running"` (60 s budget). Then write the same config again (no-op) and assert second boot is idempotent: `migrationsApplied: true` persists, no migration log lines emitted on the second pass.
- `02-port-conflict.sh` — Pre-occupy port 8765 (`nc -l 8765 &`) → trigger autoStart → poll status; assert `state="port-conflict"` and `lastError` contains the literal "8765".

Both scripts:
- Skip cleanly with exit 0 + a "SKIP: no docker" message when `docker version` fails (so non-Docker CI runners don't false-fail).
- Use `mktemp -d` HOME and clean up via trap (kill `nc`, `docker compose -f <tmp>/.honcho/docker-compose.yml down`, `rm -rf` HOME).
- Pull the pgvector image up-front via `docker pull` so wall-clock budget covers only orchestration, not image fetch.

### Make targets

- Add `make -C qa test-honcho-docker` orchestrator that runs both scripts in sequence.
- Add `make -C qa test-honcho-docker-<scenario>` per-script targets for narrow re-runs.

### CI gate

- New GitHub Actions job `honcho-docker-integration` in `.github/workflows/publish.yml`, gated to run only on tag pushes (release-only — not every PR pays the Docker pull cost).
- One OS matrix entry (ubuntu-latest, where Docker is preinstalled).
- Job pulls `pgvector/pgvector:pg16` once, then runs both scripts.

### Documentation

- Add `qa/tests/honcho-docker/README.md` listing each script's contract, expected runtime (~60 s for happy-path, ~10 s for port-conflict), failure modes it catches, and how to skip locally (`SKIP_DOCKER=1`).
- Cross-link from `packages/honcho-plugin/README.md` self-host troubleshooting section.

## Capabilities

### Modified Capabilities

- `honcho-server-lifecycle`: existing requirements unchanged. Adds an SHALL — every transition in the lifecycle state machine MUST be covered by either a unit test (lifecycle module mocked) or an integration test (Docker required) in `qa/tests/honcho-docker/`. The two scripts in this proposal close the integration half.

## Impact

- **Files (new)**:
  - `qa/tests/honcho-docker/01-happy-path.sh`
  - `qa/tests/honcho-docker/02-port-conflict.sh`
  - `qa/tests/honcho-docker/README.md`
- **Files (modified)**:
  - `qa/Makefile` — orchestrator + per-script targets.
  - `.github/workflows/publish.yml` — new `honcho-docker-integration` job, release-only, ubuntu-only.
  - `packages/honcho-plugin/README.md` — pointer to the integration scripts in troubleshooting.
- **No source changes**. This proposal only adds tests + CI wiring.

### Out of scope

- **Multi-arch Docker testing.** The pgvector image is amd64 + arm64; we test on ubuntu-latest amd64 only. Platform-specific bugs (rootless Docker, podman, Docker Desktop on macOS/Windows) are tracked separately.
- **`loop-image` storage backend.** Stub returns `not-implemented`; no integration coverage until that backend lands.
- **Migration rollback.** Alembic downgrade isn't part of the plugin's lifecycle today; integration coverage waits for that to ship.
- **Mocked-Docker tier.** A mocked `docker` CLI test (golang-style) was considered and rejected: the unit tests already mock at the `compose-lifecycle.ts` boundary, which is finer-grained than mocking `docker` argv. Adding a third tier between unit and real-Docker yields no net coverage.
