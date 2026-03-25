## ADDED Requirements

### Requirement: Command routing in send_prompt handler
The bridge extension's command handler SHALL parse `send_prompt` text for `!`, `!!`, and `/` prefixes and route them to the appropriate pi APIs instead of always calling `sendUserMessage()`.

Routing order:
1. `!!<cmd>` → silent bash via `pi.exec()`, forward `bash_output` event
2. `!<cmd>` → bash via `pi.exec()`, forward `bash_output` event + send to LLM
3. `/compact [args]` → `ctx.compact()` with optional custom instructions
4. `/` prefixed → `session.prompt(text)` for extension commands, skills, templates
5. Default → `pi.sendUserMessage(text)`

#### Scenario: Bang command routed to exec
- **WHEN** `send_prompt` arrives with text `!npm test`
- **THEN** the handler SHALL call `pi.exec()` with the command, NOT `sendUserMessage()`

#### Scenario: Compact routed to ctx.compact
- **WHEN** `send_prompt` arrives with text `/compact`
- **THEN** the handler SHALL call `ctx.compact()`, NOT `sendUserMessage()`

#### Scenario: Regular text unchanged
- **WHEN** `send_prompt` arrives with text `explain this function`
- **THEN** the handler SHALL call `sendUserMessage("explain this function")` as before

### Requirement: Hidden command registration
The bridge SHALL register a `__dashboard` command via `pi.registerCommand()` during `initBridge()`. The command SHALL have no description. The commands list sent to the server SHALL filter out commands whose names start with `__`.

#### Scenario: Dashboard command registered
- **WHEN** the bridge initializes
- **THEN** `pi.registerCommand("__dashboard", ...)` SHALL be called

#### Scenario: Hidden commands filtered from list
- **WHEN** the bridge sends a `commands_list` message
- **THEN** commands with names starting with `__` SHALL be excluded

### Requirement: Cached session for prompt routing
The bridge SHALL store a reference to the agent session (from `cachedCtx`) that exposes `prompt()` for routing slash commands. The command handler SHALL receive this reference via its options/dependencies.

#### Scenario: Session reference passed to handler
- **WHEN** a slash command needs routing via `session.prompt()`
- **THEN** the command handler SHALL have access to the session's `prompt()` method through its stored context reference
