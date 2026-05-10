## ADDED Requirements

### Requirement: Lifecycle integration test coverage

Every transition in the self-host docker-compose lifecycle state machine SHALL be covered by either a unit test (where the lifecycle module's external dependencies are mocked) or an integration test under `qa/tests/honcho-docker/` (where a real `docker` CLI talks to a real Docker daemon). The integration tier SHALL skip cleanly with exit 0 when `docker version` fails, so contributors and CI runners without Docker installed do not see false failures.

#### Scenario: Happy-path lifecycle reaches running and is idempotent on second boot

- **WHEN** the integration script `qa/tests/honcho-docker/01-happy-path.sh` runs against a Docker-equipped host with a fresh tmp HOME
- **THEN** the plugin status transitions through `starting` to `running` within a 60 s budget
- **AND** `~/.honcho/config.json` records `selfHost.migrationsApplied: true`
- **WHEN** the same config is written a second time without any change
- **THEN** the plugin status remains `running`
- **AND** the second pass emits no `alembic upgrade head` log lines (migrations are skipped)
- **AND** `~/.honcho/docker-compose.yml` is byte-identical to the first pass (no template regeneration)

#### Scenario: Port-conflict surfaces as state=port-conflict with the conflicting port number

- **WHEN** the integration script `qa/tests/honcho-docker/02-port-conflict.sh` runs with port 8765 pre-occupied by another process
- **AND** the plugin's autoStart triggers `composeUp()`
- **THEN** the plugin status transitions to `port-conflict` within a 30 s budget
- **AND** the status payload's `lastError` field contains the literal string `"8765"`
- **AND** the dashboard does not crash

#### Scenario: Integration scripts skip cleanly when Docker is absent

- **WHEN** any script under `qa/tests/honcho-docker/` runs on a host where `docker version` returns non-zero
- **THEN** the script exits 0 with a `SKIP: no docker` message on stdout
- **AND** does not attempt any further Docker invocations

#### Scenario: CI gates only on tag pushes

- **WHEN** a commit is pushed to a non-tag ref (PR, main branch update, release branch)
- **THEN** the `honcho-docker-integration` GitHub Actions job does not run
- **WHEN** a commit is pushed as a tag matching `refs/tags/v*`
- **THEN** the `honcho-docker-integration` job runs on `ubuntu-latest` and executes `make -C qa test-honcho-docker`
