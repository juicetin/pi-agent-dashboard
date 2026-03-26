## Context

The dashboard's `send_prompt` handler calls `pi.sendUserMessage(text)` directly, which sends raw text to the LLM. Pi's interactive mode handles `!`/`!!` bash prefixes, `/compact`, `/new`, `/fork`, and other built-in commands in its UI layer *before* reaching `sendUserMessage()`. Extension slash commands are processed by `session.prompt()` via `_tryExecuteExtensionCommand()`. None of this processing happens when the dashboard sends input.

The bridge extension already has access to `pi.exec()` for shell execution, `cachedCtx.compact()` for compaction, and `pi.sendUserMessage()` for LLM messages. The missing piece is command routing logic and `ExtensionCommandContext` for session control.

## Goals / Non-Goals

**Goals:**
- Route `!command` and `!!command` from dashboard input through `pi.exec()` with output forwarded to the browser
- Route `/compact [instructions]` through `ctx.compact()`
- Route extension/skill/prompt slash commands through `session.prompt()` so they execute properly
- Obtain `ExtensionCommandContext` via a hidden registered command for future session control operations
- Display bash execution output and command feedback in the dashboard chat view
- Define a `terminal` session type placeholder for future terminal session support

**Non-Goals:**
- Interactive TUI commands (`/settings`, `/tree`, `/fork` selectors) — these require TUI interaction
- Full terminal emulator in the dashboard (future work)
- `/login`, `/logout` OAuth flows from the dashboard
- `/export`, `/share` from the dashboard

## Decisions

### 1. Command routing in the extension's command handler

**Decision:** Parse input prefixes in `command-handler.ts` `send_prompt` case, before calling `sendUserMessage()`.

**Rationale:** Keeps the client dumb — it always sends `send_prompt` and the extension decides how to dispatch. No new browser→server message types needed for routing. The extension has direct access to all pi APIs.

**Routing order:**
1. `!!<command>` → silent bash execution via `pi.exec()`, result forwarded to browser only
2. `!<command>` → bash execution via `pi.exec()`, output sent as user message to LLM
3. `/compact [instructions]` → `ctx.compact({ customInstructions })`
4. `/` prefixed text → attempt `session.prompt(text)` for extension commands, skills, templates
5. Everything else → `pi.sendUserMessage(text)` (current behavior)

**Alternative considered:** Client-side parsing with separate message types — rejected because it duplicates routing logic and requires protocol changes for each new command.

### 2. Hidden command for ExtensionCommandContext

**Decision:** Register a command named `__dashboard` via `pi.registerCommand()`. When the bridge receives session control requests, it invokes this command's handler which has access to `ExtensionCommandContext` with `newSession()`, `fork()`, `navigateTree()`, `switchSession()`, `reload()`.

**Mechanism:** The `__dashboard` command handler receives an action string, parses it, and dispatches. The bridge stores a reference to the latest `ExtensionCommandContext` from the command's execution context.

**Rationale:** This is the only way to access `ExtensionCommandContext` outside of user-invoked commands. The `__` prefix convention signals it's internal.

**Note:** Session control commands (`/new`, `/fork`, `/tree`, `/resume`, `/reload`) are deferred — the hidden command infrastructure is laid now for future use.

### 3. Bash output forwarding via new protocol messages

**Decision:** Add `bash_output` event type to the existing `event_forward` / `event` message flow. The extension sends bash execution results as dashboard events, which the server stores and forwards to browsers like any other event.

**Event shape:**
```typescript
interface BashOutputEvent {
  eventType: "bash_output";
  timestamp: number;
  data: {
    command: string;
    output: string;
    exitCode: number;
    excludeFromContext: boolean; // true for !!
  };
}
```

**Rationale:** Reuses the existing event pipeline rather than creating separate message types. The chat view already renders events by type — adding a new event type renderer is straightforward.

**Alternative considered:** New dedicated protocol message types — rejected because it adds unnecessary complexity when the event system already handles arbitrary event types.

### 4. Command feedback via events

**Decision:** For commands like `/compact`, send feedback as a `command_feedback` event through the existing event pipeline.

**Event shape:**
```typescript
interface CommandFeedbackEvent {
  eventType: "command_feedback";
  timestamp: number;
  data: {
    command: string;
    status: "started" | "completed" | "error";
    message?: string;
  };
}
```

### 5. Terminal session type stub

**Decision:** Add `"terminal"` to the `SessionSource` union type in `src/shared/types.ts`. No behavior changes — this is a type-level placeholder for future terminal session support. The session sidebar can show a terminal icon for sessions with this source type.

### 6. Slash command routing through session.prompt()

**Decision:** For `/` prefixed input that isn't a recognized built-in (`/compact`), call the pi `session.prompt(text)` method instead of `sendUserMessage()`. This ensures extension commands, skills (`/skill:name`), and prompt templates (`/templatename`) are expanded and executed properly.

**Access:** The `cachedCtx` in the bridge already holds a reference to the session context. We access the session's `prompt()` method through the stored context.

**Fallback:** If `session.prompt()` is not accessible (e.g., older pi version), fall back to `sendUserMessage()`.

## Risks / Trade-offs

- **[Risk] `pi.exec()` hangs on long-running commands** → Use a timeout (30s default) and forward partial output. The user can abort via the existing abort mechanism.
- **[Risk] `session.prompt()` not available on all pi versions** → Fall back to `sendUserMessage()` gracefully.
- **[Risk] Hidden `__dashboard` command appears in `/` autocomplete** → Filter commands starting with `__` from the commands list sent to the browser. The command is already filtered from pi's own autocomplete since extension commands don't show by default unless they have a description.
- **[Trade-off] Extension-side routing means the client doesn't know what's a command** → Acceptable. The client already shows command autocomplete from the commands list. We can enhance the UI later with visual indicators.
