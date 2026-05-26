## Context

The `add-rpc-stdin-dispatch-with-keeper-sidecar` change shipped in **v0.5.3** (2026-05-11) and has had one full release cycle of soak time through **v0.5.4** (2026-05-26) with no reported regressions. The parent change's tasks.md §13 explicitly defers the "default-on + legacy-removal" step to a follow-up change once that soak window clears. This change is that follow-up.

Current state in the working tree:

- `packages/shared/src/config.ts:310` — `DEFAULT_CONFIG.useRpcKeeper = false`.
- `packages/shared/src/config.ts:250` — `useRpcKeeper: boolean` field in the schema; L597 parses it.
- `packages/server/src/process-manager.ts:83-93` — `_setUseRpcKeeperOverrideForTests` + `shouldUseRpcKeeper()` runtime gate.
- `packages/server/src/process-manager.ts:409-419` — Unix legacy `sh -c "tail -f /dev/null | pi --mode rpc"` shell wrapper.
- `packages/server/src/process-manager.ts:480-525` — Windows legacy direct-stdin pipe (loses pi on dashboard server restart).
- `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts` — exercises both branches via the override hook.

User-visible symptom while keeper is opt-in: every slash command typed in a dashboard-spawned headless session (`/ctx-stats`, `/curator`, `/agents`, `/flows:*`) returns the stopgap `command_feedback {error}` ("requires pi 0.71+") unless the user has hand-edited `~/.pi/dashboard/config.json`. The keeper architecture exists specifically to fix this. Default-off means default-broken.

## Goals / Non-Goals

**Goals:**

- Slash commands work in every dashboard-spawned headless session without user configuration.
- One spawn code path for `--mode rpc` sessions on Unix and Windows (the keeper path).
- "pi survives dashboard server restart" becomes uniform across Unix and Windows.
- Test surface shrinks: no more "flag-on vs flag-off" matrix in keeper-spawn tests.
- Documentation stops calling the keeper experimental.

**Non-Goals:**

- No changes to `keeper.cjs` or `keeper-manager.ts`. The keeper code ships unchanged.
- No changes to the bridge ↔ server protocol. `dispatch_extension_command` is unchanged.
- No changes to tmux / wt / wsl-tmux spawn paths. Their slash-command experience continues using the existing stopgap.
- No new bridge-side detection logic. The existing `isHeadlessRpcSession()` probe stands; it just no longer needs to additionally test for keeper presence (every headless session now has one).
- No introduction of a new opt-out flag. Anyone who needs to escape the keeper path can pin to a pre-this-change release.

## Decisions

### Decision 1 — Flip default AND remove the flag in the same change (one-step)

**What:** `DEFAULT_CONFIG.useRpcKeeper = false → true` and the field itself (`config.ts` schema entry, `process-manager.ts` `shouldUseRpcKeeper()` reader, `_setUseRpcKeeperOverrideForTests` test hook) are removed in the same commit.

**Rationale:**
- The legacy paths have known bugs (Windows loses pi on every server restart). Keeping them as an opt-out preserves a known-broken escape hatch.
- Two spawn paths means every future change to spawn env, crash detection, or PID tracking has to be made and tested twice. One release cycle has already passed without keeper regressions; doubling maintenance for a second cycle has diminishing returns.
- Users who explicitly set `useRpcKeeper: false` get silent migration: the field is ignored, they get the keeper. CHANGELOG migration note explains why.

**Alternative considered — two-step (flip default in this change, remove flag in a third change next cycle):**
- Pros: explicit one-cycle escape hatch for anyone whose legacy-path muscle memory matters.
- Cons: requires us to maintain two spawn paths for another full cycle; doubles the test matrix; the escape hatch points at the known-broken Windows behavior. The parent change already gave one cycle of opt-in availability — that was the escape window. Extending it indefinitely past default-on is over-cautious.

**Decision:** one-step. The CHANGELOG migration note is the user-facing communication; the field-removal is the implementation cleanup.

### Decision 2 — Legacy spawn paths deleted, not deprecated

