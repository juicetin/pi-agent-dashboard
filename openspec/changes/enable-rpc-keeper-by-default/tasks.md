## 1. Pre-flight verification

- [ ] 1.1 Re-confirm gate condition: `add-rpc-stdin-dispatch-with-keeper-sidecar` is archived AND v0.5.3+ has been tagged AND v0.5.4 (current cycle) shipped without keeper-path regressions (check CHANGELOG `### Fixed` under `[Unreleased]` and `[0.5.4]` for any `keeper.cjs` / `keeper-manager.ts` / `dispatch-router.ts` entries — at the time of drafting there are none).
- [ ] 1.2 Grep the repo for all `_setUseRpcKeeperOverrideForTests` call sites so step 3 can update them in one pass: `rg -n "_setUseRpcKeeperOverrideForTests" packages/`.
- [ ] 1.3 Grep for `useRpcKeeper` and `shouldUseRpcKeeper` across `packages/` and `docs/` so nothing is missed: `rg -n "useRpcKeeper|shouldUseRpcKeeper" packages/ docs/ CHANGELOG.md AGENTS.md`.

## 2. Remove the config flag

- [ ] 2.1 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: boolean` field from the schema type (currently L250).
- [ ] 2.2 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: false` line from `DEFAULT_CONFIG` (currently L310).
- [ ] 2.3 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: parsed.useRpcKeeper === true` loader branch (currently L597).
- [ ] 2.4 In `packages/shared/src/__tests__/`: grep for and update any config-loader test that asserts on `useRpcKeeper` defaulting to `false` or round-tripping the field. Tests should now assert the field is silently ignored when present in a user config.

## 3. Remove the runtime gate and legacy spawn branches

- [ ] 3.1 In `packages/server/src/process-manager.ts`: delete `_setUseRpcKeeperOverrideForTests`, the `useRpcKeeperOverride` module-level variable, and `shouldUseRpcKeeper()` (L83-93).
- [ ] 3.2 In `packages/server/src/process-manager.ts::spawnHeadless` (Unix branch, L409-419): delete the `sh -c "tail -f /dev/null | pi --mode rpc"` shell-wrapper code path. The keeper branch becomes the only branch.
- [ ] 3.3 In `packages/server/src/process-manager.ts::spawnHeadless` (Windows branch, L480-525): delete the direct-stdin-pipe legacy code path. The keeper branch becomes the only branch on Windows.
- [ ] 3.4 In `packages/server/src/process-manager.ts`: simplify any conditional that previously read `shouldUseRpcKeeper()` to its unconditional keeper branch. Remove any now-unreachable defensive code (`else { /* legacy path */ }`).
- [ ] 3.5 Run `rg -n "useRpcKeeper" packages/server/` and confirm zero matches remain.
- [ ] 3.6 Type-check passes: `npm run -ws --if-present typecheck` (or equivalent: `tsc --noEmit -p packages/server/tsconfig.json`).

## 4. Update tests

- [ ] 4.1 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: delete the entire "flag-off keeps the legacy path" scenario (the scenario that asserted on `tail -f /dev/null` being invoked when `useRpcKeeper: false`).
- [ ] 4.2 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: drop every `_setUseRpcKeeperOverrideForTests(true)` setup call and the corresponding `(null)` teardown. The keeper branch is now unconditional; tests no longer need to flip the override.
- [ ] 4.3 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: rename the file or refactor scenarios so the names reflect "headless spawn" (not "keeper-vs-legacy"). Defer the rename if it touches too many imports — a header comment update is sufficient.
- [ ] 4.4 For every test file flagged in §1.2: delete the `_setUseRpcKeeperOverrideForTests` import and call sites. If the test depended on the override to exercise a legacy-path branch, the test is now obsolete and SHALL be deleted; if it merely set the override to enable the keeper path (which is now default), the call is dropped.
- [ ] 4.5 Run the full test suite and confirm zero failures: `npm test 2>&1 | tee /tmp/pi-test.log` then `grep -nE 'FAIL|Error|✗|✘' /tmp/pi-test.log` (per AGENTS.md "Running Tests").

## 5. Update documentation

- [ ] 5.1 Append entry to `CHANGELOG.md` `[Unreleased] → Changed`: "RPC keeper sidecar is now the default and only spawn path for headless RPC sessions. Slash commands (`/ctx-stats`, `/curator`, `/agents`, `/flows:*`) now work in every dashboard-spawned headless session without configuration. The `useRpcKeeper` config field is removed and silently ignored if present. (change: `enable-rpc-keeper-by-default`)".
- [ ] 5.2 In `docs/faq.md`: locate the "Why does /ctx-stats work in some sessions but not others?" entry. Collapse it to two session types: headless+keeper (works) and tmux/wt (stopgap error). Delete all opt-in / `useRpcKeeper` references.
- [ ] 5.3 In `docs/architecture.md` "RPC keeper sidecar" subsection: drop the "experimental" framing. Delete paragraphs describing the legacy spawn paths. Remove the `useRpcKeeper` flag mention.
- [ ] 5.4 In `docs/slash-command.md`: in the three-way decision (Paths B → C → D), simplify the "headless + keeper" predicate to "headless". Append a Decision-1 historical note referencing this change name.
- [ ] 5.5 In `AGENTS.md` "Key Files" → `slash-dispatch.ts` row: drop the keeper-branch reference if any remains (rows for `keeper.cjs` / `keeper-manager.ts` / `dispatch-router.ts` stay; they describe the production path). Verify the row stays ≤ 200 chars.
- [ ] 5.6 Run `rg -n "useRpcKeeper" docs/ CHANGELOG.md AGENTS.md` and confirm zero matches outside the new CHANGELOG migration note.

## 6. Rebuild and verify end-to-end

- [ ] 6.1 Rebuild client (touched only if a UI surface mentions the flag — unlikely, but verify): `npm run build`.
- [ ] 6.2 Restart the server in dev mode: `curl -X POST http://localhost:8000/api/restart -H 'Content-Type: application/json' -d '{"dev":true}'` (or `pi-dashboard stop && pi-dashboard start --dev`).
- [ ] 6.3 Reload all connected pi sessions to pick up bridge code (no bridge changes are expected, but reload re-verifies): `npm run reload:check`.
- [ ] 6.4 Spawn a new headless session from the dashboard (any pinned directory → "Spawn"). Confirm `~/.pi/dashboard/sessions/<sessionId>.rpc.sock` appears on Unix or `\\.\pipe\pi-rpc-<sessionId>` on Windows.
- [ ] 6.5 In that session's chat input, type `/ctx-stats` and Enter. Confirm a `command_feedback {status: "completed"}` and the actual ctx-stats output appears — NOT the stopgap `requires pi 0.71+` error.
- [ ] 6.6 Restart the dashboard server (`/api/restart`). Confirm pi survives — the headless session reconnects within ~5s and the keeper socket is still on disk pre-and-post restart.
- [ ] 6.7 (Windows only, where feasible) Repeat 6.4–6.6 on Windows. The 6.6 check is the durability fix that this change brings to Windows; explicit Windows verification is essential.

## 7. Final validation

- [ ] 7.1 Run `./node_modules/.bin/openspec validate enable-rpc-keeper-by-default --strict` and confirm zero errors.
- [ ] 7.2 Diff review: every line removed traces to either §2 (config flag), §3 (legacy spawn branches + runtime gate), §4 (test wiring), or §5 (documentation). Any other deletion is out of scope for this change and should be reverted or split into a separate proposal.
- [ ] 7.3 Code-search final sweep: `rg -n "useRpcKeeper|shouldUseRpcKeeper|_setUseRpcKeeperOverrideForTests|tail -f /dev/null" packages/` returns zero matches. (The `tail -f /dev/null` search catches any orphaned legacy-path code.)
