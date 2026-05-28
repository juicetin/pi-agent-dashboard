## MODIFIED Requirements

> Ground-truth update: the strong-signal path
> (`PI_DASHBOARD_SPAWN_TOKEN` env → bridge sends `dashboardSpawned: true`
> on every `session_register` → server stamps `source: "dashboard"`)
> already shipped in `fix-dashboard-source-mislabelling` (`5a31daa6`).
> The legacy cwd-FIFO counter (`Map<cwd, count>` at `server.ts:358`)
> remains as the fallback signal for bridges that do not set the env var.
> This spec delta tightens the fallback so it no longer corrupts the
> on-disk sidecar, and adds an opt-in strict mode plus a cleanup script
> for already-corrupted sidecars.

### Requirement: Source-tag stamp gated by strong signal; legacy fallback logged and non-persistent

When `event-wiring.ts` receives `session_register`, the server SHALL
delegate the `source: "dashboard"` stamp decision to
`decideDashboardSource`. The function SHALL accept four inputs:
`dashboardSpawned` (strong signal), `pendingCount` (legacy cwd-FIFO
counter snapshot), `isNewSession`, and `strictCorrelation` (server env
flag).

The function SHALL return `{ shouldStamp, consumeLegacyCounter,
persistMeta }`:

- **Strong-signal branch:** when `dashboardSpawned === true`,
  `shouldStamp = true`, `consumeLegacyCounter = false`,
  `persistMeta = true`. The server SHALL update `sessionManager`,
  broadcast `session_updated`, AND persist `{ source: "dashboard" }`
  to the session's `.meta.json` sidecar via `mergeSessionMeta`.

- **Legacy fallback branch:** when `dashboardSpawned !== true` AND
  `pendingCount > 0` AND `isNewSession === true` AND
  `strictCorrelation === false`, `shouldStamp = true`,
  `consumeLegacyCounter = true`, `persistMeta = false`. The server
  SHALL update `sessionManager`, broadcast `session_updated`, decrement
  the cwd counter, AND log a single-line warning identifying
  `sessionId` and `cwd`. The server SHALL NOT write the sidecar.

- **Strict-mode suppression:** when `dashboardSpawned !== true` AND
  `strictCorrelation === true`, the legacy branch SHALL be suppressed
  regardless of `pendingCount`. Return value SHALL be
  `{ shouldStamp: false, consumeLegacyCounter: false,
  persistMeta: false }`. The server SHALL NOT update state, broadcast,
  consume the counter, or write the sidecar.

- **No-match branch:** otherwise return all-`false`.

The server SHALL read `strictCorrelation` once at module init from
`process.env.STRICT_SPAWN_CORRELATION === "1"`.

#### Scenario: Strong signal stamps and persists
- **WHEN** `session_register { sessionId: "S", cwd: "/p", dashboardSpawned: true }` arrives
- **THEN** `sessionManager.update(S, { source: "dashboard" })` SHALL be called
- **AND** `broadcastSessionUpdated(S, { source: "dashboard" })` SHALL be called
- **AND** `mergeSessionMeta(sessionFile, { source: "dashboard" })` SHALL be called
- **AND** the legacy cwd counter SHALL NOT be decremented
- **AND** no fallback log line SHALL be emitted

#### Scenario: Strong signal on reattach re-stamps without persisting twice
- **WHEN** the same session reattaches with `dashboardSpawned: true` and current `source === "dashboard"`
- **THEN** `sessionManager.update` SHALL NOT be invoked (idempotent guard already in code)
- **AND** `broadcastSessionUpdated` SHALL NOT be invoked
- **AND** `mergeSessionMeta` MAY still be invoked (best-effort, idempotent for identical content)

#### Scenario: Legacy fallback stamps in memory but not on disk
- **WHEN** `session_register { sessionId: "S", cwd: "/p" }` arrives without `dashboardSpawned`
- **AND** `pendingDashboardSpawns.get("/p") === 1`
- **AND** `isNewSession === true`
- **AND** `STRICT_SPAWN_CORRELATION !== "1"`
- **THEN** `sessionManager.update(S, { source: "dashboard" })` SHALL be called
- **AND** `broadcastSessionUpdated(S, { source: "dashboard" })` SHALL be called
- **AND** the counter for `/p` SHALL be decremented (entry removed when reaching 0)
- **AND** `mergeSessionMeta` SHALL NOT be called
- **AND** exactly one log line matching `[event-wiring] cwd-FIFO source-stamp fallback sessionId=S cwd=/p` SHALL be emitted

#### Scenario: Strict mode suppresses legacy fallback entirely
- **WHEN** the same legacy register arrives but `STRICT_SPAWN_CORRELATION === "1"`
- **THEN** `sessionManager.update` SHALL NOT be called
- **AND** `broadcastSessionUpdated` SHALL NOT be called
- **AND** the counter for `/p` SHALL NOT be decremented
- **AND** `mergeSessionMeta` SHALL NOT be called
- **AND** no fallback log line SHALL be emitted

#### Scenario: No pending entry → no stamp
- **WHEN** any `session_register` arrives, `dashboardSpawned !== true`, and `pendingCount === 0`
- **THEN** the server SHALL NOT stamp `source: "dashboard"` regardless of `strictCorrelation`

### Requirement: One-shot cleanup utility for legacy mis-stamped `.meta.json` files

The repository SHALL ship a standalone Node script
`scripts/repair-meta-source.mjs` that scans every `*.meta.json` under
`~/.pi/agent/sessions/`. For each file with `source: "dashboard"`, the
script SHALL remove the `source` field and write the file back
atomically.

Rationale: there is no reliable JSONL signal that distinguishes
TUI-origin from dashboard-origin sessions after the fact. Live
dashboard-spawned sessions re-stamp themselves on the next bridge
reattach via `PI_DASHBOARD_SPAWN_TOKEN` (the strong signal landed in
`5a31daa6`). Dead/archived sessions lose the tag permanently —
acceptable, because they cannot be reattached or interacted with and
the icon mapping for historical sessions is a cosmetic concern only.

The script SHALL be idempotent (a second run after a successful first
run MUST report `cleaned 0`), SHALL print a summary
`kept N / cleaned M / errors E`, and SHALL exit with code 0 on
success.

#### Scenario: Removes dashboard tag unconditionally
- **WHEN** a `.meta.json` has `source: "dashboard"`
- **THEN** the script SHALL remove the `source` field from that `.meta.json`
- **AND** all other fields SHALL be preserved (modulo JSON re-serialization)
- **AND** the file SHALL be written via atomic tmp+rename

#### Scenario: Leaves non-dashboard sources intact
- **WHEN** a `.meta.json` has `source: "tui"`, `source: "tmux"`, `source: "cli"`, or no `source` field at all
- **THEN** the script SHALL leave the file unchanged

#### Scenario: Idempotent re-run
- **WHEN** the script has already cleaned a session's `.meta.json`
- **AND** the script is run again
- **THEN** that file SHALL be classified as `kept`
- **AND** the file content SHALL NOT change

#### Scenario: Tolerates malformed files
- **WHEN** a `.meta.json` or `.jsonl` fails to parse
- **THEN** the script SHALL increment the `errors` counter
- **AND** SHALL continue processing remaining files
- **AND** SHALL NOT exit with a non-zero code solely because of parse failures
