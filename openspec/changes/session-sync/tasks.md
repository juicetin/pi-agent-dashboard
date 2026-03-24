## 1. Database & Types

- [ ] 1.1 Add `session_file TEXT`, `session_dir TEXT`, `hidden INTEGER DEFAULT 0`, `first_message TEXT` ALTER migrations to `db.ts`
- [ ] 1.2 Add `sessionFile`, `sessionDir`, `hidden`, `firstMessage` fields to `DashboardSession` in `types.ts`
- [ ] 1.3 Add `PiSessionInfo` type to `types.ts` (id, path, cwd, name, parentSessionPath, created, modified, messageCount, firstMessage)
- [ ] 1.4 Add `sessionFile`, `sessionDir`, `hidden`, `firstMessage` to `PERSISTABLE_FIELDS` in `session-manager.ts`, update hydration query and row mapping
- [ ] 1.5 Update `register()` to set `hidden = false` on registration
- [ ] 1.6 Update `unregister()` to set `hidden = true` on unregistration
- [ ] 1.7 Update stale session hydration to set `hidden = true` for stale active/streaming sessions
- [ ] 1.8 Write tests for hidden lifecycle (register sets false, unregister sets true, hydration sets true for stale)

## 2. Protocol Messages

- [ ] 2.1 Add `sessionFile`, `sessionDir`, and `firstMessage` optional fields to `SessionRegisterMessage` in `protocol.ts`
- [ ] 2.2 Add `ListSessionsMessage` (server → extension) and `SessionsListMessage` (extension → server) to `protocol.ts`
- [ ] 2.3 Add `ListSessionsBrowserMessage`, `SessionsListBrowserMessage`, `ResumeSessionBrowserMessage`, `ResumeResultBrowserMessage` to `browser-protocol.ts`
- [ ] 2.4 Add new message types to the union types in both protocol files

## 3. Bridge Extension — Pi Session ID

- [ ] 3.1 Change `sessionId` from `const crypto.randomUUID()` to `let sessionId: string` in `bridge.ts`
- [ ] 3.2 Set `sessionId` from `ctx.sessionManager.getSessionId()` during `session_start`
- [ ] 3.3 Send `sessionFile`, `sessionDir`, and `firstMessage` (extracted from first user message in `ctx.sessionManager.getEntries()`) in `session_register`
- [ ] 3.4 Include `sessionFile`, `sessionDir`, and `firstMessage` in `sendStateSync()`

## 4. Bridge Extension — Session Switch & Fork

- [ ] 4.1 Add `session_switch` and `session_fork` event listeners in `bridge.ts`
- [ ] 4.2 Extract shared handler `handleSessionChange(ctx)`: send `session_unregister` for old ID, update `sessionId` from `ctx.sessionManager.getSessionId()`, update `sessionFile` and `sessionDir` from ctx, send new `session_register`, run full state sync
- [ ] 4.3 Wire `session_switch` event to call `handleSessionChange(ctx)` (triggered by `/new` and `/resume`)
- [ ] 4.4 Wire `session_fork` event to call `handleSessionChange(ctx)` (triggered by `/fork`)
- [ ] 4.5 Clear and restart polling timers (git, openspec) on session change
- [ ] 4.6 Write tests for session switch handling (old unregistered, new registered, events use new ID)
- [ ] 4.7 Write tests for session fork handling (same behavior as switch: old unregistered, new registered)

## 5. Bridge Extension — Session Listing

- [ ] 5.1 Add `list_sessions` case to command handler in `command-handler.ts`
- [ ] 5.2 Import `SessionManager` from `@mariozechner/pi-coding-agent` and call `SessionManager.list(cwd)` 
- [ ] 5.3 Map `SessionInfo[]` to `PiSessionInfo[]` and return as `sessions_list` message
- [ ] 5.4 Handle errors gracefully (return empty array on failure)
- [ ] 5.5 Write tests for list sessions handler (success, failure, empty)

## 6. Server — Session File & Hidden Persistence

- [ ] 6.1 Update `pi-gateway.ts` to extract `sessionFile` and `sessionDir` from `session_register` and pass to `sessionManager.register()`
- [ ] 6.2 Update `RegisterSessionParams` to include `sessionFile` and `sessionDir`
- [ ] 6.3 Update `session-manager.ts` `register()` to persist `session_file`, `session_dir`, `hidden = false`
- [ ] 6.4 Update session hydration to mark stale sessions as `hidden = true`
- [ ] 6.5 Write integration test: session registers with file/dir, ends with hidden=true, re-registers with hidden=false

## 7. Server — Session Listing Flow

- [ ] 7.1 Handle `sessions_list` from bridge in `server.ts` `onEvent`: create SQLite records for unknown sessions
- [ ] 7.2 Handle `list_sessions` from browser in `browser-gateway.ts`: forward to a bridge for matching cwd
- [ ] 7.3 Add helper to find a connected bridge by cwd prefix in `pi-gateway.ts`
- [ ] 7.4 Forward `sessions_list` response to requesting browser
- [ ] 7.5 Fallback: if no bridge connected, return sessions from SQLite filtered by cwd
- [ ] 7.6 Write tests for session creation from listing (new sessions created, existing not overwritten)

## 8. Server — Resume/Fork

- [ ] 8.1 Extend `spawnPiSession()` in `process-manager.ts` to accept `sessionFile` and `mode` parameters
- [ ] 8.2 Update `buildTmuxCommand()` to include `--session <path>` or `--fork <path>` based on mode
- [ ] 8.3 Handle `resume_session` from browser in `browser-gateway.ts`: look up session file, call spawnPiSession, send result
- [ ] 8.4 Validate session exists and has `session_file` before spawning
- [ ] 8.5 Validate session is not already active before continue mode
- [ ] 8.6 Write tests for process-manager with session file and mode parameters

## 9. Client — Hidden Toggle & Resume UI

- [ ] 9.1 Update session filtering to use server-side `hidden` flag instead of client-side localStorage
- [ ] 9.2 Remove legacy `hiddenSessions` localStorage key on load
- [ ] 9.3 Change "Active only" toggle default to ON
- [ ] 9.4 Add "Show hidden" toggle that reveals sessions with `hidden = true`
- [ ] 9.5 Show hidden sessions with muted styling (reduced opacity)
- [ ] 9.6 Add "Resume" and "Fork" buttons on hidden session cards
- [ ] 9.7 Send `resume_session` message on Resume/Fork click
- [ ] 9.8 Show hidden count indicator ("N hidden") when toggle is off
- [ ] 9.9 Handle `resume_result` message (show success/error toast)
- [ ] 9.10 Add `list_sessions` request on workspace selection to discover pi-only sessions
- [ ] 9.11 Update `getSessionDisplayName()` fallback chain: name → firstMessage (truncated to 50 chars) → cwd last segment → session ID
- [ ] 9.12 Write tests for updated display name logic with firstMessage fallback