**What:** The Unix `tail -f /dev/null | pi --mode rpc` shell wrapper and the Windows direct-stdin pipe branches in `process-manager.ts::spawnHeadless` are removed outright. `spawnHeadless` becomes "always go through the keeper".

**Rationale:**
- Dead code rots fast. A branch nobody exercises will silently break on the next refactor of `buildSpawnEnv`, `headlessPidRegistry`, or `waitForNoCrash` and we won't notice until someone tries to enable the flag.
- Removal forces test coverage to consolidate around the keeper path, which is what we actually ship.
- The keeper path's crash-detection window already covers the failure modes the legacy paths handled.

**Alternative considered — leave the code in place, gate behind `useRpcKeeper === false` deprecation warning:**
- Cons: same maintenance cost, plus user confusion about a flag that does nothing.

**Decision:** delete.

### Decision 3 — Bridge-side `isHeadlessRpcSession()` probe stays as-is

**What:** No change to the bridge's headless-detection logic in `slash-dispatch.ts`.

**Rationale:**
- The probe doesn't currently check for keeper presence; it checks whether the bridge is running in a headless RPC pi at all. The keeper-presence implication is automatic once every headless session has a keeper.
- Touching the probe would require coordinated bridge + server release, which we don't need.

**Decision:** the probe is unchanged. Spec language describing it may say "headless" instead of "headless + keeper" but the probe code itself is byte-identical.

### Decision 4 — Tmux / wt / wsl-tmux strategies are untouched

**What:** Those spawn paths continue without any RPC stdin channel. Slash commands typed in them still emit the stopgap error.

**Rationale:**
- The user's terminal owns pi's stdin in those strategies. The keeper architecture can't help — the terminal would have to give up stdin to the keeper, which defeats the point of using a terminal.
- The proper long-term fix for tmux / wt is upstream `pi.dispatchCommand` (Path B from `slash-command.md`).

**Decision:** out of scope. Path A → Path B remains the upgrade path for terminal-hosted sessions.

## Risks / Trade-offs

- **[Risk]** A latent keeper-path bug surfaces post-flip that wasn't visible during the opt-in soak (most users left the flag off) → Mitigation: the CHANGELOG entry includes a one-line revert recipe (downgrade to v0.5.4 if regression hits). The keeper code itself has been on the codepath of every internal user with `useRpcKeeper: true` during the soak cycle; the team running with it default-on for two weeks of pre-release dogfooding is the practical mitigation.
- **[Risk]** Users with `useRpcKeeper: false` explicitly set in custom config silently switch path on upgrade → Mitigation: CHANGELOG `### Changed` entry calls this out; the field is silently ignored (no warning) because emitting a startup warning for a removed field rewards careful-config users with noise. They can delete the line at leisure.
- **[Trade-off]** No opt-out for one release cycle means a user hitting a keeper-path bug has no in-place workaround — they must downgrade. → Mitigated by the soak cycle that already happened; we are not flipping cold.
- **[Risk]** Test files outside `process-manager-keeper-spawn.test.ts` that call `_setUseRpcKeeperOverrideForTests` will fail to compile after the hook is removed → Mitigation: grep enumerates the call sites before edit; proposal §Impact already flags this.

## Migration Plan

1. Land this change (single commit / single PR).
2. CHANGELOG `[Unreleased] → Changed` entry includes:
   - "RPC keeper sidecar is now the default and only spawn path for headless RPC sessions."
   - One-line migration note: "Users who had `useRpcKeeper: false` in `~/.pi/dashboard/config.json` may delete that line — it is now ignored."
3. The next release cuts as normal. The flag's removal makes the version a minor bump (config schema change).
4. **Rollback strategy:** if a regression surfaces post-release, the user-facing recovery is to downgrade to the prior tag. There is no in-place flag to set. The keeper code itself remains unchanged from v0.5.4, so the regression would have to be in something else that this change touched (`spawnHeadless` cleanup, `headlessPidRegistry` updates, test wiring). Bisect within this change's diff.

## Open Questions

- None as of drafting. The proposal's Depends-On gate is now met. The implementation is mechanical — flip, delete, clean up tests, update docs.
