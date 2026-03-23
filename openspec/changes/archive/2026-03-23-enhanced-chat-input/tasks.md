## 1. Protocol Types

- [x] 1.1 Add `ImageContent` and `FileEntry` types to `src/shared/types.ts`
- [x] 1.2 Add `list_files` and `files_list` messages to extension↔server protocol (`src/shared/protocol.ts`), add `images` field to `SendPromptToExtensionMessage`
- [x] 1.3 Add `list_files` and `files_list` messages to browser↔server protocol (`src/shared/browser-protocol.ts`), add `images` field to `SendPromptToBrowserMessage`

## 2. Bridge Extension

- [x] 2.1 Handle `send_prompt` with images in `command-handler.ts` — call `pi.sendUserMessage([{ type: "text", text }, ...images])` when images present
- [x] 2.2 Handle `list_files` in `command-handler.ts` — spawn `fd` with escaped query, return `files_list` response
- [x] 2.3 Add `list_files` to `ServerToExtensionMessage` union and `files_list` to `ExtensionToServerMessage` union

## 3. Server Proxying

- [x] 3.1 Proxy `list_files` from browser to bridge in `browser-gateway.ts`
- [x] 3.2 Proxy `files_list` from bridge to browser in `server.ts`
- [x] 3.3 Proxy `images` field in `send_prompt` from browser to bridge

## 4. Wire CommandInput into App

- [x] 4.1 Add per-session commands state (`Map<string, CommandInfo[]>`) to `App.tsx`, handle `commands_list` messages
- [x] 4.2 Send `request_commands` when subscribing to a session
- [x] 4.3 Replace `MessageInput` with `CommandInput` in `App.tsx`, pass session commands
- [x] 4.4 Delete `MessageInput.tsx`

## 5. File Autocomplete UI

- [x] 5.1 Add `@` trigger detection in `CommandInput` — extract `@query` after delimiters
- [x] 5.2 Add debounced `list_files` request callback (150ms) as a prop to `CommandInput`
- [x] 5.3 Add file dropdown UI (reuse slash command dropdown pattern) with filename label and path description
- [x] 5.4 Handle file selection — insert `@path` with trailing space for files, no space for directories
- [x] 5.5 Handle stale results — discard responses for outdated queries

## 6. Image Paste

- [x] 6.1 Add paste event handler on textarea — detect image clipboard items, convert to base64, store in state
- [x] 6.2 Add 10MB size limit check with error message
- [x] 6.3 Add thumbnail preview row below textarea with remove buttons
- [x] 6.4 Include pending images in `onSend` callback, clear after send
- [x] 6.5 Update `onSend` prop signature to accept `(text: string, images?: ImageContent[])` and wire through App.tsx to WebSocket send
