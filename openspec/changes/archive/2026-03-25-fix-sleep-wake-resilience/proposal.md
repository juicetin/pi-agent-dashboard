## Why

When a laptop sleeps and wakes, all Node.js timers fire instantly with their accumulated delays. The server's 45s heartbeat timeout unregisters all sessions immediately, the `onEmpty` callback starts the idle timer, and if sleep exceeded ~345s the idle timer also fires instantly — the server exits via `process.exit(0)`. This kills all headless agents. When the extension auto-starts a new server, the old headless processes aren't tracked — they become orphans consuming resources indefinitely.

## What Changes

- **Sleep-resilient auto-shutdown**: Before exiting, the idle timer SHALL verify no pi sessions have reconnected and that real wall-clock time has passed since the last connection, preventing false shutdowns caused by frozen timers firing on wake
- **Sleep-aware heartbeat**: The heartbeat timeout SHALL detect sleep/wake by comparing elapsed real time, and give a grace period for extensions to reconnect rather than immediately unregistering sessions
- **Headless orphan cleanup**: The server SHALL persist headless PIDs to a file on disk so a restarted server can reclaim or kill orphaned processes from a previous instance

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-shutdown`: Idle timer SHALL verify real elapsed time and active session state before shutting down, preventing false shutdown on wake
- `headless-spawn`: Server SHALL persist headless PIDs to disk and clean up orphans from previous server instances on startup

## Impact

- `src/server/pi-gateway.ts` — heartbeat timeout gets sleep detection (compare `Date.now()` before/after)
- `src/server/server.ts` — idle timer verifies real time + session state before exit; startup cleans orphan PIDs
- `src/server/headless-pid-registry.ts` — add disk persistence (JSON file) and orphan cleanup on init
- `src/shared/config.ts` — no changes (existing `shutdownIdleSeconds` config is reused)
- No protocol or client changes
