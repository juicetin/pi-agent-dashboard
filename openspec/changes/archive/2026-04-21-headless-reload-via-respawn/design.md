## Context

The dashboard ships a bridge extension loaded inside every pi session. When the user triggers a reload from the web UI, the server sends `send_prompt` with text `/reload`. The bridge's `command-handler.ts` parses this into `{type: "reload"}` and calls a captured `reload` function stored in `globalThis[RELOAD_KEY]`.

That captured function is only populated when a human invokes `/__dashboard_reload` in pi's TUI, because `reload()` is only exposed on `ExtensionCommandContext` (given to extension command handlers), never on the plain `ExtensionContext` delivered to event handlers. This was confirmed empirically against pi 0.68.0 by:

1. Registering a probe extension that dumps `Object.keys(ctx)` in `session_start` → no `reload` field.
2. Enumerating the `pi` extension-API surface → no `invokeCommand` or reload entry point.
3. Sending `{type:"reload"}` over the RPC stdin → `Unknown command: reload`.

Headless-spawned sessions (`pi --mode rpc`, launched by `spawnPiSession` when strategy is `headless`) have no TUI, so the bootstrap step is unreachable. The user-visible symptom is that `npm run reload` appears to succeed but the headless sessions continue running the old extension code.

Two independent test runs confirmed the workaround works end-to-end:
- `pi --session <existing-file>` re-hydrates the same `sessionId` and entry list.
- `sessionManager.register(...)` in `memory-session-manager.ts` already carries over tokens, cost, context usage, and attached proposal when the same sessionId re-registers.

## Goals / Non-Goals

**Goals:**
- `/reload` from the dashboard produces a reload-equivalent outcome on headless sessions (fresh settings.json, fresh extensions, fresh skills/prompts/themes).
- Reuse existing primitives (`headlessPidRegistry`, `spawnPiSession`, `memorySessionManager.register`) — do not introduce new infrastructure.
- Leave the existing `globalThis[RELOAD_KEY]` bootstrap path intact for tmux / Windows Terminal / WSL-tmux sessions.
- Preserve accumulated per-session UI state (tokens, cost, context usage, `attachedProposal`) across the respawn.
- Confirm the reload back to the user via a `command_feedback` event so the chat shows "/reload — completed" parity with the non-headless path.

**Non-Goals:**
- In-process reload for headless sessions. That would require pi-coding-agent to add either `reload()` to `ExtensionContext` or a `{type:"reload"}` RPC command. We file a tracking issue but do not block on it.
- Removing the `__dashboard_reload` TUI bootstrap. Still used by non-headless sessions.
- Prompt queueing during reload. Unlike `auto-resume-on-prompt`, there is no user prompt to redeliver — `/reload` itself is the payload.

## Decisions

### D1. Server-side interception in `handleSendPrompt`
Detect `msg.text === "/reload"` AND `headlessPidRegistry.getPid(msg.sessionId) !== undefined` before the existing ended-session branch and before the bridge-forward branch.

*Alternative considered:* Route via a new dedicated message type like `{type: "reload_session"}`. Rejected because:
- The web UI already speaks `send_prompt` to all sessions uniformly via `npm run reload`.
- Changing the UI to know about headless vs non-headless couples the client to process-spawn details.
- A server-side interception is invisible to every existing client including `scripts/reload-all.sh`.

### D2. Kill-then-respawn (not re-exec-in-place)
Send SIGTERM via `headlessPidRegistry.killBySessionId`, wait briefly for the process to exit, then call `spawnPiSession(cwd, {sessionFile, mode: "continue", strategy: "headless"})`.

The wait is needed because pi flushes session entries on shutdown and holds an exclusive handle on the sessions directory in some file systems. The `auto-resume-on-prompt` flow already assumes process exit before spawn; we follow its ordering.

*Alternative considered:* Let the new process race the old one. Rejected — the session file is append-only and two writers would corrupt it.

