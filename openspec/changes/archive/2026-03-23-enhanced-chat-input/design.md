## Context

The dashboard has two input components: `MessageInput` (simple `<input>`, currently used) and `CommandInput` (textarea with `/` autocomplete, unused). The protocol already supports `commands_list` messages flowing from bridge → server → browser, but the browser never requests or stores them. The pi TUI uses `CombinedAutocompleteProvider` which runs `fd` locally for `@` file search and passes `@path` references as plain text to the LLM. The pi SDK's `sendUserMessage()` already accepts `(TextContent | ImageContent)[]`.

## Goals / Non-Goals

**Goals:**
- Multiline input with Shift+Enter for newlines, Enter to send
- `/slash` command autocomplete using existing `CommandInput` and protocol
- `@` file fuzzy search via protocol round-trip to bridge
- Image paste from clipboard with preview and transport to pi session
- Compatible with pi TUI conventions (`@path` as plain text, `ImageContent` format)

**Non-Goals:**
- File content injection (@ just completes the path, LLM reads the file)
- Drag-and-drop file upload
- Argument completion for slash commands (existing spec mentions it, but not implementing now)
- Image resize/optimization in the browser

## Decisions

### 1. Swap MessageInput → CommandInput in App.tsx

**Decision:** Replace `MessageInput` with `CommandInput`, delete `MessageInput`.

**Rationale:** `CommandInput` already implements multiline textarea, auto-resize, Shift+Enter, and `/` autocomplete dropdown. It's fully built and tested but unused. No reason to maintain both.

**Change:** `App.tsx` imports `CommandInput`, passes `commands` prop. `MessageInput.tsx` deleted.

### 2. Per-session commands state in App

**Decision:** Store commands in a `Map<string, CommandInfo[]>` keyed by session ID. Handle `commands_list` messages in the WebSocket handler. Request commands when subscribing to a session.

**Rationale:** Commands are per-session (different pi sessions have different extensions/skills). The protocol already supports `request_commands` → `commands_list` flow.

**Alternatives considered:**
- Global commands list — rejected, commands differ per session
- Fetch on demand when dropdown opens — rejected, adds latency to autocomplete

### 3. Protocol round-trip for @ file search

**Decision:** Add `list_files` (browser → server → bridge) and `files_list` (bridge → server → browser) protocol messages. Bridge spawns `fd` with the query in the session's cwd. Debounce requests at 150ms in the browser.

**Message format:**
```typescript
// Browser → Server → Bridge
{ type: "list_files", sessionId: string, query: string }

// Bridge → Server → Browser  
{ type: "files_list", sessionId: string, query: string, files: FileEntry[] }

interface FileEntry { path: string; isDirectory: boolean }
```

**Rationale:** The TUI uses `fd` locally via `CombinedAutocompleteProvider`. The browser can't run `fd`, so we proxy through the bridge. `fd` is fast (~10ms for most repos), and 150ms debounce prevents flooding. Top 20 results returned (matching TUI behavior).

**Alternatives considered:**
- Cache file tree on connect — rejected, stale data, large payload for big repos
- Server-side file listing — rejected, server may not have access to session's workspace
- Browser-side search with cached index — rejected, complexity of keeping index fresh

### 4. @ autocomplete trigger and UI

**Decision:** Detect `@` after a delimiter (space, start of line) in the textarea. Show a dropdown above the input with fuzzy-matched file paths. On selection, insert `@path/to/file` into the text. Directories shown with trailing `/`.

**Rationale:** Matches pi TUI's `extractAtPrefix()` behavior — `@` must be at token start. The completed value is plain text with `@` prefix, which the LLM interprets as a file reference.

### 5. Extend send_prompt with images

**Decision:** Add optional `images?: ImageContent[]` to `send_prompt` messages in both browser→server and server→extension protocols. `ImageContent` uses the same format as pi SDK: `{ type: "image", data: string (base64), mimeType: string }`.

**Rationale:** Direct compatibility with `pi.sendUserMessage()` which already accepts `ImageContent[]`. No conversion needed in the bridge.

### 6. Clipboard paste handling

**Decision:** Listen for `paste` event on the textarea. If clipboard contains image items (`image/png`, `image/jpeg`, etc.), read as `Blob`, convert to base64, store in component state as pending images. Show thumbnails below the textarea with remove buttons. On send, include images in the `send_prompt` message. Clear images after send.

**Rationale:** Standard browser clipboard API. Thumbnails give visual confirmation. Keeping images in component state (not in the textarea text) avoids polluting the text content.

**Size limit:** 10MB per image (base64 encoded). Reject with toast if exceeded.

### 7. Bridge handles list_files and images

**Decision:** In `command-handler.ts`:
- `list_files`: Spawn `fd` with `--base-directory <cwd> --max-results 20 --type f --type d --hidden --exclude .git` and the query. Return results as `files_list`.
- `send_prompt` with images: Call `pi.sendUserMessage([{ type: "text", text }, ...images])` instead of `pi.sendUserMessage(text)`.

**Rationale:** Reuses same `fd` approach as pi TUI's `CombinedAutocompleteProvider`. The `sendUserMessage` API already handles mixed content arrays.

**Fallback:** If `fd` is not available, return empty results (graceful degradation, same as TUI).

## Risks / Trade-offs

- **[fd not installed]** → File autocomplete silently returns no results. Could show a hint "install fd for file autocomplete" but not in initial scope.
- **[Large images over WebSocket]** → 10MB base64 image = ~13MB on wire. Acceptable for occasional paste. Not designed for bulk image upload.
- **[Debounce latency for @]** → 150ms debounce + network round-trip may feel slower than TUI's local fd. Acceptable trade-off for simplicity.
- **[fd query injection]** → Query passed to fd as argument. fd treats arguments as regex patterns. Sanitize by escaping regex special characters.
