## 1. Sleep-Aware Heartbeat

- [x] 1.1 Add `heartbeatSetAt` timestamp and `sleepRetried` flag per session in pi-gateway's `resetHeartbeat`
- [x] 1.2 In heartbeat timeout callback, detect sleep (elapsed > 2× timeout) and retry once before unregistering
- [x] 1.3 Write unit tests: normal timeout unregisters, sleep-detected timeout retries once, second timeout after retry unregisters

## 2. Sleep-Resilient Auto-Shutdown

- [x] 2.1 Add `lastConnectionTimestamp` tracking in server.ts (updated on `piGateway.onConnection`)
- [x] 2.2 Add `connectionCount()` method to pi-gateway interface
- [x] 2.3 Modify idle timer callback to verify `connectionCount() === 0` and real elapsed time >= `shutdownIdleSeconds` before exiting; restart timer if checks fail
- [x] 2.4 Write unit tests: idle timer restarts when connections exist, idle timer restarts when real time insufficient, idle timer exits when truly idle

## 3. Headless PID Persistence

- [x] 3.1 Add `persist()` and `loadFromDisk()` methods to `HeadlessPidRegistry` using `~/.pi/dashboard/headless-pids.json`
- [x] 3.2 Call `persist()` in `register()` and `remove()` methods
- [x] 3.3 Write unit tests for persistence: save, load, atomic write

## 4. Orphan Cleanup on Startup

- [x] 4.1 Add `cleanupOrphans()` method to registry: read PID file, check alive, reclaim or kill
- [x] 4.2 Call `cleanupOrphans()` on server startup in `server.ts`
- [x] 4.3 Write unit tests: alive PID reclaimed, dead PID removed, old PID (>7 days) killed
