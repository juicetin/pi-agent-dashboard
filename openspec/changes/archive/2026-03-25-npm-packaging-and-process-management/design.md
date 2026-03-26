## Context

The dashboard is a three-component system (bridge extension + server + web client). The server currently starts as a fire-and-forget detached process spawned by the bridge extension (`server-launcher.ts`) or manually via `pi-dashboard`. There's no PID tracking for the server itself, no way to stop/restart it from the CLI, and the npm package uses a placeholder scope.

Key existing pieces:
- `src/server/cli.ts` — current CLI entry point, runs foreground only
- `src/extension/server-launcher.ts` — spawns server via `npx tsx cli.ts`, detached
- `src/extension/server-probe.ts` — TCP port check (reusable)
- `src/server/headless-pid-registry.ts` — PID tracking for spawned *pi sessions* (not the server)
- `POST /api/shutdown` endpoint already exists on the server

## Goals / Non-Goals

**Goals:**
- Package publishable to npm under `@blackbelt-technology/pi-dashboard`
- `pi-dashboard start/stop/restart/status` subcommands for daemon management
- PID file at `~/.pi/dashboard/server.pid` for reliable process tracking
- Health endpoint for liveness probing
- Bridge extension launcher aligned with PID file mechanism

**Non-Goals:**
- Compiling server TypeScript to JavaScript (keep tsx runtime for now)
- systemd/launchd service files
- Multi-instance support (only one server at a time)
- Log file management (server logs to stdout; when daemonized, output is discarded)

## Decisions

### D1: PID file for server process tracking

**Decision**: Write a PID file to `~/.pi/dashboard/server.pid` when the server starts. Remove it on graceful shutdown.

**Why**: Industry-standard pattern for daemon management. Simple, no external dependencies. The `headless-pid-registry.ts` already demonstrates PID file patterns in this codebase — but that tracks child pi sessions, not the server itself.

**Alternatives**:
- *Lock file with flock*: More robust against stale PIDs but platform-dependent
- *Unix socket*: Reliable but overkill for this use case

**Stale PID handling**: On `start`, if a PID file exists, check if the process is alive (`kill(pid, 0)`). If dead, overwrite. If alive, check the port — if port responds, report "already running"; if not, the PID is stale (different process reused the PID), overwrite.

### D2: CLI subcommand structure

**Decision**: Add positional subcommands to `cli.ts`:

```
pi-dashboard              → foreground (backward compatible, current behavior)
pi-dashboard start        → daemonize (spawn detached child, write PID file)
pi-dashboard stop         → read PID file, send SIGTERM, wait, remove PID file
pi-dashboard restart      → stop + start
pi-dashboard status       → check PID file + port probe, print status
```

**Why**: Follows the pattern of `redis-server`, `nginx`, `pm2` — familiar to developers. No subcommand = foreground keeps backward compatibility.

**Alternatives**:
- *Flags (`--daemon`, `--stop`)*: Less discoverable, mixes concerns
- *Separate binaries (`pi-dashboard-ctl`)*: Over-engineered for this

### D3: `start` subcommand daemonization

**Decision**: The `start` subcommand re-spawns the same `cli.ts` as a detached child process (without the `start` argument, so it runs in foreground mode in the background). Uses `child_process.spawn` with `detached: true, stdio: 'ignore'`.

**Why**: Same approach as `server-launcher.ts` but from the CLI itself. The server writes its own PID file on startup (in foreground mode), so the parent just needs to wait briefly and verify via port probe.

### D4: Health endpoint

**Decision**: Add `GET /api/health` returning `{ ok: true, pid: <number>, uptime: <seconds> }`.

**Why**: The `status` subcommand and bridge extension can use HTTP health check in addition to TCP probe. Provides more info than just "port is open".

### D5: tsx as a runtime dependency

**Decision**: Move `tsx` from `devDependencies` to `dependencies`.

**Why**: The CLI shebang is `#!/usr/bin/env node --import tsx`. When installed via npm, tsx must be available. The bridge extension launcher also uses `npx tsx`. Moving it to dependencies ensures it's always present. ~20MB cost is acceptable for a dev tool.

### D6: Bridge extension launcher alignment

**Decision**: Update `server-launcher.ts` to write the PID file after successful launch, so `pi-dashboard status` can detect servers started by the extension.

**Why**: Currently the extension spawns the server fire-and-forget. If the server writes its own PID file on startup (foreground mode), this is already handled — the launched server process will write the PID file itself. The launcher just needs to spawn `pi-dashboard` (the binary) instead of `npx tsx cli.ts` so it goes through the same path.

## Risks / Trade-offs

- **Stale PID files**: Process crashes without cleanup → mitigated by alive check on `start`/`status`
- **tsx dependency size**: ~20MB added to install → acceptable for dev tooling
- **Race condition on start**: Two concurrent `start` calls could both see no PID file → mitigated by port probe (second caller detects port in use)
- **No log capture in daemon mode**: `stdio: 'ignore'` means daemon logs are lost → users can run foreground mode (`pi-dashboard` with no args) for debugging
