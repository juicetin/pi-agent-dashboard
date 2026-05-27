## 1. Pre-flight verification

- [ ] 1.1 Re-confirm gate condition: `add-rpc-stdin-dispatch-with-keeper-sidecar` is archived AND v0.5.3+ has been tagged AND v0.5.4 (current cycle) shipped without keeper-path regressions other than `fix-rpc-keeper-pi-resolution` (archived 2026-05-27), which has already landed in-place and is not a blocker. Check CHANGELOG `### Fixed` under `[Unreleased]` for any **further** `keeper.cjs` / `keeper-manager.ts` / `dispatch-router.ts` entries beyond that fix — if any new keeper-path bug is open, defer this change one more cycle.
- [ ] 1.2 Grep the repo for all `_setUseRpcKeeperOverrideForTests` call sites so step 3 / step 4 can update them in one pass: `rg -n "_setUseRpcKeeperOverrideForTests" packages/`. Expected set (verified 2026-05-27): only `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts` (6 setup + 1 teardown + import).
- [ ] 1.3 Grep for `useRpcKeeper` and `shouldUseRpcKeeper` across the whole repo so nothing is missed: `rg -n "useRpcKeeper|shouldUseRpcKeeper" packages/ docs/ CHANGELOG.md AGENTS.md openspec/specs/`. Expected hit set (verified 2026-05-27): `packages/shared/src/config.ts` (3 hits), `packages/server/src/process-manager.ts` (~6 hits), `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts` (~9 hits), `packages/extension/src/slash-dispatch.ts` (3 hits inside `RPC_KEEPER_HINT`), `packages/extension/src/__tests__/bridge-slash-command-routing.test.ts` (3 hits, lines 108/196/311), plus spec files under `openspec/specs/headless-spawn/`, `openspec/specs/process-manager/`. Any hit outside this list means new code has appeared since drafting; investigate before continuing.

## 2. Remove the config flag

- [ ] 2.1 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: boolean` field from the schema type (currently L250).
- [ ] 2.2 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: false` line from `DEFAULT_CONFIG` (currently L310).
- [ ] 2.3 In `packages/shared/src/config.ts`: delete the `useRpcKeeper: parsed.useRpcKeeper === true` loader branch (currently L597).
- [ ] 2.4 In `packages/shared/src/__tests__/`: grep for and update any config-loader test that asserts on `useRpcKeeper` defaulting to `false` or round-tripping the field. Tests should now assert the field is silently ignored when present in a user config.

## 3. Remove the runtime gate and legacy spawn branches

- [ ] 3.1 In `packages/server/src/process-manager.ts`: delete `_setUseRpcKeeperOverrideForTests`, the `useRpcKeeperOverride` module-level variable, and `shouldUseRpcKeeper()` (L83-93).
- [ ] 3.2 In `packages/server/src/process-manager.ts::spawnHeadless` (current L478-481): delete the Unix `sh -c "tail -f /dev/null | ${piLine}"` shell-wrapper code path. The keeper branch becomes the only branch on Unix.
- [ ] 3.3 In `packages/server/src/process-manager.ts::spawnHeadless` (current L470): delete the Windows `spawnHeadlessDetached(cwd, bin, prefixArgs, args, env)` call. The keeper branch becomes the only branch on Windows.
- [ ] 3.4 In `packages/server/src/process-manager.ts`: delete the `spawnHeadlessDetached` function itself (L589…) IF no other callers remain. Verify with `rg -n "spawnHeadlessDetached" packages/`. If something else still calls it (e.g. a fallback path elsewhere), leave the function but mark the dead branch.
- [ ] 3.5 In `packages/server/src/process-manager.ts`: collapse `spawnHeadless` so it (a) calls `resolvePiCommand()` once at the top, (b) returns `PI_NOT_FOUND` on null, (c) dispatches unconditionally to `spawnHeadlessViaKeeper(cwd, env, args, piCmd)`. Remove the `if (shouldUseRpcKeeper())` conditional entirely. The pre-existing `resolvePiCommand()` call inside the keeper branch (added by `fix-rpc-keeper-pi-resolution`) deduplicates with the legacy branch's call — keep one, drop the other.
- [ ] 3.6 Run `rg -n "useRpcKeeper|shouldUseRpcKeeper" packages/server/src/` and confirm zero matches remain.
- [ ] 3.7 Type-check passes for the server: `tsc --noEmit -p packages/server/tsconfig.json` (or `npm run -ws --if-present typecheck`).

## 4. Update bridge-side hint message + tests

- [ ] 4.1 In `packages/extension/src/slash-dispatch.ts:124-135`: rewrite the `RPC_KEEPER_HINT` constant. New text drops the `"useRpcKeeper": true` instruction. Suggested wording: `"Extension slash commands cannot be dispatched from this session shape (typically tmux or Windows Terminal sessions, where the user's terminal owns pi's stdin). Dashboard-spawned headless sessions support slash commands natively."` Also remove the `useRpcKeeper` reference from the surrounding comment block (the example `{ "spawnStrategy": "headless", "useRpcKeeper": true }` on L130 is now incorrect).
- [ ] 4.2 In `packages/extension/src/__tests__/bridge-slash-command-routing.test.ts:108, 196, 311`: update the three `expect(…).toContain("useRpcKeeper")` assertions to match a stable substring of the new message (e.g. `.toContain("tmux")` or `.toContain("session shape")`). Pick whichever token is most stable across future message tweaks.
- [ ] 4.3 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: delete the "flag-off keeps the legacy path" scenario (the test using `_setUseRpcKeeperOverrideForTests(false)` at L241, asserting on `tail -f /dev/null` being invoked).
- [ ] 4.4 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: drop the 6 `_setUseRpcKeeperOverrideForTests(true)` setup calls (L112/158/187/210/226 + any inside individual `it()` bodies), the global `afterEach` `_setUseRpcKeeperOverrideForTests(null)` (L95), and the import on L24. The keeper branch is now unconditional.
- [ ] 4.5 In `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`: rename the suite description from `"spawnHeadless (useRpcKeeper: true)"` (L100) to `"spawnHeadless (headless via keeper)"`. File name SHALL stay (renaming risks merge conflicts and breaks `git log --follow`).
- [ ] 4.6 Run the full test suite and confirm zero failures: `npm test 2>&1 | tee /tmp/pi-test.log` then `grep -nE 'FAIL|Error|✗|✘' /tmp/pi-test.log` (per AGENTS.md "Running Tests").

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
- [ ] 7.3 Code-search final sweep: `rg -n "useRpcKeeper|shouldUseRpcKeeper|_setUseRpcKeeperOverrideForTests|tail -f /dev/null|spawnHeadlessDetached" packages/` returns zero matches across both `src/` and `__tests__/` trees. (The `tail -f /dev/null` and `spawnHeadlessDetached` searches catch any orphaned legacy-path code.)
