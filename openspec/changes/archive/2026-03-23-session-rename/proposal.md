## Why

Sessions are displayed using directory names (`cwd.split("/").pop()`), which is ambiguous when multiple sessions share the same project folder. Pi already supports session naming via `/name` command and `pi.setSessionName()`, but the dashboard doesn't surface or allow editing this name.

## What Changes

- Add `name?: string` field to `DashboardSession` type
- Extension polls `pi.getSessionName()` periodically and sends name updates to server
- Extension includes initial session name in `session_register`
- New protocol messages: `session_name_update` (extension→server) and `rename_session` (server→extension, browser→server)
- Server persists session name and broadcasts updates to browsers
- UI displays `session.name ?? cwd.split("/").pop()` everywhere session names appear
- Inline rename UI on SessionHeader (pencil icon + double-click) and SessionSidebar
- When renamed from dashboard, extension calls `pi.setSessionName(name)` directly (no conversation pollution)

## Capabilities

### New Capabilities
- `session-rename`: Session display name support — polling from pi, inline rename UI, bidirectional sync between dashboard and pi TUI

### Modified Capabilities
- `shared-protocol`: New message types for session name updates and rename commands
- `bridge-extension`: Poll and forward session name, handle rename command from server
- `session-sidebar`: Display custom session name, inline rename on double-click
- `chat-view`: Display custom session name in SessionHeader

## Impact

- `src/shared/types.ts` — add `name` field to `DashboardSession`
- `src/shared/protocol.ts` — new message types
- `src/shared/browser-protocol.ts` — new message type
- `src/extension/bridge.ts` — name polling + rename handler
- `src/server/server.ts` — handle name messages, broadcast
- `src/server/db.ts` — persist name column
- `src/client/components/SessionHeader.tsx` — display name + inline edit
- `src/client/components/SessionSidebar.tsx` — display name + inline edit
- `src/client/components/SessionCard.tsx` — display name
- `src/client/components/SessionList.tsx` — display name
