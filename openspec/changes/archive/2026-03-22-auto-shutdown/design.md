## Context

The dashboard server runs as a detached process auto-launched by bridge extensions. Currently it runs indefinitely. The bridge already handles auto-start via `server-launcher.ts` + `server-probe.ts`, so adding auto-shutdown creates a complete lifecycle: start on demand → run while needed → stop when idle → restart on demand.

The Pi Gateway tracks live WebSocket connections in a `connections: Map<sessionId, WebSocket>`. This is the ground truth for "are any pi sessions connected" — more reliable than session manager state since it reflects actual network connections.

## Goals / Non-Goals

**Goals:**
- Server shuts down gracefully after a configurable idle period when no pi WebSocket connections exist
- Browser client shows distinct "offline" vs "connecting" states
- Feature is opt-in via config with default enabled

**Non-Goals:**
- Browser connections do not affect shutdown decision
- No server-side notification to browsers before shutdown (they detect via WebSocket close)
- No changes to the bridge extension (auto-start already works)

## Decisions

### 1. Connection count callbacks on Pi Gateway
**Rationale**: The Pi Gateway owns the `connections` Map. Rather than exposing internals, it emits two callbacks: `onEmpty()` (connections hit 0) and `onConnection()` (new connection arrives). The server wires these to start/cancel the idle timer.
**Alternative**: Poll `connections.size` on an interval — wasteful and less responsive.

### 2. Idle timer lives in server.ts
**Rationale**: The server orchestrates all components and owns `start()`/`stop()`. It's the natural place for shutdown logic. The timer starts when Pi Gateway reports empty, cancels when a new connection arrives, and calls `stop()` + `process.exit(0)` on expiry.
**Alternative**: Timer inside Pi Gateway — but gateway shouldn't own server lifecycle.

### 3. Browser status: "connected" | "connecting" | "offline"
**Rationale**: Current states (`connected | reconnecting | disconnected`) conflate "first connect" with "reconnecting" and have an unused `disconnected` state. New states:
- `"connecting"` — actively attempting to connect (covers both initial and reconnect)
- `"connected"` — WebSocket is open
- `"offline"` — multiple consecutive connection failures (server is down)

Threshold: transition to `"offline"` after 3 consecutive failures. Keeps retrying in background with exponential backoff.

### 4. Config uses seconds (not milliseconds)
**Rationale**: Human-readable config file. `shutdownIdleSeconds: 300` is clearer than `shutdownIdleTimeout: 300000`. Converted to ms internally.

## Risks / Trade-offs

- **Race condition on shutdown** → A new pi session could try to connect during the shutdown grace period. Mitigation: The bridge's `server-probe.ts` will detect the server is down and re-launch it. The 5-minute default timeout makes this window very unlikely.
- **Config migration** → Existing config files won't have the new fields. Mitigation: `loadConfig()` already merges with defaults, so missing fields get default values automatically.
- **Process.exit()** → Calling `process.exit(0)` after `stop()` is intentional — the server is a detached process with no parent watching it. Graceful stop cleans up DB/sockets first.
