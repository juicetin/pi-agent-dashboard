## Why

Dashboard-initiated `/reload` (used by `npm run reload` and the dashboard's reload button) silently fails on headless-spawned pi sessions. The bridge extension can only call `session.reload()` by capturing `ExtensionCommandContext.reload` from a command handler, which requires a human to first invoke `/__dashboard_reload` in pi's TUI. Headless sessions have no TUI, so the bootstrap never happens and reload is unreachable.

Empirical verification against pi 0.68.0 confirmed:
- `ExtensionContext` (delivered to `session_start` handlers) has no `reload` field at runtime
- pi's RPC protocol has no `{type: "reload"}` command (`Unknown command: reload`)
- `pi --session <file>` cleanly resumes a persisted session in a fresh process (same `sessionId`, same entries)

## What Changes

- The dashboard **server** SHALL intercept `send_prompt` messages whose text equals `/reload` when the target session is headless (tracked in `headlessPidRegistry`), and perform a kill-and-respawn instead of forwarding the prompt to the bridge.
- The kill-and-respawn SHALL use the existing `headlessPidRegistry.killBySessionId` + `spawnPiSession({sessionFile, mode: "continue", strategy: "headless"})` primitives, mirroring the pattern already used by `auto-resume-on-prompt` for ended sessions.
- For non-headless sessions (tmux / Windows Terminal / WSL-tmux), the existing bridge-based `/reload` path SHALL remain unchanged.
- A user-visible confirmation event SHALL be emitted so the dashboard chat shows that the reload was acknowledged (parity with the existing `command_feedback` the bridge emits for `/reload` on non-headless sessions).

## Capabilities

### New Capabilities
- `headless-reload`: Server-side handling of `/reload` for headless-spawned pi sessions via kill-and-respawn, producing the same visible outcome as in-process `session.reload()` (fresh settings, fresh extensions, fresh skills/prompts/themes).

### Modified Capabilities
_None. The existing `auto-resume-on-prompt` capability is reused structurally but its spec is not modified — the new trigger (`text === "/reload"` on an active headless session) is orthogonal to its trigger (`status === "ended"`)._

## Impact

- **Affected code**:
  - `packages/server/src/browser-handlers/session-action-handler.ts` — new early branch in `handleSendPrompt`
  - `packages/server/src/browser-handlers/__tests__/` — new unit test
- **Protocols**: none changed. Bridge protocol, RPC protocol, and pi extension API are untouched.
- **pi-coding-agent**: no upstream changes required.
- **User-visible behavior**:
  - Headless session’s underlying pi process PID changes on every `/reload` (documented).
  - Brief gap (~1–3s) where the session status transitions `active → ended → active` while the bridge reconnects; the web UI already renders this gracefully via `auto-resume-on-prompt`’s pattern.
  - Accumulated session state (tokens, cost, context usage, attached proposal) is preserved because `memorySessionManager.register` already carries it over when the same `sessionId` re-registers.
- **Non-goals**:
  - In-process reload for headless sessions (requires upstream pi-coding-agent changes — out of scope).
  - Removing the `globalThis[RELOAD_KEY]` bootstrap workaround used by tmux/TUI sessions (still functional, left alone).
