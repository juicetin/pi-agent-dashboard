## Context

When the dashboard spawns a headless pi session, the server tracks the child process in a `headlessProcesses` map keyed by PID. When the user clicks X to close that session, the browser sends a `shutdown` message. The server's browser-gateway forwards this to the extension via `piGateway.sendToSession()`. If the extension bridge isn't connected (or hasn't registered yet), `sendToSession()` returns `false` and the shutdown is silently dropped — the process keeps running.

The core gap: there's no mapping from session ID to PID, and no fallback kill path.

## Goals / Non-Goals

**Goals:**
- Spawned headless sessions can be reliably shut down via the X button
- Fallback to SIGTERM when the extension bridge can't deliver the shutdown message
- Clean mapping lifecycle — entries are added on spawn/register, removed on exit

**Non-Goals:**
- Tmux session kill support (tmux sessions are managed by tmux, not by the server)
- Retry logic or graceful degradation UI (keep it simple — kill works or it doesn't)
- Changing the extension-side shutdown handling

## Decisions

### 1. Two-phase PID↔sessionId mapping in browser-gateway

**Decision**: Track `pid → cwd` at spawn time in the existing `headlessProcesses` context, then resolve to `pid → sessionId` when the session registers in pi-gateway.

**Rationale**: At spawn time we don't know the session ID yet (it's assigned by the pi instance). We do know the `cwd`. When a session registers via pi-gateway, we can match by cwd to link the PID.

**Alternative considered**: Pass a pre-generated session ID to the spawned process via env var. Rejected — would require changes to pi's core session ID generation and the extension protocol.

**Implementation**: Add a `HeadlessPidRegistry` (simple class/object) shared between browser-gateway and pi-gateway:
- `register(pid: number, cwd: string, process: ChildProcess)` — called at spawn time
- `linkSession(sessionId: string, cwd: string)` — called when a session connects; matches by cwd
- `getPid(sessionId: string): number | undefined` — lookup for shutdown fallback
- `remove(pid: number)` — called on process exit
- `killBySessionId(sessionId: string): boolean` — SIGTERM by session ID
- Internal cleanup on process exit events

### 2. Fallback kill in shutdown handler

**Decision**: In the `shutdown` case of browser-gateway's message handler, check the return value of `piGateway.sendToSession()`. If `false`, attempt `registry.killBySessionId(sessionId)`.

**Rationale**: Simplest possible fix — one extra line in the existing switch case. No new protocol messages needed.

### 3. Registry lives in browser-gateway, exposed to pi-gateway via callback

**Decision**: The registry is created in `createBrowserGateway` and a `linkSession` callback is passed to `createPiGateway` (or the session manager) so it can be called when sessions register.

**Alternative considered**: Put registry in a separate module imported by both. Rejected — adds a new module for ~30 lines of code. Passing a callback keeps it simpler.

## Risks / Trade-offs

- **[Risk] CWD matching is imprecise** — If two headless sessions are spawned in the same directory before either registers, the wrong PID could be linked. → Mitigation: Use FIFO matching (oldest unlinked spawn for that cwd gets linked first). This is an edge case unlikely in practice.
- **[Risk] Race between process exit and session register** — Process might exit before the bridge connects. → Mitigation: The `remove(pid)` cleanup on exit handles this; `getPid()` returns `undefined` and no kill is attempted (process already gone).
- **[Trade-off] No feedback to browser** — If both sendToSession and kill fail, the browser gets no error. Acceptable for now — the session will eventually show as "ended" when the process exits.
