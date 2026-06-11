## Context

The keeper (`packages/server/src/rpc-keeper/keeper.cjs`) spawns pi with `stdio: ["pipe", logFd, logFd]`, redirecting pi's stdout+stderr into `keeper-<sessionId>.log` at the OS file-descriptor level. Pi emits full model API frames to that stream, so logs grow unbounded (observed: 22 GB across 514 files, 95% disk). The capture is purely diagnostic — the keeper never reads pi's stdout; RPC events return to the dashboard over the bridge extension's WebSocket. The `rpc-keeper-sidecar` spec currently mandates the `logFd` sink unconditionally.

`KeeperManager` already forwards per-spawn data to the keeper through env vars (`PI_KEEPER_PI_ARGS`, `PI_KEEPER_PI_CMD`), and `config.ts` has an established pattern for typed config blocks with defaults (`DEFAULT_OPENSPEC_POLL`). The Settings panel mounts diagnostic tooling in the General tab (`DiagnosticsSection`, `ToolsSection`, `SpawnFailuresSection`).

## Goals / Non-Goals

**Goals:**
- Make capture of pi's stdout/stderr opt-in, default OFF.
- Preserve keeper lifecycle breadcrumbs in the log regardless of the flag (crash forensics survive).
- Zero added per-line overhead in either mode (keep the OS-level fd redirect; no JS line piping).
- Expose the toggle where diagnostic tools already live (Settings ▸ General).

**Non-Goals:**
- Log rotation / size cap when capture is ON (separate concern; can follow).
- Cleaning up existing oversized logs (manual / separate task).
- Per-session UI toggle. Scope is a global config flag applied at spawn time.

## Decisions

- **fd-redirect branch, not JS piping.** Disabled → `stdio: ["pipe", "ignore", "ignore"]` (Node maps `"ignore"` to `/dev/null`); enabled → `["pipe", logFd, logFd]`. Alternative (pipe stdout through JS to filter by level) rejected: adds per-line cost and contradicts the keeper's "dumb wire" design, and the value is low since the data is verbose model frames, not leveled logs.
- **Keeper lifecycle log always retained.** The keeper's `log()` writes to `keeper-<sessionId>.log` directly and is independent of the pi child's stdio. Only the pi child's sink is gated. This keeps `keeper starting` / `spawning pi` / `pi exited code=…` available for diagnosing dead sessions at near-zero cost.
- **Plumb via new env var `PI_KEEPER_CAPTURE_PI_OUTPUT`.** Mirrors existing keeper env plumbing. `KeeperManager` sets it to `"1"` when `config.keeperLog.capturePiOutput === true`, omits/empty otherwise. Keeper treats exactly `"1"` as enabled; anything else is disabled. Env var (not argv) matches the precedent and avoids argv parsing.
- **Config shape `keeperLog: { capturePiOutput: boolean }`, default `false`.** Object (not a bare boolean) so future keeper-log knobs (e.g. `maxBytes`) extend it without a breaking rename. Parsed/defaulted in `loadConfig` like `OpenSpecPollConfig`; absent ⇒ `false`; non-boolean ⇒ `false`; not written by `ensureConfig`.
- **UI: `ToggleField` in General tab next to diagnostics.** Reuses the existing `ToggleField` + save-diff machinery in `SettingsPanel.tsx`; help text flags it as debug-only and disk-consuming.

## Risks / Trade-offs

- [Disabling capture loses forensics for an unforeseen crash] → Keeper lifecycle log still records spawn/exit/error lines; users debugging a reproducible hang flip the toggle and respawn. Acceptable: the default protects the common case (disk), the toggle serves the rare case (active debugging).
- [Flag is read at spawn time, so already-running sessions are unaffected] → Documented behavior; toggling requires a new/respawned session. Matches how other keeper env vars behave.
- [Spec drift: `rpc-keeper-sidecar` previously hard-coded the `logFd` sink] → Delta MODIFIES that requirement; the "keeper does not read pi stdout" scenario is unchanged and still holds (redirect ≠ read).
- ["ignore" semantics differ per platform] → Node documents `"ignore"` as `/dev/null` on POSIX and the null device on Windows; no special handling needed.

## Migration Plan

No data migration. Absent `keeperLog` field ⇒ `capturePiOutput: false`, so existing installs immediately stop capturing pi output on next spawn. Rollback = revert the code; in-flight keepers are unaffected (flag is spawn-time). Existing large logs remain on disk untouched.

## Open Questions

- Should a follow-up change add a size cap / rotation for when capture is ON? (Recommended, out of scope here.)
