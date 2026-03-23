## Why

The dashboard's chat input is a basic single-line `<input>` that can't compose multiline messages, has no command autocomplete, no file path completion, and no image support. The pi TUI client supports all of these — multiline editing, `/slash` command autocomplete, `@file` fuzzy search, and image paste. The dashboard should match this capability so users can work effectively from the browser.

## What Changes

- **Replace `MessageInput` with `CommandInput` in `App.tsx`** — `CommandInput` already exists with multiline textarea, auto-resize, Shift+Enter newlines, and `/` command autocomplete dropdown. It's currently unused. Wire it in and connect the commands state.
- **Wire commands flow into App state** — Handle `commands_list` messages from the server in `App.tsx`, store per-session commands, pass to `CommandInput`. Request commands on session subscribe.
- **Add `@` file fuzzy search autocomplete** — When user types `@` in the input, send a `list_files` request through the protocol to the bridge, which runs `fd` in the session's cwd and returns matching paths. Show results in a dropdown. Completed paths are inserted as `@path/to/file` — the LLM interprets these as file references (same as pi TUI behavior).
- **Add image paste support** — Handle clipboard paste events in the textarea, extract images, convert to base64, show preview thumbnails. Extend `send_prompt` protocol messages to carry `images?: ImageContent[]`. Bridge passes images to `pi.sendUserMessage()` which already accepts `(TextContent | ImageContent)[]`.
- **Remove `MessageInput` component** — It becomes dead code after the swap.

## Capabilities

### New Capabilities
- `file-autocomplete`: `@` triggered fuzzy file search via protocol round-trip to bridge (list_files request/response, fd execution, browser dropdown UI)
- `image-paste`: Clipboard image paste in chat input with base64 encoding, preview thumbnails, and protocol transport to bridge

### Modified Capabilities
- `command-autocomplete`: Wire existing `CommandInput` component into `App.tsx`, connect `commands_list` messages to App state, request commands on subscribe
- `shared-protocol`: Extend `send_prompt` messages (both browser→server and server→extension) with optional `images` field. Add `list_files` request/response messages for file autocomplete.
- `bridge-extension`: Handle `list_files` requests by running `fd` in session cwd. Handle `images` in `send_prompt` by passing them to `pi.sendUserMessage()`.

## Impact

- **Protocol** (`src/shared/protocol.ts`, `src/shared/browser-protocol.ts`): New `list_files`/`files_list` message types. `send_prompt` gains optional `images` field.
- **Bridge** (`src/extension/command-handler.ts`): Handle `list_files` (spawn `fd`), pass images to `pi.sendUserMessage()`.
- **Server** (`src/server/browser-gateway.ts`, `src/server/server.ts`): Proxy `list_files` requests/responses between browser and bridge. Proxy images in `send_prompt`.
- **Client** (`src/client/App.tsx`, `src/client/components/CommandInput.tsx`): Swap input component, wire commands state, add `@` autocomplete with debounced protocol requests, add paste handler with image preview.
- **Dead code removal**: `src/client/components/MessageInput.tsx` deleted.
