## Context

The honcho plugin's self-host docker-compose lifecycle (`packages/honcho-plugin/src/server/compose-lifecycle.ts`) orchestrates a real `docker` CLI. Unit tests cover every layer of the orchestration with mocked `child_process.exec` calls — `compose-template.test.ts` proves the YAML render is correct, `boot-integration.test.ts` proves the state machine transitions correctly when each step is stubbed, and the route-level tests prove the REST surface enforces 412 / 409 contracts. None of those tests exercise the seam between the plugin and Docker itself: argv shape, exit code parsing, port-conflict detection, idempotency of `alembic upgrade head` on second invocation.

The carve-out happened during `honcho-dashboard-plugin` to unblock that change's archival. This proposal captures the deferred coverage as a single ongoing capability.

## Why now (or not)

This change is **explicitly deferred**. It should be picked up when:

1. The honcho plugin's self-host mode transitions from "experimental opt-in" to "supported configuration" (today only `mode=cloud` is exercised by users in v0.5.x).
2. A user-reported regression in self-host mode demonstrates that the unit tests' mock boundary is too coarse.
3. A subsequent change (e.g. adding `loop-image` storage backend, migration rollback, multi-host LLM routing) materially expands the lifecycle surface.

Until then, the existing unit + e2e coverage in `packages/honcho-plugin/src/__tests__/` is judged sufficient. The proposal exists so the gap is tracked, not lost.

## Decisions

### Decision 1 — Bash scripts, not vitest

Same precedent as `qa/tests/*.sh` (VM-level smoke) and the proposed `qa/smoke/server-launch/` suite. Real-Docker tests don't fit the in-process Fastify e2e tier we built for `honcho-dashboard-plugin` (no jsdom needed, no React); they fit the existing per-OS shell-script tier. Keeps fixtures consistent with the rest of `qa/`.

### Decision 2 — Skip-clean instead of fail when Docker is absent

`docker version` failure → exit 0 with `SKIP: no docker` message. Two reasons:

1. Local dev: contributors without Docker can run the full QA suite without false-fails.
2. CI matrix: the smoke / windows / macos jobs in `publish.yml` don't have Docker. They should not flag the integration scripts as missing — they should report them as skipped.

The actual gating happens in `publish.yml` via job-level `runs-on: ubuntu-latest` + `if: startsWith(github.ref, 'refs/tags/')` — only that job invokes `make test-honcho-docker`.

### Decision 3 — Pull image up-front, not inline

`docker pull pgvector/pgvector:pg16` runs as the first step in each script (and in the CI job's pre-test phase, with caching). This separates "pulling 200 MB" from "60-second budget for orchestration", so a slow pull can't false-fail a happy-path test.

### Decision 4 — Real port for port-conflict, not iptables magic

`02-port-conflict.sh` uses `nc -l 8765 &` to occupy the port. Alternatives (iptables REJECT rules, dummy socket on a different protocol) were rejected as overkill — `nc -l` is portable, doesn't need root, and produces the exact error shape Docker surfaces in production.

### Decision 5 — One tier of integration, not two

A "mocked Docker" tier was considered (a fake `docker` shim on `PATH` that emulates the daemon's argv contract). Rejected because:

- Unit tests already mock at the `compose-lifecycle.ts` boundary (one level above argv).
- A docker-argv-mock tier would catch only argv-shape regressions, which the real-Docker tests catch with strictly higher fidelity.
- Maintenance burden: every docker version bump risks the mock drifting.

### Decision 6 — `host-directory` backend only, for now

The integration scripts use `storageBackend: "host-directory"` exclusively. `docker-volume` is functionally equivalent for these asserts (status reaches `running`, migrations apply); `loop-image` is stubbed (`not-implemented`). When `loop-image` lands, this change picks up a third script (`03-loop-image-backend.sh`).

## Open questions

- **Cleanup robustness on CI cancellation.** GitHub Actions sends SIGTERM to the workflow process tree; trap-based cleanup should run, but if it doesn't the runner is destroyed anyway. Manual cleanup paths are documented in the README for local runs.
- **Migration log scrape vs query.** Task 1.2.7 asserts no `alembic upgrade head` lines on second pass. An alternative is to query `alembic_version` table for an unchanged revision id. Log-scrape is simpler but more brittle; revisit if it flakes.
- **CI artifact retention.** Currently every failed job uploads `server.log` + `docker compose logs`. For repeated CI failures this can blow the artifact quota. If it becomes an issue, retain only the most recent failure per branch.
