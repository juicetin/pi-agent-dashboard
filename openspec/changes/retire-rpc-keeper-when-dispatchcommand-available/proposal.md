## Why

The RPC keeper sidecar (`packages/server/src/rpc-keeper/keeper.cjs` + `keeper-manager.ts` + `dispatch-router.ts`) was introduced by `add-rpc-stdin-dispatch-with-keeper-sidecar` as a **workaround** for a missing upstream API: pi 0.74's `ExtensionAPI` does not expose `dispatchCommand` (or any equivalent), so the dashboard cannot route extension slash commands (`/ctx-stats`, `/curator`, `/agents`, `/flows:*`, etc.) from inside the bridge — it has to go around the bridge via a separate stdin RPC channel owned by the keeper.

The keeper is real engineering debt:

- ~120 LOC of CJS-pure keeper script + ~250 LOC of keeper-manager + dispatch-router + their tests
- A long-lived sidecar process per session (~1500 KB RSS each on Unix; named-pipe binding on Windows)
- A second IPC channel (UDS / named pipe) alongside the bridge WebSocket, with its own failure modes (stale sockets, orphaned keepers on dashboard crash, pi-vs-keeper PID race during shutdown)
- A second documented dispatch path in `docs/slash-command.md` (Path C "server-routed via RPC keeper") that exists solely because Path B (`pi.dispatchCommand`) hasn't shipped upstream

Once upstream pi exposes `dispatchCommand` on `ExtensionAPI`, the bridge can call it directly inside its own process — no separate sidecar, no second IPC channel, no socket cleanup. Path C collapses back into Path B; the keeper becomes vestigial.

This change retires the keeper. It depends on:

1. **Pre-flight**: an upstream PR landing in some pi 0.x release that adds `dispatchCommand(text, options?)` to `ExtensionAPI`. (Was `add-rpc-stdin-dispatch-with-keeper-sidecar` task 12.1 — relocated here as Phase 0 below.)
2. **Soak time**: the keeper-on path having shipped via `enable-rpc-keeper-by-default` (or its successor) and run for ≥ 1 release cycle without regressions, so we have evidence the dual-channel architecture works before retiring half of it. (Belt-and-suspenders: we don't want to retire the keeper for a Path-C bug that we'd discover only after Path-B-only would force everyone onto the broken path.)

The retirement is conservative: bridge tries Path B first, falls back to Path C if `pi.dispatchCommand` is missing, only after both Path B is universally available AND the keeper code path is removed does the three-way decision collapse to two-way (Path A keeper-less native commands like `/roles` + Path B `dispatchCommand`).

## What Changes

### Phase 0 — Upstream pre-flight (NOT a code change in this repo)

- **NEW**: Open a PR against `mariozechner/pi-coding-agent` (confirm correct upstream maintainer — could also be `earendil-works/pi-coding-agent`) adding:
  ```ts
  dispatchCommand(text: string, options?: { streamingBehavior?: StreamingBehavior }): Promise<void>
  ```
  to `ExtensionAPI`. Implementation: ~5 LOC delegating to `session.prompt(text, { expandPromptTemplates: true, streamingBehavior: options?.streamingBehavior })`. Reference both `fix-extension-slash-commands-in-dashboard` and `add-rpc-stdin-dispatch-with-keeper-sidecar` as the consumer changes.
- **Acceptance**: PR merged AND released in some `@earendil-works/pi-coding-agent@0.x.y`. Note the version in the design.md "Versions" section before drafting tasks.md. The dashboard's pinned pi version (`packages/electron/offline-packages.json` and any other manifest pin) gets bumped to ≥ that release.

### Phase 1 — Bridge prefers Path B, keeper code stays as fallback

