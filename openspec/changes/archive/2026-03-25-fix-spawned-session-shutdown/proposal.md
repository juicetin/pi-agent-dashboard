## Why

Clicking the X (close) button on a spawned dashboard agent does nothing. The server forwards the `shutdown` message to the bridge extension via `piGateway.sendToSession()`, but has no fallback when the extension isn't connected or the message fails to deliver. For headless processes, the server tracks PIDs in a `headlessProcesses` map but the shutdown handler never uses it — and there's no mapping from session ID to PID.

## What Changes

- Add a `sessionId → pid` mapping so the server can correlate spawned sessions with their OS processes
- Add fallback kill logic in the `shutdown` handler: if `sendToSession()` returns `false`, fall back to `process.kill(pid, "SIGTERM")` for headless processes
- Clean up the mapping when sessions disconnect or processes exit

## Capabilities

### New Capabilities

_(none — this is a bug fix within existing capabilities)_

### Modified Capabilities

- `headless-spawn`: Add requirement that the server SHALL maintain a sessionId↔PID mapping for headless processes, and SHALL fall back to SIGTERM when the extension shutdown message cannot be delivered
- `process-manager`: SpawnResult already includes `pid`; no spec change needed

## Impact

- `src/server/browser-gateway.ts` — shutdown handler gets fallback logic; spawn handler registers PID↔sessionId mapping
- `src/server/pi-gateway.ts` — session registration links incoming session ID to known PIDs (by matching cwd or timing)
- `src/shared/browser-protocol.ts` / `src/shared/protocol.ts` — no changes expected
- No breaking changes; purely additive server-side fix
