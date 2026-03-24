## Tasks

### 1. Add `name` field to types and protocol messages
- [x] Add `name?: string` to `DashboardSession` in `src/shared/types.ts`
- [x] Add `name?: string` to `SessionRegisterMessage` in `src/shared/protocol.ts`
- [x] Add `SessionNameUpdateMessage` type (extension→server) in `src/shared/protocol.ts`
- [x] Add `RenameSessionMessage` type (server→extension) in `src/shared/protocol.ts`
- [x] Add `RenameSessionBrowserMessage` type (browser→server) in `src/shared/browser-protocol.ts`
- [x] Update union types to include new message types

### 2. Extension: poll and forward session name
- [x] In `bridge.ts`, read `pi.getSessionName()` at session_start and include `name` in `session_register`
- [x] Add name polling (reuse the 30s interval pattern from git/openspec polling), send `session_name_update` only when changed
- [x] Include name in `sendStateSync()` re-registration

### 3. Extension: handle rename command from server
- [x] In `command-handler.ts`, handle `rename_session` message by calling `pi.setSessionName(name)` and returning a `session_name_update` confirmation

### 4. Server: handle name messages and persist
- [x] Add `name` column to sessions table in `src/server/db.ts`
- [x] Handle `session_name_update` from extension: update DB + session manager + broadcast `session_updated` with name
- [x] Handle `rename_session` from browser: forward to extension connection
- [x] Include `name` in session data sent to browsers on connect

### 5. Client: display session name everywhere
- [x] Update `SessionHeader.tsx` to display `session.name ?? cwd.split("/").pop()`
- [x] Update `SessionSidebar.tsx` to display `session.name ?? cwd.split("/").pop()`
- [x] Update `SessionCard.tsx` to display `session.name ?? cwd.split("/").pop()`
- [x] Update `SessionList.tsx` to display `session.name ?? cwd.split("/").pop()` for individual sessions (keep group headers as directory names)

### 6. Client: inline rename UI
- [x] Create `InlineRenameInput` component: text input with Enter/Escape handling, auto-focus, pre-filled with current name
- [x] Add inline rename to `SessionHeader.tsx`: pencil icon + double-click activates edit mode, sends `rename_session` on confirm
- [x] Add inline rename to `SessionSidebar.tsx`: double-click on name activates edit mode, sends `rename_session` on confirm
- [x] Extract shared `getSessionDisplayName(session)` helper to avoid repeating the fallback logic

### 7. Tests
- [x] Test protocol message types compile correctly (type-level)
- [x] Test server handles `session_name_update` and broadcasts to browsers
- [x] Test server forwards `rename_session` from browser to extension
- [x] Test `InlineRenameInput` component: renders, Enter confirms, Escape cancels, empty name handling
- [x] Test display name fallback logic in `getSessionDisplayName`
