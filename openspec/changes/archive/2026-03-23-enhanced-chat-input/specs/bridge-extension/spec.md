## MODIFIED Requirements

### Requirement: Command relay from dashboard
The bridge extension SHALL listen for commands from the dashboard server and execute them in the pi session.

Supported commands:
- `send_prompt`: If text only, call `pi.sendUserMessage(text)`. If images are present, call `pi.sendUserMessage([{ type: "text", text }, ...images])`. If agent is streaming, use `{ deliverAs: "followUp" }`.
- `abort`: call `ctx.abort()`
- `request_commands`: send updated `commands_list` response
- `request_state_sync`: re-send full session state
- `list_files`: run `fd` in session cwd and return `files_list` response

#### Scenario: User sends prompt from dashboard while agent is idle
- **WHEN** the extension receives `send_prompt` and `ctx.isIdle()` returns true
- **THEN** the extension SHALL call `pi.sendUserMessage(text)` without deliverAs option

#### Scenario: User sends prompt from dashboard while agent is streaming
- **WHEN** the extension receives `send_prompt` and agent is streaming
- **THEN** the extension SHALL call `pi.sendUserMessage(text, { deliverAs: "followUp" })`

#### Scenario: User sends prompt with images
- **WHEN** the extension receives `send_prompt` with text and images array
- **THEN** the extension SHALL call `pi.sendUserMessage([{ type: "text", text: msg.text }, ...msg.images])`

#### Scenario: User aborts from dashboard
- **WHEN** the extension receives `abort`
- **THEN** the extension SHALL call `ctx.abort()` to stop the current agent operation

## ADDED Requirements

### Requirement: File listing via fd
The bridge extension SHALL handle `list_files` requests by spawning `fd` in the session's working directory and returning matching file paths as a `files_list` response.

The `fd` command SHALL be invoked with arguments: `--base-directory <cwd> --max-results 20 --type f --type d --full-path --hidden --exclude .git`. The query SHALL be passed as a regex pattern with special characters escaped.

#### Scenario: File search with query
- **WHEN** the extension receives `list_files` with query `db.t`
- **THEN** the extension SHALL spawn `fd` with the escaped query pattern and return matching paths as `files_list`

#### Scenario: File search with empty query
- **WHEN** the extension receives `list_files` with an empty query
- **THEN** the extension SHALL spawn `fd` without a pattern and return up to 20 files/directories

#### Scenario: fd not installed
- **WHEN** the extension receives `list_files` but `fd` is not available on the system
- **THEN** the extension SHALL return an empty `files_list` response (graceful degradation)

#### Scenario: fd returns no results
- **WHEN** `fd` finds no matching files for the query
- **THEN** the extension SHALL return a `files_list` with an empty files array

#### Scenario: Query contains regex special characters
- **WHEN** the extension receives `list_files` with query `file(1).ts`
- **THEN** the extension SHALL escape regex special characters before passing to `fd`
