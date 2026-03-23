## Why

The bridge extension runs in-process with the pi agent. When the dashboard server dies (killed, crashed, restarted), unhandled exceptions from the WebSocket can propagate and crash the entire pi agent process. The `ConnectionManager` has reconnection logic but lacks try/catch guards around two critical paths: `WebSocket.send()` and the `new WebSocket()` constructor.

## What Changes

- **Wrap `ws.send()` in try/catch** in `ConnectionManager.send()` — if send throws (connection dying mid-call), buffer the message instead of letting the exception propagate.
- **Wrap `new WebSocket(url)` in try/catch** in `ConnectionManager.createConnection()` — if the constructor throws, schedule a reconnect instead of crashing.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `bridge-extension`: ConnectionManager must not throw unhandled exceptions when the dashboard server is unavailable or dies during operation

## Impact

- `src/extension/connection.ts` — add try/catch guards around `this.ws.send()` and `new this.WS(this.url)`
- Two surgical changes, no protocol or API modifications
