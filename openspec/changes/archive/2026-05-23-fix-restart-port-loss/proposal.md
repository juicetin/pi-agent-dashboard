## Why

`POST /api/restart` against a dashboard server bound to a non-default port (e.g. `8001`) re-spawns the replacement child on `8000` instead. The orchestrator's `spawnArgs` only round-trips `--dev` (and any explicit `extraArgs` from `system-routes.ts`) — the actual bound port is never serialized to argv. The new child reads `~/.pi/dashboard/config.json` and falls back to the file default (`8000`), losing the override that the parent process started with (`--port 8001` CLI flag or `PI_DASHBOARD_PORT` env override).

Symptom: user runs `pi-dashboard start --port 8001`, later `curl POST :8001/api/restart` → server reappears on `8000`. WS clients reconnect to a phantom server (or fail entirely if `8000` is taken).

The bug is mechanical: `restart-helper.ts` already knows the correct port (`params.port` is used to poll `/api/health` after spawn), but does not pass it to the spawned child.

## What Changes

- **`packages/server/src/restart-helper.ts`** — `buildOrchestratorScript` prepends `--port <params.port>` to the spawn args (both the `--import` loader branch and the bare-entry branch). One change, two sites, ~2 lines each.

- **Tests** — `packages/server/src/__tests__/restart-helper.test.ts` already exists; add a case asserting `buildOrchestratorScript({port: 8001, ...}).includes("--port", "8001")` and that the port appears BEFORE any `--dev` from `extraArgs` (so users can still override port at call time via extraArgs without collision).

- **Out of scope**:
  - `cli.ts:cmdStart` symmetry (bare `pi-dashboard start --port 8001` does roundtrip via `config.port`; the bug is restart-specific). Filed as a separate observation if needed.
  - Changing the meaning of `extraArgs` — it remains the caller-controlled list, just pre-pended-to with port.
  - Restoring `--pi-port`, `--no-tunnel`, or other flags to the child. Only `--port` matters for the user-visible breakage; other overrides round-trip via file config or persist across restart by design.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `server-restart` — adds one new requirement "Restart orchestrator preserves the bound port" with scenarios pinning the argv shape and the BEFORE-`--dev` ordering.

## Impact

- **Server**: ~4 lines in `restart-helper.ts` (one extra entry in each of two `spawnArgs` arrays).
- **Spec**: one new requirement + 3 scenarios under `openspec/specs/server-restart/spec.md`.
- **Tests**: ~2 cases added to `restart-helper.test.ts`. The existing buildOrchestratorScript tests cover the surrounding shape — additions are purely positive assertions on the new argv elements.
- **Risk**: extremely low. `--port` is a CLI-supported flag (parsed by `parseArgs` in `cli.ts:117`), so the change cannot break a valid start command. The orchestrator's `params.port` is the single source of truth and is already used for health polling, so reusing it for spawn argv keeps it self-consistent.
