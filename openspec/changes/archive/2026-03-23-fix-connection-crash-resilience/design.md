## Context

The `ConnectionManager` in `src/extension/connection.ts` manages the WebSocket connection between the bridge extension (running in-process with pi) and the dashboard server (separate process). It has exponential backoff reconnection but lacks exception guards around two operations that can throw when the server dies: `WebSocket.send()` and the `new WebSocket()` constructor.

## Goals / Non-Goals

**Goals:**
- Prevent unhandled exceptions from crashing the pi agent when the dashboard server dies
- Maintain existing reconnection behavior

**Non-Goals:**
- Changing the reconnection strategy or backoff timing
- Adding error reporting/logging infrastructure
- Handling server-side crash recovery

## Decisions

### 1. Wrap `ws.send()` in try/catch
**Decision**: In `ConnectionManager.send()`, wrap `this.ws.send(data)` in a try/catch. On failure, push the message to the buffer (same as when `readyState !== OPEN`).
**Rationale**: There's a race between the `readyState` check and the actual send — the connection can transition to CLOSING between the two. The heartbeat timer and event forwarding both call `send()` from contexts where an unhandled throw propagates to the process level.

### 2. Wrap `new WebSocket(url)` in try/catch
**Decision**: In `ConnectionManager.createConnection()`, wrap `new this.WS(this.url)` in a try/catch. On failure, schedule a reconnect (reuse existing `scheduleReconnect()`).
**Rationale**: The constructor is called from `scheduleReconnect()` via `setTimeout`. An unhandled throw in a timer callback becomes an uncaught exception that crashes Node.js.

## Risks / Trade-offs

- **[Silent failures]** → Errors are silently caught and retried. Acceptable — the reconnection loop already handles this pattern, and the extension is a monitoring addon that should never impact the host agent.
