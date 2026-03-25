## Context

The dashboard can spawn pi sessions via tmux using `process-manager.ts`. Sessions communicate with the dashboard through the bridge extension (WebSocket). The bridge extension loads in all pi modes including `--mode rpc`.

`pi --mode rpc` runs headless with a JSONL stdin/stdout protocol. It loads extensions (including the bridge), supports `prompt`, `abort`, `set_model`, `set_thinking_level`, and all other RPC commands. This makes it ideal for browser-driven sessions.

Currently, prompts flow: Browser → Server → Bridge WS → pi TUI. In headless mode, the same flow works because the bridge extension receives `send_prompt` commands and the RPC session processes them identically.

## Goals / Non-Goals

**Goals:**
- Add configurable `spawnStrategy` (`"tmux"` | `"headless"`) to dashboard config
- Spawn headless pi sessions as child processes using `pi --mode rpc`
- Add `spawn_session` / `spawn_result` browser protocol messages
- Add a `+` button on folder card group headers to spawn sessions
- Track headless child processes and clean up on server shutdown

**Non-Goals:**
- Direct stdin/stdout RPC pipe from server to headless pi (future enhancement)
- Driving model switching, compaction, etc. from dashboard (uses existing bridge WS)
- Supporting arbitrary folder selection (only existing folder groups)

## Decisions

### D1: Communication via Bridge WS (Option A)
Headless sessions communicate with the dashboard through the bridge extension WebSocket, same as tmux sessions. The server does NOT pipe stdin/stdout to the RPC process. This keeps the change minimal — only the spawn mechanism differs.

**Rationale:** The bridge extension already handles `send_prompt`, `abort`, event forwarding, git info, openspec polling, etc. Reusing it avoids duplicating all that logic.

### D2: Child process management
The server holds references to spawned headless child processes in a `Map<pid, ChildProcess>`. On server shutdown (SIGTERM/SIGINT), it sends SIGTERM to all tracked children. When a child exits, it's removed from the map.

**Rationale:** Headless processes have no terminal — if the server dies without cleanup, orphaned pi processes would run forever.

### D3: Spawn strategy as config field
`spawnStrategy` is a config field in `~/.pi/dashboard/config.json`, defaulting to `"tmux"` for backward compatibility. Both strategies use the same `spawnPiSession` entry point.

### D4: Spawn button on folder card header
A `+` icon button on the folder card group header (next to editor buttons). Clicking sends `spawn_session` with the group's `cwd`. The server spawns using the configured strategy and returns `spawn_result`. Success/failure shown as a toast.

### D5: Source detection
Headless sessions set `PI_DASHBOARD_SPAWNED=1` in their environment, same as tmux. The bridge extension detects this and reports `source: "dashboard"`. No change needed to source detection.

## Risks / Trade-offs

- **Headless sessions have no direct terminal access** — Users can only interact via dashboard `send_prompt`. If the dashboard server crashes, headless sessions become orphaned (mitigated by D2 cleanup).
- **No stdin pipe means no advanced RPC control** — Model switching, thinking level, compaction must go through existing bridge WS commands. This is acceptable for v1.
- **Config change requires server restart** — Switching `spawnStrategy` takes effect on next spawn, no hot-reload needed since config is read per-spawn.
