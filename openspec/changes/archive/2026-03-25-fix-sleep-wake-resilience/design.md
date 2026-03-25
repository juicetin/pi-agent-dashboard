## Context

Node.js `setTimeout`/`setInterval` are wall-clock based. When a laptop sleeps for N seconds, on wake all pending timers with elapsed deadlines fire immediately and synchronously. This causes a cascade:

1. **Heartbeat timeout (45s)** in pi-gateway fires → unregisters all sessions → `connections.size === 0`
2. **`onEmpty()` callback** fires → starts idle timer
3. **Idle timer (300s)** may also fire instantly if sleep > 345s → `process.exit(0)`
4. **`server.stop()`** kills headless processes and terminates WebSocket connections
5. Extensions reconnect, auto-start a new server — but old headless PIDs are lost → orphans

## Goals / Non-Goals

**Goals:**
- Server survives laptop sleep/wake without false auto-shutdown
- Headless agents survive server restarts (no orphans)
- Minimal code changes — work with existing timer-based architecture

**Non-Goals:**
- Replacing the timer-based architecture with a polling approach
- Handling network-level disconnects differently from sleep (the reconnect backoff already handles this)
- Persisting tmux session PIDs (tmux manages its own process lifecycle)

## Decisions

### 1. Sleep detection via timestamp comparison

**Decision**: Record `lastConnectionTimestamp` (set to `Date.now()` on every `onConnection` callback). Before the idle timer exits, check: `Date.now() - lastConnectionTimestamp < shutdownIdleSeconds * 1000`. If the condition fails (connections were recent), restart the idle timer instead of exiting.

**Rationale**: Simple, no new dependencies. The timer fires, but we verify the precondition before acting. This handles the case where timers accumulated during sleep fire instantly but extensions reconnect within seconds.

**Alternative considered**: Use `process.hrtime()` or monotonic clock. Rejected — `Date.now()` is sufficient since we're comparing against wall-clock idle periods, and sleep pauses both clocks equally.

### 2. Heartbeat grace period after sleep

**Decision**: In the heartbeat timeout callback, before unregistering a session, check if the elapsed real time since the timer was set is significantly longer than expected (e.g., `elapsed > HEARTBEAT_TIMEOUT * 2`). If so, reset the heartbeat timer instead of unregistering — the extension will reconnect shortly.

**Implementation**: Store `heartbeatSetAt` timestamp per session. When the timeout fires, compare `Date.now() - heartbeatSetAt`. If it's much larger than `HEARTBEAT_TIMEOUT` (indicating sleep), give a fresh timeout window.

**Rationale**: During sleep, `setTimeout(fn, 45000)` might fire after 8 hours of wall time. The extension is still alive — it just couldn't send heartbeats while the OS was suspended. Giving one retry window lets it reconnect.

### 3. Headless PID persistence to disk

**Decision**: Extend `HeadlessPidRegistry` to persist entries to `~/.pi/dashboard/headless-pids.json`. On startup, the server reads this file, checks which PIDs are still alive (`process.kill(pid, 0)`), and either reclaims them into the registry or kills them as orphans.

**Format**: `{ entries: [{ pid, cwd, spawnedAt }] }` — no sessionId (lost on restart).

**Lifecycle**:
- Write on `register()` and `remove()`
- Read on server startup → kill orphans or reclaim
- Use the existing `JsonStore` pattern for atomic writes

**Alternative considered**: Use a PID file per process. Rejected — multiple files to manage, harder to clean up atomically.

### 4. Idle timer double-check before exit

**Decision**: The idle timer callback SHALL call a `shouldShutdown()` function that verifies:
1. `piGateway.connectionCount() === 0` (no active connections right now)
2. `Date.now() - lastConnectionTimestamp >= shutdownIdleSeconds * 1000` (truly idle for the required period)

If either check fails, restart the idle timer instead of exiting.

**Rationale**: Belt-and-suspenders. Even if the heartbeat grace period fails, the idle timer won't pull the trigger if sessions reconnected.

## Risks / Trade-offs

- **[Risk] PID reuse by OS** — A stale PID in the file could match a different process after reboot. → Mitigation: Check process name/command before killing, or accept that `process.kill(pid, 0)` only checks existence. On macOS, PID reuse is rare for short periods. We can add a `spawnedAt` timestamp and skip PIDs older than `retentionDays`.
- **[Risk] JSON file corruption on crash** — Server crashes mid-write. → Mitigation: Use atomic write (write to temp, rename) via existing `JsonStore` helper.
- **[Trade-off] One extra heartbeat cycle delay** — After wake, sessions stay registered for one extra 45s window. Acceptable — better than false unregistration.
