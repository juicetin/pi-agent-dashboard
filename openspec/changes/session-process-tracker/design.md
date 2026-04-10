## Context

Pi's bash tool spawns commands via `spawn(shell, [...args, command], { detached: true })`. The `detached: true` flag creates a new process group, so children survive if the parent pi session exits or the tool is aborted. Currently there is no mechanism to discover or manage these child processes from the dashboard.

The bridge extension already runs periodic polling (heartbeat every 10s, git info every 30s) and forwards events to the server. The same pattern applies here.

On Unix, every bash tool child has `PPID = process.pid` (the pi session's Node.js PID) while the session is alive. This gives us a reliable, zero-false-positive detection mechanism using `pgrep -P`.

## Goals / Non-Goals

**Goals:**
- Show active child processes per session in the dashboard session card
- Allow users to kill stalled processes via a button in the UI
- Filter out short-lived processes (< 30s) to reduce noise
- Work on macOS and Linux

**Non-Goals:**
- Windows support (graceful no-op; can be added later)
- Orphan detection after session death (requires PID sidecar persistence; future work)
- Tracking pi-flows subagents (they're in-process, not child processes)
- Automatic killing of stalled processes (user-initiated only)

## Decisions

### 1. Detection via `pgrep -P` + `ps` (not process tree walking or /proc)

**Choice**: Use `pgrep -P {pid}` to find direct children, then recurse one level to find grandchildren too, then `ps -p {pids} -o pid,pgid,etime,args` for details. Display uses the `ps` args output (actual running binary), not the original bash command.

**Why**: 
- `pgrep` is available on both macOS and Linux
- PPID matching is 100% accurate — only processes spawned by this pi session match
- No risk of false positives (unlike command-string matching)
- Grandchild scan catches cases where bash exits but node/vitest survives (reparented to PID 1 won't be caught, but while bash is alive we see the full tree)
- `ps` args shows the actual binary consuming resources, more useful than the original command for identifying stalled processes
- Lightweight: a few `spawnSync` calls, no dependencies

**Alternatives considered**:
- `/proc` filesystem: Linux only, not available on macOS
- `ps -eo` with awk filtering: Works but more parsing, same data
- Tracking PIDs at spawn time via BashSpawnHook: Hook runs before spawn, no PID available; would need to wrap BashOperations which requires pi core changes
- Direct children only: misses grandchildren like vitest spawned by npm

### 2. Poll interval: 10 seconds, piggybacked near heartbeat

**Choice**: Run process scan every 10s using its own `setInterval`, same pattern as heartbeat and git polling.

**Why**:
- 10s is responsive enough to notice stalled processes
- Matches heartbeat cadence (also 10s)
- Independent timer avoids coupling to heartbeat logic
- Sends `process_list` event only when the list changes (diffed against previous)

### 3. Elapsed time filter: 30 seconds minimum

**Choice**: Only report processes with elapsed time ≥ 30 seconds.

**Why**:
- Normal bash tool calls (grep, ls, cat, build steps) complete in < 30s
- The currently-running tool call is already shown as "Running: Bash" in the UI
- 30s avoids cluttering the card with transient commands
- Parsed from `ps` ETIME field (format: `[[dd-]hh:]mm:ss`)

### 4. Kill via process group (PGID), not individual PID

**Choice**: Send PGID to bridge, bridge calls `process.kill(-pgid, SIGTERM)`.

**Why**:
- Pi's bash tool spawns with `detached: true` → each command gets its own PGID
- Killing the PGID kills the entire tree (e.g., `npm test` → `node` → `vitest`)
- Matches pi core's existing `killProcessTree()` pattern
- SIGTERM first (graceful); the UI can show if the process persists after kill

### 5. Protocol: new event type on extension→server, new message on server→browser

**Choice**: 
- Extension→Server: `process_list` message (similar to `session_heartbeat`)
- Server→Browser: `process_list_update` included in existing session update flow
- Browser→Server→Extension: `kill_process` message with sessionId + pgid

**Why**:
- Follows established patterns (heartbeat sends metrics, git sends branch info)
- `process_list` only sent when list changes (not every poll)
- Kill uses existing server→extension message routing

### 6. UI: inline in session card, below status

**Choice**: Small process list at the bottom of the session card (after everything else), each entry showing command from `ps` args (truncated), elapsed time, and a red ✕ button.

**Why**:
- Bottom placement keeps it out of the way — processes are secondary info
- Only appears when there are active processes (zero UI noise when empty)
- Red ✕ follows existing destructive-action patterns in the UI

## Risks / Trade-offs

- **[Shell command overhead]** → Two `spawnSync` calls every 10s per session. Minimal: `pgrep` and `ps` are < 5ms each. Only runs on Unix.
- **[Race condition on kill]** → Process may exit between scan and kill click. Mitigation: `process.kill` with try/catch, silently ignore ESRCH.
- **[PPID=1 after session death]** → If pi session crashes, children become orphans with PPID=1 and we lose the link. Mitigation: out of scope for v1; future work could persist PGIDs to a sidecar file.
- **[No Windows support]** → Windows users won't see process tracking. Mitigation: platform guard returns empty list; no errors or broken UI.
