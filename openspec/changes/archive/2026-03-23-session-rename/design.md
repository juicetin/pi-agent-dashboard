## Context

Sessions display `cwd.split("/").pop()` as their name. Pi supports `/name` command and `pi.setSessionName()`/`pi.getSessionName()` extension APIs. The dashboard has no awareness of session names.

The existing patterns for polling external state (git info, openspec) provide a proven template: poll periodically, send update message when changed.

## Goals / Non-Goals

**Goals:**
- Display pi session names in the dashboard when set
- Allow renaming sessions from the dashboard UI
- Bidirectional sync: TUI rename → dashboard updates, dashboard rename → pi updates

**Non-Goals:**
- Renaming ended sessions (no connected extension to call `setSessionName`)
- Bulk rename operations
- Auto-generating names from conversation content

## Decisions

### 1. Poll `getSessionName()` like git info
**Decision:** Poll every 30s, send update only when changed.
**Rationale:** Consistent with existing patterns (git info polling, openspec polling). No dedicated pi event exists for name changes, so polling is the simplest approach.
**Alternative:** Listen for `session_info` entries in forwarded events — rejected because events may not always capture name changes reliably and adds parsing complexity.

### 2. Use `pi.setSessionName()` for dashboard-initiated renames
**Decision:** Add a `rename_session` message type from server→extension. Extension calls `pi.setSessionName(name)` directly.
**Rationale:** Clean, no side effects. Using `sendUserMessage("/name ...")` would pollute the conversation and trigger agent processing.

### 3. Include name in `session_register`
**Decision:** Add optional `name` field to `SessionRegisterMessage`. Extension reads `pi.getSessionName()` at registration.
**Rationale:** Ensures name is available immediately on connect/reconnect without waiting for the first poll cycle.

### 4. Inline edit UI
**Decision:** Pencil icon button next to session name in SessionHeader. Double-click on name also activates edit mode. Simple input field with Enter to confirm, Escape to cancel.
**Rationale:** Standard inline-edit UX pattern. Minimal UI footprint.

### 5. Sidebar rename
**Decision:** Double-click on session name in sidebar activates inline edit. Same behavior as header.
**Rationale:** Consistent interaction pattern across all name displays.

## Risks / Trade-offs

- [Polling delay] Up to 30s before dashboard sees a TUI rename → Acceptable trade-off for simplicity; user can refresh manually
- [Race condition] Dashboard rename + TUI rename simultaneously → Last-write-wins via polling; acceptable for single-user tool
- [Empty name] User clears name → Treat empty/whitespace as "unset", fall back to directory name display
