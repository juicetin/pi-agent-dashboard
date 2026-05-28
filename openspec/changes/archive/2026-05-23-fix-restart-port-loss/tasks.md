## 1. Server: inject `--port` into orchestrator spawn args

- [x] 1.1 In `packages/server/src/restart-helper.ts:buildOrchestratorScript`, modify both branches of the `spawnArgs` ternary to insert `"--port"`, `String(params.port)` after `"start"` and before `...params.extraArgs`:
  - Loader branch (line ~50): `args: ["start", "--port", String(params.port), ...params.extraArgs]`
  - Bare-entry branch (line ~55): `["start", "--port", String(params.port), ...params.extraArgs]` (after the `shouldUrlWrapEntry`-wrapped cliPath)
- [x] 1.2 Add an inline comment block referencing the new spec requirement (`server-restart` — "Restart orchestrator preserves the bound port") and Decision 2 (caller-override semantics).

## 2. Tests

- [x] 2.1 Extend `packages/server/src/__tests__/restart-helper.test.ts`:
  - Loader branch: `buildOrchestratorScript({ ..., port: 8001, extraArgs: ["--dev"] })` returned string SHALL contain the `"start","--port","8001","--dev"` sequence (or equivalent JSON-stringified form embedded in the script literal).
  - Bare-entry branch (loader = ""): same assertion.
  - Caller-supplied `--port` in `extraArgs`: assert both `--port` occurrences appear in left-to-right order.
- [x] 2.2 Add a parser-level assertion: parse the embedded `ARGS` JSON literal from the returned script and verify the array shape directly (avoids brittle string matching).

## 3. Documentation

- [x] 3.1 Update `docs/file-index-server.md` row for `src/server/restart-helper.ts` — append `See change: fix-restart-port-loss.` to the existing change-history annotations. Delegate the docs write to a subagent per AGENTS.md "Documentation Update Protocol" (caveman style).

## 4. Verification

- [x] 4.1 `npm test`. Result: 6084 pass / 2 fail. Both pre-exist on develop (AgentToolRenderer popout + MinimalChatView container class). New 4 tests in `restart-helper.test.ts` pass.
- [x] 4.2 Manual smoke: `pi-dashboard start --port 8001`, then `curl -X POST :8001/api/restart`. Confirm `curl :8001/api/health` responds within ~5s and `curl :8000/api/health` does NOT.
- [x] 4.3 `openspec validate fix-restart-port-loss --strict` → ✓ valid.

## 5. Archive (post-merge)

- [x] 5.1 Run `openspec archive fix-restart-port-loss` to fold the spec delta into `openspec/specs/server-restart/spec.md`.