- **MODIFIED**: `packages/extension/src/slash-dispatch.ts::tryDispatchExtensionCommand` — Path B (`hasDispatchCommand(pi)` true) is unchanged in shape but now actually fires for all dashboard-spawned headless sessions (pinned pi has `dispatchCommand`). Path C (server-routed via keeper) becomes the fallback for older pi versions still cached on disk / used in development. Path D (stopgap error) only fires when both Path B is missing AND the bridge is not in a headless RPC session.
- **MODIFIED**: `packages/shared/src/server-identity.ts` (or wherever the pi-version handshake lives) — surface the resolved pi version to the bridge so we can log a one-time "Path B available; keeper path retired in vNEXT" notice when the user is on the new pi but the dashboard still spawns the keeper. Telemetry-style, not a hard gate.
- **NOT YET REMOVED**: The keeper script, keeper-manager, dispatch-router, headless-pid-registry keeper extensions, and the `dispatch_extension_command` protocol message all stay in this phase. They are dead code only if every spawned session is on the new pi; we keep them as the fallback for one cycle.

### Phase 2 — Retire the keeper

- **REMOVED**: `packages/server/src/rpc-keeper/keeper.cjs`
- **REMOVED**: `packages/server/src/rpc-keeper/keeper-manager.ts`
- **REMOVED**: `packages/server/src/rpc-keeper/dispatch-router.ts`
- **REMOVED**: `packages/server/src/rpc-keeper/__tests__/` (entire dir)
- **REMOVED**: `packages/server/src/__tests__/keeper-manager.test.ts`
- **REMOVED**: `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`
- **REMOVED**: `packages/server/src/__tests__/dispatch-extension-command-router.test.ts`
- **MODIFIED**: `packages/server/src/process-manager.ts::spawnHeadless` — by the time this change ships, `enable-rpc-keeper-by-default` has already removed the legacy `tail -f` / direct-pipe paths and routed everything through the keeper. This change reverses *part* of that: `spawnHeadless` goes back to spawning pi directly (no sidecar). The Unix `tail -f` wrapper is **NOT reintroduced** — durability is no longer a goal because Path B does not depend on a live stdin pipe (the bridge calls `pi.dispatchCommand` in-process). Server-restart loses the in-flight RPC stdin queue, but that queue carried *only* the keeper-routed slash dispatches; with Path B those dispatches happen inside pi via the bridge's WS reconnect buffer, not via stdin.
- **REMOVED**: `packages/server/src/headless-pid-registry.ts` keeper extensions (`keeperPid`, `keeperSockPath`, `piPid` distinction, `writeRpc`, `cleanupKeeperOrphans`, `setKeeperWriter`, the keeper-mode branch in `killBySessionId`). The registry collapses back to its pre-keeper shape: one PID per session, kill by PID.
- **REMOVED**: `packages/shared/src/protocol.ts::DispatchExtensionCommandMessage` and its discriminated-union membership.
- **REMOVED**: Bridge wiring in `packages/extension/src/slash-dispatch.ts` for Path C — the helper goes back to the two-way decision (Path B or stopgap-when-Path-B-missing). The `connection?: DispatchConnection` parameter and `isHeadlessRpcSession()` predicate become unused; `isHeadlessRpcSession` is removed (its only consumer is Path C). Actually — confirm at implementation time whether `isHeadlessRpcSession` has other consumers; if it has grown into a general probe, keep it.
- **MODIFIED**: `packages/server/src/event-wiring.ts` — drop the `dispatch_extension_command` branch from the `piGateway.onEvent` switch.
- **REMOVED**: `~/.pi/dashboard/sessions/*.rpc.sock` and `*.rpc.sock.pid` cleanup. Add a one-time migration in `bootstrap-install.ts` (or wherever startup cleanup lives) that unlinks any leftover sockets / pid files on first launch of the post-retirement build. Cleanup is best-effort; a stale `.rpc.sock` on a system the user never reboots is harmless (the new server doesn't open them).

### Phase 3 — Documentation

- **MODIFIED**: `docs/slash-command.md` — three-way decision (B → C → D) collapses to two-way (B or D). Both Mermaid flowcharts pruned. The "Path C: server-routed via RPC keeper" subsection is deleted; Decision 1 historical note appended with this change name and the pi version that closed Path B.
- **MODIFIED**: `docs/architecture.md` — "RPC keeper sidecar" subsection deleted in entirety (~36 lines).
- **MODIFIED**: `docs/faq.md` — the "Why does /ctx-stats work in some sessions but not others?" entry collapses again to a single sentence: "If you're on pi ≥ X.Y.Z, slash commands work in every session type. Older pi: tmux / wt sessions still cannot dispatch extension commands (no stdin route)."
- **MODIFIED**: `AGENTS.md` Key Files — drop rows for `keeper.cjs`, `keeper-manager.ts`, `dispatch-router.ts`. Update `slash-dispatch.ts` row to reflect the two-way decision.
- **MODIFIED**: `docs/file-index-server.md` — drop `headless-pid-registry.ts` keeper-extension annotations.
- **MODIFIED**: `CHANGELOG.md` `[Unreleased]` — `### Removed` subsection added with the retirement entry, citing this change name and the pi version that enabled it.

### NOT INTRODUCED

- **No change to tmux / wt spawn paths**. They never had a Path C; their stopgap behavior is unchanged. With Path B universally available they finally get working slash commands too — the pi process they own already has `dispatchCommand`, and the bridge inside that pi can call it. Their slash commands light up automatically as a side effect of the upstream PR landing, not as a side effect of this change.
- **No change to abort / model-switch / thinking-level / non-slash send_prompt**. Those have always been bridge-WS-routed; the keeper retirement does not touch them.
- **No new capabilities**. This is pure deletion + simplification.

## Capabilities

### New Capabilities

(none — this change only removes capabilities and modifies existing ones)

### Modified Capabilities

- `command-routing`: step 9 description collapses from three-way (B → C → D) back to two-way (B or D). The "headless + keeper" branch is removed.
- `bridge-extension`: `slash-dispatch.ts` no longer has a Path C branch. The 5th `connection?` arg to `tryDispatchExtensionCommand` is removed; `isHeadlessRpcSession()` removed unless it has other consumers (verify at implementation).
- `process-manager`: `spawnHeadless` no longer goes through a keeper. (Note: by the time this change ships, the legacy `tail -f` and direct-pipe paths are already gone via `enable-rpc-keeper-by-default`. This change retires the keeper that *replaced* them and goes back to plain `spawn(pi, [...])`.)
- `headless-spawn`: spawn mechanism documentation reverts to "server spawns pi directly". The keeper invariant that "pi survives dashboard server restart" is **dropped** — Path B doesn't require a persistent stdin pipe, so there's no need to preserve durability. **BREAKING for any consumer relying on pi-survives-server-restart**: explicitly call this out; it was a documented invariant only since `add-rpc-stdin-dispatch-with-keeper-sidecar` and was de-facto only on Unix before that.

### Removed Capabilities

- `rpc-keeper-sidecar`: deleted in its entirety. The capability disappears from `openspec/specs/`.
- `extension-rpc-dispatch`: deleted in its entirety. The bridge → server `dispatch_extension_command` message and its server-side router are gone; nothing remains to spec.

## Impact

- **MODIFIED files** (Phase 1):
  - `packages/extension/src/slash-dispatch.ts` — log path-B-available message; Path C remains as fallback (~10 LOC delta)
  - `packages/shared/src/server-identity.ts` (or equivalent) — pi-version surfacing if not already present (~5 LOC delta)
- **REMOVED files** (Phase 2):
  - `packages/server/src/rpc-keeper/keeper.cjs`
  - `packages/server/src/rpc-keeper/keeper-manager.ts`
  - `packages/server/src/rpc-keeper/dispatch-router.ts`
  - `packages/server/src/rpc-keeper/__tests__/` (dir + fixtures: `mock-pi.cjs`, `mock-pi-shim.sh`, `keeper.test.ts`)
  - `packages/server/src/__tests__/keeper-manager.test.ts`
  - `packages/server/src/__tests__/process-manager-keeper-spawn.test.ts`
  - `packages/server/src/__tests__/dispatch-extension-command-router.test.ts`
- **MODIFIED files** (Phase 2):
  - `packages/server/src/process-manager.ts` — drop the keeper branch entirely; `spawnHeadless` goes back to `spawn(piPath, piArgs, ...)` directly (~80 LOC removed, ~30 LOC added for cleanup of conditionals)
  - `packages/server/src/headless-pid-registry.ts` — drop keeper extensions; revert to pre-keeper shape (~80 LOC removed)
  - `packages/server/src/__tests__/headless-pid-registry.test.ts` — drop the 11 keeper-mode scenarios (~150 LOC removed)
  - `packages/extension/src/slash-dispatch.ts` — Path C branch removed; helper signature simplified (~30 LOC removed)
  - `packages/extension/src/bridge.ts::sessionPrompt` — drop the 5th `connection` arg to `tryDispatchExtensionCommand` (~3 LOC delta)
  - `packages/extension/src/bridge-context.ts` — drop `isHeadlessRpcSession` (only if no other consumers — verify) (~10 LOC delta)
  - `packages/extension/src/__tests__/extension-slash-command-detection.test.ts` — drop the 5 `isHeadlessRpcSession` scenarios (~40 LOC delta)
  - `packages/extension/src/__tests__/bridge-slash-command-routing.test.ts` — drop the 7 Path-C scenarios in `tryDispatchExtensionCommand: Path B/C/D mutual exclusion`; rename describe block to `Path B/D mutual exclusion` (~80 LOC delta)
  - `packages/shared/src/protocol.ts` — drop `DispatchExtensionCommandMessage` and its union membership (~10 LOC delta)
  - `packages/server/src/event-wiring.ts` — drop the `dispatch_extension_command` switch branch (~5 LOC delta)
  - `packages/server/src/bootstrap-install.ts` (or equivalent startup hook) — add one-time `~/.pi/dashboard/sessions/*.rpc.sock*` cleanup (~15 LOC added)
- **MODIFIED docs** (Phase 3):
  - `docs/slash-command.md` — collapse to two-way decision; ~50 LOC delta
  - `docs/architecture.md` — delete RPC keeper subsection (~36 LOC removed)
  - `docs/faq.md` — collapse session-types entry to one sentence (~12 LOC delta)
  - `AGENTS.md` Key Files — drop 3 rows, update 1 (~5 LOC delta)
  - `docs/file-index-server.md` — drop keeper-extension annotations on `headless-pid-registry.ts` (~3 LOC delta)
  - `CHANGELOG.md` `[Unreleased]` — `### Removed` entry (~10 LOC added)
- **Backward compatibility**:
  - **BREAKING for users running pi < the upstream-PR release**: their dashboard-spawned headless sessions lose extension slash commands entirely (they had Path C; now there's no Path C and Path B is missing). Mitigation: the dashboard's pinned pi version (offline cache + bootstrap install) is bumped to ≥ the upstream-PR release in this same change, so a fresh install gets the new pi automatically. Users on a legacy global pi see the stopgap error feedback again. Document this in the CHANGELOG entry verbatim.
  - **BREAKING for users with `useRpcKeeper` still in their config**: by this change, `enable-rpc-keeper-by-default` has already removed the flag. No new break here.
  - Old bridges (without the bumped behavior) still try to send `dispatch_extension_command`; the new server logs the unknown message type and ignores it. The bridge's stopgap error feedback remains the user-visible signal.
- **Risk**:
  - The pinned-pi-version bump is the only thing that prevents Path-D-everywhere regressions. If a user has `pi` overridden to a legacy global binary (PATH wins over the dashboard's bundled install), they regress silently. Add a startup warning in the dashboard server when the resolved pi version is older than the minimum required for `dispatchCommand`.
  - Server restart no longer preserves pi sessions (durability invariant dropped). Document loudly. With Path B routed in-process via the bridge WS, a server restart now loses any *transient* in-flight slash dispatch that happens to be in the bridge's WS send buffer at restart time. The bridge's reconnect logic re-establishes the connection but does not auto-redispatch; the user has to re-type. (Today this is also true for non-slash text in the keeper-disabled tmux path, so the regression is bounded.)

## Depends On

This change DEPENDS ON two preceding events:

1. **Upstream**: A pi release containing `dispatchCommand(text, options?)` on `ExtensionAPI`. Phase 0 of this change is opening that PR. The change cannot proceed past Phase 0 acceptance until the PR ships.
2. **Dashboard**: `enable-rpc-keeper-by-default` (or its eventual successor) having shipped in a tagged release **AND** having had ≥ 1 release cycle of soak time. Reason: this change retires the keeper, so we need empirical evidence that the keeper-on architecture worked before tearing it out — specifically, evidence that the bridge's WS-reconnect buffer correctly delivers slash dispatches across reconnects (the property Path B will rely on once the keeper is gone).

As of drafting (2026-05-10), neither dependency is satisfied:
- The parent change `add-rpc-stdin-dispatch-with-keeper-sidecar` is implemented but sits under `[Unreleased]` (latest tag `v0.5.1` predates it).
- `enable-rpc-keeper-by-default` exists as a draft (`openspec/changes/enable-rpc-keeper-by-default/`, proposal only) and is itself gated on the parent change shipping + soaking.

**The proposal can be drafted now to surface the architecture and acceptance criteria for the upstream PR. Phase 0 (upstream PR) can start independently. Phases 1–3 (dashboard work) cannot start until both gates clear.**

## References

### Prior OpenSpec decisions

- `openspec/changes/add-rpc-stdin-dispatch-with-keeper-sidecar/tasks.md` §12 — "Upstream follow-up (NOT blocking this change)". Source of Phase 0 (12.1) and the original framing of this whole change (12.2).
- `openspec/changes/add-rpc-stdin-dispatch-with-keeper-sidecar/proposal.md` — the keeper architecture and dual-channel boundary this change retires.
- `openspec/changes/enable-rpc-keeper-by-default/proposal.md` — the intermediate change that flips keeper to default-on. This change reverses + tears down what that one consolidates.
- `openspec/changes/fix-extension-slash-commands-in-dashboard/design.md:64` — the "Path C rejected" decision. With Path B universally available, the original rejection rationale ("bridge architecturally inconsistent") is finally addressable: the keeper is removed and the bridge reclaims sole ownership of slash dispatch.

### Empirical evidence (to verify at implementation time)

- `@earendil-works/pi-coding-agent@<release-with-PR>` `dist/core/extensions/types.d.ts` — must list `dispatchCommand(text, options?)` on `ExtensionAPI`. Verify before starting Phase 1.
- `@earendil-works/pi-coding-agent@<release-with-PR>` `dist/core/extensions/extension-api.js` (or equivalent) — must implement `dispatchCommand` as a delegation to `session.prompt`. Verify the implementation actually dispatches extension commands (run the same `echo '{"type":"prompt","message":"/ctx-stats","id":"test"}' | pi --mode rpc` smoke test from the parent change's preflight).

### Architectural references

- `packages/server/src/rpc-keeper/` — the directory this change deletes in entirety.
- `packages/server/src/headless-pid-registry.ts` — gains keeper extensions in the parent change, loses them here.
- `packages/extension/src/slash-dispatch.ts` — the three-way decision helper. Collapses to two-way here.
- `docs/slash-command.md:99-100` — the canonical Path A/B/C/D analysis. Path C section deleted by this change.
