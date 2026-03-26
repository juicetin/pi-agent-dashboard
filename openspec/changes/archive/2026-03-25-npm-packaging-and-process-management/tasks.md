## 1. Package Identity & Dependencies

- [x] 1.1 Rename package from `@user/pi-dashboard` to `@blackbelt-technology/pi-dashboard` in `package.json`
- [x] 1.2 Move `tsx` from `devDependencies` to `dependencies` in `package.json`
- [x] 1.3 Fix README stale `pi-chainlint` references and update install instructions for new scope

## 2. PID File Module

- [x] 2.1 Create `src/server/server-pid.ts` with functions: `writePid(pid)`, `readPid()`, `removePid()`, `isServerRunning()` — using `~/.pi/dashboard/server.pid`
- [x] 2.2 Write tests for `server-pid.ts`: write/read/remove, stale PID detection, missing file handling
- [x] 2.3 Integrate PID file write into server startup (in `createServer` or `cli.ts` foreground path)
- [x] 2.4 Integrate PID file removal into server shutdown handler

## 3. Health Endpoint

- [x] 3.1 Add `GET /api/health` route to `server.ts` returning `{ ok: true, pid, uptime }`
- [x] 3.2 Write test for health endpoint response

## 4. CLI Subcommands

- [x] 4.1 Refactor `cli.ts` to parse a positional subcommand (`start`, `stop`, `restart`, `status`) before flags
- [x] 4.2 Implement `start` subcommand: spawn detached child (foreground mode), wait for port probe, print status
- [x] 4.3 Implement `stop` subcommand: read PID file, send SIGTERM, wait for exit, remove stale PID file
- [x] 4.4 Implement `restart` subcommand: stop then start
- [x] 4.5 Implement `status` subcommand: check PID file + port probe, print running/stopped info
- [x] 4.6 Ensure no-subcommand path (foreground) remains backward compatible
- [x] 4.7 Write tests for subcommand parsing and PID-based stop/status logic

## 5. Bridge Extension Alignment

- [x] 5.1 Update `server-launcher.ts` to spawn `pi-dashboard` binary (or `cli.ts` foreground) instead of `npx tsx cli.ts` so PID file is written by the spawned server
- [x] 5.2 Verify extension auto-start + `pi-dashboard status` see the same server
