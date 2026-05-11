## Why

The parent change `add-rpc-stdin-dispatch-with-keeper-sidecar` shipped the per-session RPC keeper as **opt-in** (`useRpcKeeper: false` default) — a deliberate de-risking move so the legacy headless spawn paths (Unix `tail -f /dev/null | pi --mode rpc` wrapper, Windows direct stdin pipe) keep working for users who never flip the flag. That tasks-list explicitly defers the second half of the rollout to "a follow-up change … after Phase 1 has shipped and run for at least one release cycle without regressions" (`add-rpc-stdin-dispatch-with-keeper-sidecar/tasks.md` §13).

Three concrete problems persist while keeper is opt-in:

1. **Slash commands silently fail by default.** Users typing `/ctx-stats` / `/curator` / `/agents` / `/flows:*` in any dashboard-spawned headless session see the stopgap `command_feedback {error}` ("requires pi 0.71+") unless they have manually edited `~/.pi/dashboard/config.json`. The keeper architecture exists precisely to fix this; gating it behind a flag means the user-visible bug is only fixed for users who already know about the flag.
2. **Two spawn paths to maintain.** `process-manager.ts::spawnHeadless` carries both the keeper branch and the legacy tail-wrapper / direct-pipe branches. Every change to spawn-time env, crash-window, or PID-tracking semantics has to be made twice and tested twice (`process-manager-keeper-spawn.test.ts` + the pre-existing legacy-spawn tests).
3. **Windows still loses pi on server restart in the legacy path.** The legacy Windows path pipes pi's stdin directly from the dashboard server (`process-manager.ts:480-525`); when the server dies, pi loses stdin and exits. The keeper path fixes this for free. Default-off means default-broken on Windows.

## What Changes

- **MODIFIED**: `useRpcKeeper` default flipped from `false` to `true` in `packages/shared/src/config.ts`. Anyone who has explicitly set `useRpcKeeper: false` in their config keeps that behavior for one release.
- **MODIFIED**: `process-manager.ts::spawnHeadless` — the legacy non-keeper code paths (Unix `tail -f /dev/null | pi --mode rpc` shell wrapper, Windows direct-stdin pipe) are removed. The keeper branch becomes the only spawn mechanism for `--mode rpc` sessions.
- **REMOVED**: The `useRpcKeeper` config flag itself. The schema entry, the loader branch (`packages/shared/src/config.ts`), the `_setUseRpcKeeperOverrideForTests` test hook (`process-manager.ts`), and `shouldUseRpcKeeper()` are deleted. **BREAKING** for anyone who explicitly set the flag in config — but by removal time they have no legacy path to fall back to anyway.
- **MODIFIED**: `process-manager-keeper-spawn.test.ts` — assertions that depend on flipping the override flag are simplified (the keeper branch is now unconditional). The "flag-off keeps the legacy path" scenario is deleted entirely (no legacy path exists).
- **MODIFIED**: Documentation:
  - `CHANGELOG.md` `[Unreleased] → Changed`: keeper default-on, with a one-line migration note for anyone running with `useRpcKeeper: false` in their custom config.
  - `docs/faq.md`: the "Why does /ctx-stats work in some sessions but not others?" entry collapses — only two session types remain (headless+keeper / tmux+wt). The opt-in language goes away.
  - `docs/architecture.md` "RPC keeper sidecar" subsection: no longer experimental; legacy-spawn paragraphs deleted; remove the `useRpcKeeper` flag mention.
  - `docs/slash-command.md`: the three-way decision (B → C → D) keeps its shape, but the "headless + keeper" predicate simplifies to "headless" (every headless session has a keeper).
- **NOT INTRODUCED**: A change to the bridge ↔ server protocol. `dispatch_extension_command` is unchanged. The bridge's `isHeadlessRpcSession()` probe is unchanged (it still gates Path C; just doesn't need to additionally check whether a keeper exists — by definition every headless session now has one).
- **NOT INTRODUCED**: A change to tmux / wt spawn paths. Those continue without RPC stdin; their slash-command experience remains the existing stopgap. Only the headless RPC spawn path is touched.
- **NOT INTRODUCED**: Any change to `keeper.cjs` or `keeper-manager.ts`. The keeper code itself ships unchanged from the parent change; only the gating around it changes.

## Capabilities

### New Capabilities

(none — this change only modifies existing capabilities)

### Modified Capabilities

- `process-manager`: the `useRpcKeeper`-gated branch becomes the only branch. Requirements describing the legacy `tail -f /dev/null` wrapper (Unix) and direct-stdin pipe (Windows) are deleted. Requirements describing the keeper branch lose their "when `useRpcKeeper` is true" guard.
- `headless-spawn`: the spawn mechanism is documented as "keeper-routed only". The opt-in / fallback language is removed. The "pi survives server restart" invariant becomes uniform across Unix and Windows (Windows previously was an inconsistent exception in the legacy path).
- `rpc-keeper-sidecar`: lifecycle requirements stay identical. The "experimental — opt-in via `useRpcKeeper`" framing in the spec preamble is deleted. The keeper is the production path.
- `shared-config`: the `useRpcKeeper` config field is removed. The default-config requirement that listed `useRpcKeeper: false` is deleted.
- `extension-rpc-dispatch`: the headless-detection predicate in routing-step 9 (Path C) simplifies. The spec previously needed to say "headless + keeper available"; it now says "headless" because keeper-presence is implied. Any requirement language about Path C only firing when `useRpcKeeper === true` is removed.

