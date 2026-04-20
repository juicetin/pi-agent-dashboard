## MODIFIED Requirements

### Requirement: Headless spawn on Windows (fallback)

On Windows (`process.platform === "win32"`), headless pi sessions SHALL be spawned through the `spawnDetached()` primitive with `detach: false` + `stdinMode: "pipe"` + stderr captured to a per-session log file. The `detach: false` option causes libuv to keep the child inside the dashboard server's Job Object instead of allocating a new console — this eliminates the brief console-window flash that would otherwise occur on each session spawn (confirmed via libuv source `src/win/process.c:1100-1110`: `CREATE_NO_WINDOW` is only set when all stdio slots lack `UV_INHERIT_FD`, and `stdinMode: "pipe"` inherently sets `UV_INHERIT_FD` on stdio[0]). The server holds the stdin pipe write end; if the server exits, the agent terminates due to stdin EOF (or is killed by the Job Object closure — same outcome). This trade-off is intentional: stdin-pipe is required by pi's `--mode rpc` which binds `input: process.stdin`.

#### Scenario: Server exits while headless agent is running (Windows)
- **WHEN** the dashboard server exits on Windows
- **THEN** headless pi agents MAY terminate due to stdin EOF and/or libuv Job Object closure (known and accepted limitation)

#### Scenario: Windows session spawn produces no console flash
- **WHEN** a headless pi session is spawned on Windows while the dashboard server is running
- **THEN** no visible console window SHALL appear at any point during the spawn
- **AND** `detach: false` SHALL be passed to `spawnDetached()` to keep the child inside the parent's Job Object (no new console allocation)
- **AND** the cmd.exe redirect branch (`useWindowsRedirect`) of `spawnDetached()` SHALL NOT be triggered for this call, because `stdinMode: "pipe"` cannot achieve `CREATE_NO_WINDOW`

#### Scenario: Windows spawn stderr captured to log file
- **WHEN** a pi session is spawned on Windows
- **THEN** the child's stderr SHALL be redirected to `~/.pi/dashboard/sessions/pi-spawn-<timestamp>-<random>.log`
- **AND** the log file SHALL be opened in append mode
- **AND** the parent SHALL close its copy of the log file descriptor immediately after spawn (the child inherits its own copy)

## ADDED Requirements

### Requirement: Windows-session no-flash is test-verified

A test SHALL exist that covers the call-site's options passed to `spawnDetached()` for the Windows-headless branch. The test SHALL assert that `detach: false` is set, `stdinMode: "pipe"` is set, and `logPath` is NOT set (because logPath + pipe stdin would invoke the cmd.exe redirect branch, which cannot produce `CREATE_NO_WINDOW` and is therefore useless in this case).

#### Scenario: Test verifies Windows-headless spawn options
- **WHEN** `spawnHeadlessDetached` is invoked on a Windows-injected-platform test
- **THEN** the test SHALL assert that the `SpawnDetachedOptions` passed includes `detach: false`
- **AND** SHALL assert `stdinMode: "pipe"`
- **AND** SHALL assert that `logPath` is `undefined`
- **AND** SHALL assert `logFd` is a valid file descriptor (numeric, for stderr capture)
