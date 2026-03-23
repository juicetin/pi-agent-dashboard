## Context

The dashboard has two runtime components — the bridge extension (runs inside pi) and the dashboard server (standalone Node.js process). Both need the same configuration values (ports, paths), but currently:

- The server CLI has its own inline `loadConfig()` that reads `~/.pi/dashboard/config.json`
- The bridge extension hardcodes `ws://localhost:9999` with only a `PI_DASHBOARD_URL` env var override
- Users must manually start the server before pi sessions can connect
- If a user changes the server port in config, the extension doesn't know about it

## Goals / Non-Goals

**Goals:**
- Single shared config module used by both server and extension
- Auto-create `~/.pi/dashboard/config.json` with defaults on first access
- Bridge extension auto-starts the server when it's not running
- User sees a notification when the server is spawned
- `PI_DASHBOARD_URL` env var still works as a final override

**Non-Goals:**
- Auto-stopping the server (it runs as a long-lived daemon)
- Managing multiple server instances
- Config hot-reload (requires restart/reconnect to pick up changes)

## Decisions

### 1. Flat config schema

**Decision:** Keep `autoStart` as a top-level field alongside `port`, `piPort`, etc.

```json
{
  "port": 8000,
  "piPort": 9999,
  "dbPath": "~/.pi/dashboard/dashboard.db",
  "retentionDays": 30,
  "autoStart": true
}
```

**Alternatives considered:**
- *Nested `server` object*: `{ server: { autoStart: true, command: "..." } }`. Adds structure but the config is small enough that nesting adds complexity without value.

**Rationale:** Five fields don't warrant nesting. Easy to read, easy to edit.

### 2. TCP probe for server detection

**Decision:** Use a quick TCP connect attempt on `localhost:{piPort}` to detect whether the server is running.

**Alternatives considered:**
- *PID file check*: Server writes `~/.pi/dashboard/server.pid`. Extension checks if that PID is alive. More reliable but requires the server to manage the PID file lifecycle (create, clean up on crash, etc.).
- *HTTP health endpoint*: `GET /api/health`. Requires the full HTTP stack to be up, slower than a TCP probe.

**Rationale:** TCP probe is fast (~10ms for localhost), requires no server-side changes, and correctly detects "port is listening" regardless of how the server was started.

### 3. Resolve server CLI path relative to extension

**Decision:** The bridge extension resolves the server CLI script path relative to its own file location (`../../server/cli.ts` from `src/extension/bridge.ts`).

**Alternatives considered:**
- *Config field `server.command`*: User specifies the spawn command. Flexible but adds config burden for the common case.
- *Expect `pi-dashboard` in PATH*: Works for npm installs but breaks for local dev (`pi -e ./bridge.ts`).

**Rationale:** Both the extension and server live in the same package. Relative path resolution works for all install methods (npm global, local path, `pi -e`) without any user configuration.

### 4. Spawn server detached with stdio ignored

**Decision:** Use `child_process.spawn()` with `{ detached: true, stdio: 'ignore' }` and `unref()` so the server outlives the pi session.

**Rationale:** The server is a daemon — it should keep running after pi exits. Detached + unref ensures Node.js doesn't wait for the child. stdio ignored prevents the server's output from mixing with pi's TUI.

### 5. Race condition handling: let it fail

**Decision:** If multiple pi sessions start simultaneously and all try to spawn the server, let the duplicates fail with `EADDRINUSE`. The connection manager's retry loop handles convergence.

**Alternatives considered:**
- *File lock on PID file*: First spawner acquires lock, others skip. Robust but adds complexity.
- *Random startup delay*: Each extension waits 0-500ms before checking. Cheap but not deterministic.

**Rationale:** The failure mode is harmless — extra spawn attempts fail immediately, the retry loop connects to whichever instance succeeded. Zero additional code needed.

## Risks / Trade-offs

**[Risk: Server spawn fails silently]** → If the server can't start (bad config, missing dependency), the extension just retries connecting forever. Mitigation: Log the spawn attempt result. If the process exits immediately (within 2s), show a warning via `ctx.ui.notify()`.

**[Risk: Config file permissions]** → Auto-creating `~/.pi/dashboard/config.json` could fail if the directory doesn't exist or permissions are wrong. Mitigation: `ensureConfig()` creates the directory recursively with `{ recursive: true }`.

**[Trade-off: No config hot-reload]** → Changing `config.json` requires restarting the server and reconnecting the extension. Acceptable for a config that rarely changes.

**[Trade-off: TCP probe adds ~10ms to session_start]** → Negligible compared to pi's overall startup time.
