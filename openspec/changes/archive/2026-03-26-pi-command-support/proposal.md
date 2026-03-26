## Why

The dashboard sends all user input via `pi.sendUserMessage()` which bypasses pi's internal command processing. Users cannot run shell commands (`!`/`!!`), trigger compaction (`/compact`), or invoke extension/skill slash commands from the dashboard. This forces users to switch back to the pi terminal for basic operations.

## What Changes

- Add command routing in the bridge extension's `send_prompt` handler to detect and dispatch `!command`, `!!command`, `/compact`, and extension slash commands before falling back to `sendUserMessage()`
- Register a hidden `__dashboard` command in the bridge extension to capture `ExtensionCommandContext`, enabling session control operations (`newSession`, `fork`, `reload`, etc.)
- Add new protocol messages for bash execution results (`bash_result`) and command execution feedback (`command_result`) so the dashboard can display output from `!`/`!!` commands and command status
- Add client-side UI for bash output display and command feedback in the chat view
- Add a `terminal` session type stub in the shared types for future terminal session support

## Capabilities

### New Capabilities
- `command-routing`: Extension-side parsing and dispatch of pi internal commands (`!`, `!!`, `/compact`, slash commands) from dashboard input
- `bash-execution`: Running shell commands from the dashboard via `!command` (output sent to LLM) and `!!command` (silent execution), with output forwarded to the browser
- `dashboard-command-context`: Hidden command registration pattern to obtain `ExtensionCommandContext` for session control operations from the dashboard

### Modified Capabilities
- `shared-protocol`: New message types for bash execution results and command feedback between extension↔server↔browser
- `bridge-extension`: Command handler gains prefix detection and routing logic instead of always calling `sendUserMessage()`
- `chat-view`: Display bash execution output and command feedback in the message stream

## Impact

- `src/extension/command-handler.ts` — Major changes: prefix parsing, bash execution, compact dispatch, slash command routing
- `src/extension/bridge.ts` — Register hidden command, pass `ExtensionCommandContext` to command handler
- `src/shared/protocol.ts` — New message types for bash results and command feedback
- `src/shared/browser-protocol.ts` — New message types for browser display
- `src/shared/types.ts` — Terminal session type stub
- `src/client/components/ChatView.tsx` — Render bash output and command feedback
- `src/server/server.ts` — Route new message types between extension and browser