### D3. No prompt queueing
Unlike `auto-resume-on-prompt` which uses `pendingResumeRegistry` to deliver the user's prompt after respawn, `/reload` carries no follow-up payload. The new path SHALL NOT touch `pendingResumeRegistry`.

### D4. Gate on `headlessPidRegistry.getPid`, not on session metadata
The registry is the source of truth for "is this session headless right now?" because:
- tmux sessions never get registered there.
- A previously-headless session that has ended and is being re-resumed still has its PID tracked until cleanup.
- Using the registry avoids adding a new `spawnStrategy` field to `DashboardSession`.

### D5. Success signal: `command_feedback` via bridge after reconnect
The non-headless `/reload` path emits `command_feedback {command: "/reload", status: "completed"}` via `eventSink` from within the bridge. For the respawn path, the new bridge instance in the respawned pi process SHALL emit the same event on the next `session_start` if and only if the start reason indicates it was a respawn-for-reload. Simpler alternative: the server emits the `command_feedback` itself immediately after a successful `spawnPiSession` call, since the outcome is known at that point. **Choose the simpler alternative** — the server already broadcasts session lifecycle events; users see a short `ended → active` flicker which communicates the reload.

*Alternative considered:* Suppress the flicker by marking the session `resuming: true` during the gap (mirroring `auto-resume-on-prompt`). Worth adding for UI polish but not strictly required; include as a sub-task.

### D6. Error fallthrough
If `spawnPiSession` fails after the SIGTERM, the session stays `ended` and an error event is broadcast. This matches the existing ended-session resume failure mode and avoids a new state machine.

## Risks / Trade-offs

- **PID churn**: every `/reload` changes the pi PID. Mitigation: `headlessPidRegistry` already handles register-on-spawn and cleanup-on-exit; no consumers depend on PID stability.

- **Session flush-to-disk window**: pi only persists session entries after the first assistant message. Reloading a brand-new headless session that hasn't produced any assistant output would lose setup state (e.g., `set_session_name`). Mitigation: accept this edge case — headless sessions typically exist because someone is mid-conversation. Document in spec scenarios.

- **SIGTERM timing**: if pi is streaming when SIGTERM arrives, the pending assistant chunk may be lost from the session file. Mitigation: `/reload` is a user-initiated action and already has this property in the non-headless path (pi's own `/reload` handler shows a warning "Wait for current response to finish"). We match that check by returning an error when `session.status === "streaming"`.

- **Race: dashboard sends `/reload` while session is mid-auto-resume**: the session is briefly `status === "ended"` during auto-resume. Our check gates on headlessPidRegistry (which still has an entry), so we'd attempt to kill a PID that is no longer running, then spawn. Mitigation: `killBySessionId` is a no-op if the PID is already dead; the subsequent spawn succeeds normally. Net outcome: correct.

- **Windows spawn mechanics differ**: `spawnPiSession` with `strategy: "headless"` on Windows uses `spawnHeadlessDetached`. Tested during prior spawn-strategy work — respawn is expected to behave identically. Add a platform-guarded test.

- **pi-coding-agent upstream drift**: if a future pi version adds `reload()` to `ExtensionContext` or a `{type:"reload"}` RPC command, the server-side respawn becomes redundant but still correct. Low-cost forward compatibility.

## Migration Plan

No migration required. The change is additive on the server and invisible to clients. Rollback is a single-commit revert.

## Upstream follow-up

A pi-coding-agent enhancement request SHOULD be filed proposing one of:

- **Option A**: Expose `reload()` on `ExtensionContext` (not just `ExtensionCommandContext`). This lets extensions call `ctx.reload()` directly from any event handler, eliminating the `globalThis[RELOAD_KEY]` bootstrap dance entirely.
- **Option B**: Add a `{ type: "reload" }` RPC command to `pi --mode rpc`, analogous to existing commands like `abort`, `compact`, etc. The server could then write the command to stdin without any process-lifecycle management.

Either would make the server-side kill-and-respawn workaround obsolete. Track the issue at (TODO: file and link) and retire this workaround once upstream lands.

Until then, the server-side respawn is a complete, correct, and self-contained solution.
