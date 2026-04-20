## ADDED Requirements

### Requirement: SpawnDetachedOptions supports per-call detach override

The `SpawnDetachedOptions` interface exposed by `packages/shared/src/platform/spawn.ts` (post-consolidation — was `detached-spawn.ts`) SHALL include an optional `detach?: boolean` field. When `undefined` or `true`, the child SHALL be spawned with `detached: true` (the current default — excludes child from parent's libuv Job Object on Windows, places in its own process group on POSIX). When `false`, the child SHALL be spawned with `detached: false` (keeps child inside parent's Job Object on Windows, in parent's process group on POSIX). The option is independent of `stdinMode`, `logFd`, `logPath`, and `windowsHide`.

#### Scenario: Default detach is true
- **WHEN** `spawnDetached({ cmd, args })` is called without specifying `detach`
- **THEN** the underlying `spawn()` options SHALL include `detached: true`

#### Scenario: Explicit detach: false honored
- **WHEN** `spawnDetached({ cmd, args, detach: false })` is called
- **THEN** the underlying `spawn()` options SHALL include `detached: false`
- **AND** on Windows, the child SHALL be killed automatically when the parent terminates (Job Object semantics)

#### Scenario: Explicit detach: true matches default
- **WHEN** `spawnDetached({ cmd, args, detach: true })` is called
- **THEN** behavior SHALL be identical to omitting `detach`

### Requirement: useWindowsRedirect gate requires all-ignore stdio

The internal `useWindowsRedirect` boolean inside `spawnDetached()` SHALL be computed as:

```ts
const useWindowsRedirect =
  platform === "win32"
  && !!opts.logPath
  && stdinMode === "ignore";
```

The `stdinMode === "ignore"` clause reflects a libuv-imposed invariant: `CREATE_NO_WINDOW` is set only when every stdio slot lacks `UV_INHERIT_FD` (verified via libuv source `src/win/process.c:1100-1110`). A parent-held stdin pipe inherently sets `UV_INHERIT_FD` on stdio[0], so the cmd.exe redirect branch cannot achieve `CREATE_NO_WINDOW` with pipe stdin. Taking the branch anyway would incur the cmd.exe overhead without gaining the no-flash benefit.

#### Scenario: logPath + stdin pipe does NOT use cmd.exe redirect
- **WHEN** `spawnDetached({ cmd, args, logPath: "/path/to/log", stdinMode: "pipe", platform: "win32" })` is called
- **THEN** `useWindowsRedirect` SHALL be `false`
- **AND** the child SHALL be spawned directly (not via cmd.exe) with the original argv

#### Scenario: logPath + ignore stdin uses cmd.exe redirect
- **WHEN** `spawnDetached({ cmd, args, logPath: "/path/to/log", stdinMode: "ignore", platform: "win32" })` is called
- **THEN** `useWindowsRedirect` SHALL be `true`
- **AND** the child SHALL be spawned via `cmd.exe /d /s /c "<cmd> <args> 1>>log 2>&1"`
- **AND** the stdio passed to Node's `spawn` SHALL be `["ignore", "ignore", "ignore"]` to satisfy libuv's `CREATE_NO_WINDOW` precondition

#### Scenario: no logPath, any stdin: no redirect
- **WHEN** `spawnDetached({ cmd, args, stdinMode: <any>, platform: "win32" })` is called WITHOUT `logPath`
- **THEN** `useWindowsRedirect` SHALL be `false`
- **AND** the child SHALL be spawned directly

#### Scenario: POSIX always skips redirect
- **WHEN** `spawnDetached({ ..., platform: "linux" })` or `platform: "darwin"` is called
- **THEN** `useWindowsRedirect` SHALL be `false` regardless of logPath or stdinMode
