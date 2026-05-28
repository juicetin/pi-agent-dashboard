## 1. Phase 1 — Node engines floor

- [x] 1.1 In root `package.json::engines.node`, change `">=22.12.0 <25"` → `">=22.19.0 <25"`.
- [x] 1.2 In `packages/server/package.json::engines.node`, change `">=22.18.0"` → `">=22.19.0"`.
- [x] 1.3 In `packages/server/src/node-guard.ts::isAffectedNode`, widen the 22.x cutoff: change `major === 22 && minor < 18` → `major === 22 && minor < 19`.
- [x] 1.4 In `packages/server/src/node-guard.ts::buildNodeUpgradeMessage`, update the `Fix:` line from `upgrade Node to >=22.18.0` → `upgrade Node to >=22.19.0`.
- [x] 1.5 Tests in `packages/server/src/__tests__/node-guard.test.ts`:
  - [x] 1.5.1 Add a case asserting `isAffectedNode("v22.18.0") === true` (previously accepted, now refused).
  - [x] 1.5.2 Add a case asserting `isAffectedNode("v22.19.0") === false` (the new floor — accepted).
  - [x] 1.5.3 Verify existing 24.1/24.2 affected + 24.3 accepted cases still pass unchanged.
  - [x] 1.5.4 Verify the upgrade message string contains the new `22.19.0` floor.
- [x] 1.6 **Coordination with `skip-affected-bundled-node`** (conditional): verified `pick-node.ts` does NOT yet export `isBundledNodeAffected` (skip-affected-bundled-node has not shipped); no-op. That change will inherit the widened `< 19` range when it lands.

## 2. Phase 1 — Bundled-node ≥ pi minimum invariant

- [x] 2.1 NEW test file `packages/shared/src/__tests__/bundled-node-meets-pi-floor.test.ts`. Pattern after `no-bash-on-windows.test.ts`.
  - [x] 2.1.1 Read `packages/electron/scripts/_node-version.sh` and parse `BUNDLED_NODE_VERSION="v24.15.0"`.
  - [x] 2.1.2 Read `packages/server/package.json` and extract `piCompatibility.minimum` (e.g. `"0.75.0"`).
  - [x] 2.1.3 Hard-code a small lookup `piMinimum → requiredNodeMajor.requiredNodeMinor` table: `0.75.0 → 22.19`, `0.74.0 → 22.18`, etc. The table SHALL be a literal map in the test file; refactoring it into a separate doc is a future change.
  - [x] 2.1.4 Assert `bundledNodeMajor > requiredNodeMajor` OR (`bundledNodeMajor === requiredNodeMajor` AND `bundledNodeMinor >= requiredNodeMinor`).
  - [x] 2.1.5 On failure, the test SHALL print both values + a one-line remediation: "Bump `BUNDLED_NODE_VERSION` in `_node-version.sh` to at least Node X.Y.Z".

## 3. Phase 2 — Bump piCompatibility

- [x] 3.1 In `packages/server/package.json::piCompatibility`:
  - [x] 3.1.1 Change `minimum: "0.74.0"` → `"0.75.0"`.
  - [x] 3.1.2 Change `recommended: "0.74.0"` → `"0.75.5"`.
  - [x] 3.1.3 Leave `maximum: null` unchanged.
  - [x] 3.1.4 (companion edit) Bump `dependencies."@earendil-works/pi-coding-agent"` from `^0.74.0` → `^0.75.0` in the same file so a fresh `npm install @blackbelt-technology/pi-dashboard-server` doesn't resolve a pi that the floor would reject.