## Impact

- **MODIFIED files**:
  - `packages/shared/src/config.ts` — flip default, then in the same change remove the field entirely (`DEFAULT_CONFIG.useRpcKeeper`, schema entry, loader parse line) (~10 LOC removed)
  - `packages/server/src/process-manager.ts` — delete `shouldUseRpcKeeper()`, `_setUseRpcKeeperOverrideForTests`, the legacy Unix shell-wrapper branch, the legacy Windows direct-pipe branch; `spawnHeadless` becomes "always go through the keeper" (~150 LOC removed, ~10 LOC added for cleanup-of-the-conditional)
  - `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts` — drop the override-flag setup, drop the "flag-off keeps the legacy path" scenario; the remaining tests simplify (~30 LOC delta)
  - `packages/server/src/__tests__/` — any other test that used `_setUseRpcKeeperOverrideForTests` is updated to remove the call (none currently expected, but grep before implementing)
  - `CHANGELOG.md` `[Unreleased] → Changed` — keeper default-on entry with migration note (~8 LOC)
  - `docs/faq.md` — collapse the three-session-type entry to two (~10 LOC delta)
  - `docs/architecture.md` — drop "experimental" framing, drop legacy-spawn paragraphs (~20 LOC delta)
  - `docs/slash-command.md` — Path C predicate simplified, Decision 1 historical note appended with this change name (~12 LOC delta)
  - `AGENTS.md` Key Files — `slash-dispatch.ts` row updated to drop the keeper-branch reference (rows for `keeper.cjs` / `keeper-manager.ts` / `dispatch-router.ts` stay) (~3 LOC)
- **NEW files**: none.
- **REMOVED files**: none. The keeper code stays (it is the production path).
- **Backward compatibility**:
  - Users who never set `useRpcKeeper` in their config: zero behavior change beyond "slash commands now work in headless sessions by default".
  - Users who explicitly set `useRpcKeeper: true`: zero behavior change.
  - Users who explicitly set `useRpcKeeper: false`: the field is silently ignored (no warning — the flag no longer exists). They get the keeper path. The CHANGELOG migration note tells them why.
  - Old bridges (without `dispatch_extension_command`) continue to emit the stopgap error feedback; server still accepts them. No bridge-side change.
- **Risk**:
  - The keeper-on path has not had a release cycle of real-world soak time (gated on Phase 1 actually shipping in a tagged release first — see "Depends On"). If a regression surfaces in the keeper path between v(Phase 1) and v(this change), the legacy path is the user's escape hatch and we shouldn't remove it yet.
  - Removing the flag in the same change as flipping the default means there is no opt-out for one release cycle. Two-step alternative (flip default first, remove flag and legacy paths in a third change one cycle later) is laid out as a tradeoff in design.md.
- **Durability**: identical to today's keeper-on path. "pi survives dashboard server restart" becomes uniform across Unix and Windows.

## Depends On

This change DEPENDS ON `add-rpc-stdin-dispatch-with-keeper-sidecar` having shipped in a tagged release **AND having had at least one release cycle of soak time** (per the parent change's §13 ship-criteria preamble: "After Phase 1 has shipped and run for at least one release cycle without regressions").

As of drafting (2026-05-10), the parent change is implemented but its CHANGELOG entry sits under `[Unreleased]`; the latest tagged release is `v0.5.1` and contains no keeper code. **This change must not be implemented until at least one tagged release containing the parent change has been out for one cycle.** Implementation work (tasks.md) should not start before that gate clears. The proposal, design, and specs can be drafted now to surface tradeoffs and get review concurrent with Phase 1 release prep.

## References

### Prior OpenSpec decisions (cited above)

- `openspec/changes/add-rpc-stdin-dispatch-with-keeper-sidecar/tasks.md` §13 — "Phase 2 ship criteria (default ON) — separate change". Source of the four scope items in this change.
- `openspec/changes/add-rpc-stdin-dispatch-with-keeper-sidecar/proposal.md` — the dual-channel boundary and per-session keeper architecture this change consolidates.
- `openspec/changes/fix-extension-slash-commands-in-dashboard/design.md:64` — the "Path C rejected" decision the keeper architecture reopened. With keeper default-on, Path C is the production path for headless sessions.

### Empirical evidence

- `packages/shared/src/config.ts:273` — `DEFAULT_CONFIG.useRpcKeeper = false` (the line this change flips, then deletes).
- `packages/server/src/process-manager.ts:409-419` — current Unix `tail -f /dev/null | pi --mode rpc` wrapper (the durability invariant source this change retires).
- `packages/server/src/process-manager.ts:480-525` — current Windows piped-stdin path (loses durability on server restart; this change retires it in favor of the keeper).
- `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts` — the test file whose "flag-off keeps the legacy path" scenario this change deletes.
- `CHANGELOG.md:11-22` — Phase 1 entry under `[Unreleased]`; confirms the gate condition above.

### Architectural references

- `packages/server/src/rpc-keeper/keeper.cjs` — the production keeper binary. Unchanged by this change.
- `packages/server/src/rpc-keeper/keeper-manager.ts` — the server-side spawn / write / discover helper. Unchanged by this change.
- `packages/server/src/rpc-keeper/dispatch-router.ts` — handles `dispatch_extension_command` end-to-end. Unchanged by this change.
- `docs/slash-command.md` — the three-way decision diagram. Path C predicate simplifies but its shape is unchanged.
