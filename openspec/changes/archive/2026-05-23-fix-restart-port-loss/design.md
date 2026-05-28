## Context

`POST /api/restart` flow:

```
1. system-routes.ts:386   spawnRestart({ port: config.port, extraArgs })
2. restart-helper.ts:50   spawnArgs = [cliPath, "start", ...extraArgs]   ← no --port
3. detached orchestrator spawns: node <spawnArgs>
4. child cli.ts:parseArgs() — flags.port is undefined
5. child cli.ts:buildConfig() — port = flags.port ?? env ?? fileConfig.port
                                                            ─────────────
                                                            falls back to default
```

`config.port` is the actually-bound port (resolved at startup with CLI > env > file precedence). The orchestrator already uses it in two places:

- `PORT = ${params.port}` for `portFree(PORT)` polling (line 70)
- `healthOk()` HTTP polling against `PORT` (line 97)

But it is **not** in `spawnArgs`. The child re-resolves from scratch and loses the override.

## Goals / Non-Goals

**Goals:**
- `/api/restart` preserves the actually-bound port across the restart cycle.
- The orchestrator argv stays internally consistent (the port it polls health on is the port the child is told to bind to).
- Spec captures the invariant.

**Non-Goals:**
- Restoring `--pi-port`, `--no-tunnel`, `--tunnel`, or any other CLI flag to the spawned child. They are not user-reported pain. Most round-trip via file config already.
- Changing how the OS-level CLI (`pi-dashboard restart`) builds its spawn args (it delegates to `/api/restart` when the server is up, per existing spec).
- Fixing `cli.ts:cmdStart` symmetry — bare `start` reads config.port correctly because it does not respawn from itself.

## Decisions

### Decision 1: Inject `--port` in `restart-helper.ts`, not in `system-routes.ts`

The fix could live in either:
- **A)** `system-routes.ts` — extend `extraArgs.push("--port", String(config.port))` before calling `spawnRestart`.
- **B)** `restart-helper.ts` — inject into `spawnArgs` directly using `params.port`.

**Chosen: B.** Reasons:

1. `restart-helper.ts` already owns `params.port` as the source of truth for the new child's bind port (used by `portFree` + `healthOk` polling). Putting the argv injection alongside makes the orchestrator self-consistent.
2. Any future caller of `spawnRestart` (today only `system-routes.ts`; potentially others) gets the fix automatically.
3. `extraArgs` semantics stay "caller-specific extras"; the port is structural, not optional.

### Decision 2: Place `--port` BEFORE `extraArgs`

```ts
args: ["start", "--port", String(params.port), ...params.extraArgs]
```

Reason: if a caller ever includes their own `--port` in `extraArgs` (e.g. a deliberate override at call time), CLI argv processing in `parseArgs` is left-to-right, so a later occurrence wins. Putting the structural port FIRST lets callers override on top; the inverse order would silently swallow user-provided overrides.

### Decision 3: Both branches of the `spawnArgs` ternary get the injection

`buildOrchestratorScript` has two argv-construction branches: the `--import` loader branch (`buildNodeImportArgvParts`) and the bare-entry branch. Both need the same `--port` injection. Tests must cover both branches.

### Decision 4: No defensive guard on `params.port`

`RestartParams.port` is typed `number` (line 25 of restart-helper.ts). `system-routes.ts:386` always passes `config.port` which is also typed `number`. A runtime guard against `NaN` / negative is out of scope — would only hide upstream bugs in `buildConfig`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Future caller passes `--port` in `extraArgs` thinking it will win | Decision 2 — argv order means caller's `--port` overrides the structural one. Document in the new spec scenario. |
| Child cli's `parseArgs` rejects `--port <n>` syntax (it doesn't — verified at cli.ts:117-118, `if (arg === "--port" && next)`) | No mitigation needed; verified. |
| Test fixture for `buildOrchestratorScript` requires a port (already required by the type) | Existing tests should not break; new tests are additive. |

## Migration Plan

Pure additive bridge change to argv construction. No persistence, no protocol, no client. Rolls out with the next server restart. No rollback complexity.

## Open Questions

- Should `--pi-port` get the same treatment for symmetry? Probably yes long-term but no reported pain; leaving out of scope for now.