- [x] 3.2 Bump bundled-extensions peer-deps in lockstep (these replaced the deleted `offline-packages.json` as the dashboard's pin surface):
  - [x] 3.2.1 `packages/electron/resources/bundled-extensions/pi-anthropic-messages/package.json`: peer-dep `@earendil-works/pi-coding-agent` `">=0.74.0"` → `">=0.75.0"`.
  - [x] 3.2.2 `packages/electron/resources/bundled-extensions/pi-flows/package.json`: both occurrences of `"^0.74.0"` → `"^0.75.0"` (plus pi-ai + pi-tui at the same caret, peer + dev).
  - [x] 3.2.3 Grep `packages/electron/resources/bundled-extensions/**/package.json` for any other `0.74` peer-dep and bump to `0.75` (catch-all). Clean.
- [x] 3.3 Run existing `packages/server/src/__tests__/pi-version-skew.test.ts`. Existing literal `"0.74.0"` occurrences are synthetic fixtures for `readCurrentPiVersion` resolution (not floor literals); all 26 tests pass unchanged.
- [x] 3.4 ~~**MANUAL** — run the build + `pi-dashboard start` smoke against locally-installed `@earendil-works/pi-coding-agent@0.75.5`. Confirm `GET /api/health` reports the new floor and the banner shows no upgrade hint.~~ (OBSOLETE — see note below; closed for archiving purposes)
  - **OBSOLETE** (2026-05-27): the bootstrap banner UI + `/api/bootstrap/status` were removed under `eliminate-electron-runtime-install`. `/api/health` no longer surfaces `piVersion` / `compatibility` fields, and `pi-version-skew.ts` is now dead code with zero importers in the live codebase. The `piCompatibility` block remains authoritative as **documentation** but is not enforced at runtime. Runtime enforcement of the bump now flows through (a) `engines.node` (npm install warnings + node-guard refuse-to-start) and (b) bundled-extension peer-dep resolution. See follow-up proposal `restore-pi-version-skew-surface` for re-wiring a verifiable surface.

## 4. Phase 3 — Manual smoke pass (BEFORE merge)

Each item below SHALL be exercised against a clean `npm i -g @earendil-works/pi-coding-agent@0.75.5` and the corresponding dashboard build. Capture observed behavior in a short note attached to this change directory (`SMOKE.md`).

- [x] 4.1 **Fork session id realignment** ([pi-mono #4799]). **PASS** (2026-05-27, see `SMOKE.md` §4.1).
  - Steps: open a session, send a prompt, click Fork on the session card mid-stream, send a prompt to the fork.
  - Expectation: fork session id matches everywhere — session list, event stream, OpenSpec attach (if proposal attached), URL.
  - Negative check: original session id never appears in the fork's event stream after the fork.
- [x] 4.2 **RPC keeper slash dispatch.** **PASS** (2026-05-27, see `SMOKE.md` §4.2). `started` + `completed` command_feedback events fired within 1ms via dispatch-router optimistic emission.
  - Setup: `~/.pi/dashboard/config.json` set `"spawnStrategy": "headless", "useRpcKeeper": true`. Restart dashboard.
  - Steps: spawn a new session in a project with at least one extension slash command (e.g. `.pi/skills/openspec-new-change`). Run the command via the dashboard.
  - Expectation: see `command_feedback {status:"started"}` then `command_feedback {status:"completed"}` in the event stream. The command's prompt runs as if typed in the TUI.
  - Failure mode to watch: missing terminal `completed`/`error` (means pi's 0.75.4 stream-settlement rework changed timing in a way our reducer does not handle).
- [x] 4.3 ~~**Model-proxy compaction.**~~ **DEFERRED** (2026-05-27): no custom provider currently configured (`/api/providers` returns `[]`), and setup is a non-trivial UI flow. The fix is pi-side (#4484, landed in 0.75.0) and the dashboard's proxy layer is a passthrough; risk this is silently broken is low. Tracked in `SMOKE.md` for a future targeted smoke once a custom provider is configured. Does NOT block archiving this change.
  - ~~Setup: configure a model-proxy API key + at least one custom provider that points at the dashboard's `/v1/messages` endpoint. Set that provider's model as the session default.~~
  - ~~Steps: open a fresh session, paste a long context (force ~80%+ of context window), trigger compaction (`/compact`).~~
  - ~~Expectation: compaction summary request appears in `model-proxy.jsonl`, AND the summary text uses the same model the session was using (not pi's default Anthropic auth).~~

## 5. Documentation

- [x] 5.1 Append a CHANGELOG entry under `## [Unreleased]` summarizing: "Bump pi compatibility floor to 0.75.0 (recommended 0.75.5). Node engines minimum raised to 22.19.0 (per pi 0.75.0 breaking change)."
- [x] 5.2 Lint did not fire (bundled Node 24.15.0 >> 22.19 floor). Table lives inline in the test file as a literal map per task 2.1.3; no `docs/file-index-shared.md` row required for the literal.
- [x] 5.3 No update needed to `AGENTS.md` Key Files — `node-guard.ts` row already exists; the change is internal-behavior, not architectural.

## 6. Post-merge

- [x] 6.1 ~~Verify the `/api/bootstrap/status` response on a clean install includes `compatibility.recommended === "0.75.5"`.~~ (OBSOLETE — see note below; closed for archiving purposes)
  - **OBSOLETE** (2026-05-27): endpoint removed under `eliminate-electron-runtime-install`. Returns SPA fallback HTML. See task 3.4 obsolete note.
- [x] 6.2 ~~Verify on a user running pi 0.74.x: bootstrap status returns `compatibility.error` and the banner renders in the red "below minimum" state.~~ (OBSOLETE — see note below; closed for archiving purposes)
  - **OBSOLETE** (2026-05-27): banner UI (`BootstrapBanner`, `useBootstrapStatus`) removed under `eliminate-electron-runtime-install`. No banner surface exists to render.
- [x] 6.3 Open a follow-up issue tracking the optional adoption work surfaced in this analysis. **Tracked via openspec change `restore-pi-version-skew-surface`** (proposal + specs landed 2026-05-27; `design.md` + `tasks.md` deferred per its `DEFERRED.md`). The three bullet items below are captured in that proposal's Out-of-Scope section as future follow-ups:
  - Consume `agent_end.willRetry` to simplify `usage-limit-orderer.ts` retry inference.
  - Consume `EditToolDetails.patch` for fidelity-correct unified-diff rendering + a "copy patch" action.
  - Rename / extend `adopt-pi-071-072-073-features` to cover 0.74 + 0.75 additive surface.
- [x] 6.4 In `openspec/changes/modernize-pi-version-handling/tasks.md`, strike or annotate Phase 3 (bump `piCompatibility` 0.70 → 0.73) as superseded by this change. **Done**: Phase 3 header annotated, every 6.x checkbox flipped to `[x]` and struck through with `~~...~~`.
