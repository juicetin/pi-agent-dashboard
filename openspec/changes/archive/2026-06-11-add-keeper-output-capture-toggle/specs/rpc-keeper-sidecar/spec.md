## MODIFIED Requirements

### Requirement: RPC keeper sidecar process per headless session
For every headless pi session spawned via `spawnPiSession({strategy: "headless"})`, the dashboard server SHALL spawn a per-session keeper process (`packages/server/src/rpc-keeper/keeper.cjs`) BEFORE spawning pi. The keeper SHALL spawn pi as its own child process, owning pi's stdin pipe. The keeper SHALL select pi's stdout/stderr sink based on the `PI_KEEPER_CAPTURE_PI_OUTPUT` env var (set by `KeeperManager` from `config.keeperLog.capturePiOutput`): when capture is enabled, the keeper SHALL use `stdio: ["pipe", logFd, logFd]` so pi's stdout/stderr are appended to `keeper-<sessionId>.log`; when capture is disabled (the default), the keeper SHALL use `stdio: ["pipe", "ignore", "ignore"]` so pi's stdout/stderr are discarded. Regardless of the flag, the keeper SHALL write its own lifecycle log lines (`keeper starting`, `spawning pi`, `pi exited code=…`, errors) to `keeper-<sessionId>.log` via its internal `log()` writer. The keeper SHALL outlive dashboard server restarts: when the dashboard server exits, the keeper SHALL continue running and pi SHALL continue running. The keeper SHALL exit with code 0 when its child pi exits.

The keeper SHALL be a CommonJS file (`.cjs`) with no TypeScript loader, jiti, or tsx dependencies — it imports only Node built-in modules (`child_process`, `net`, `fs`, `path`). This mirrors the precedent set by `packages/server/preload-fastify.cjs`.

#### Scenario: Keeper spawned before pi
- **WHEN** `spawnPiSession(cwd, {strategy: "headless"})` is invoked
- **THEN** the dashboard server SHALL spawn `node <path>/keeper.cjs <sessionId>` with the spawn env
- **AND** the keeper process SHALL spawn `pi --mode rpc` as its child
- **AND** pi's stdin SHALL be a pipe owned by the keeper process

#### Scenario: Capture disabled by default discards pi output
- **WHEN** the keeper starts and `PI_KEEPER_CAPTURE_PI_OUTPUT` is unset, empty, or not `"1"`
- **THEN** the keeper SHALL spawn pi with `stdio: ["pipe", "ignore", "ignore"]`
- **AND** pi's stdout/stderr SHALL NOT be written to `keeper-<sessionId>.log`
- **AND** the keeper's own lifecycle log lines SHALL still be written to `keeper-<sessionId>.log`

#### Scenario: Capture enabled archives pi output
- **WHEN** the keeper starts and `PI_KEEPER_CAPTURE_PI_OUTPUT` is `"1"`
- **THEN** the keeper SHALL spawn pi with `stdio: ["pipe", logFd, logFd]`
- **AND** pi's stdout/stderr SHALL be appended to `keeper-<sessionId>.log`

#### Scenario: Keeper survives dashboard server restart
- **WHEN** the dashboard server exits (graceful `/api/shutdown` or SIGTERM) while a headless session is active
- **THEN** the keeper process SHALL continue running
- **AND** pi SHALL continue running with stdin still held by the keeper
- **AND** when the new dashboard server starts, it SHALL discover the keeper via the socket-scan reconnect path (see Requirement "Server reconnect to existing keepers on startup")

#### Scenario: Keeper exits when pi exits
- **WHEN** the pi child process exits (any reason: graceful shutdown, crash, signal)
- **THEN** the keeper SHALL detect the exit via `child.on("exit", ...)`
- **AND** the keeper SHALL unlink its UDS socket file and PID sidecar file
- **AND** the keeper SHALL exit with code 0
