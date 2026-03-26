## Context

The dashboard shows all OpenSpec changes for a project in the session card's expandable section. The bridge already detects OpenSpec activity (phase + changeName) from tool calls via `openspec-activity-detector.ts`, but this is transient — cleared on `agent_end`. We need a persistent attachment that survives across turns.

The session name is managed via `session.name` on `DashboardSession`, with `firstMessage` and `cwd` as display fallbacks in `getSessionDisplayName()`.

## Goals / Non-Goals

**Goals:**
- Persistent per-session proposal attachment (survives agent turns and page refresh)
- Auto-attach from activity detection when no proposal is currently attached
- Auto-set session name from proposal name when `session.name` is empty
- Manual attach/detach from browser UI
- Filtered OpenSpec section showing only attached proposal
- Bulk Archive button when no proposal attached

**Non-Goals:**
- Multi-proposal attachment (one proposal per session)
- Server-side persistence of attachment (in-memory on session object is sufficient — sessions are transient)
- Changing the activity detection logic itself

## Decisions

### 1. Attachment state lives on DashboardSession

Add `attachedProposal?: string | null` to `DashboardSession`. The server stores it in the in-memory session record and broadcasts changes via existing `session_updated`. No database persistence needed — attachment is relevant only while the session is alive.

**Alternative**: Client-only React state. Rejected because auto-attach happens in the bridge, and the state needs to be visible to all connected browsers.

### 2. Auto-attach in bridge, forwarded to server

When `openspec-activity-detector` finds a `changeName` and the bridge hasn't yet sent an attachment for this session, the bridge sends an `attach_proposal` message to the server. The bridge tracks `currentAttachedProposal` locally to avoid redundant messages.

The bridge does NOT auto-attach if a proposal is already attached (manual focus is sticky). The server is the authority — if a `detach_proposal` comes from the browser, the server clears the attachment and the bridge must respect it on reconnect.

**Flow:**
```
bridge: activity detector finds changeName="foo"
bridge: currentAttachedProposal is null → send attach_proposal
server: sets session.attachedProposal = "foo"
server: if session.name is empty → set session.name = "foo", call rename on extension
server: broadcasts session_updated
```

### 3. Auto-name via server-side logic

When the server processes `attach_proposal` and `session.name` is empty/undefined, the server sets `session.name` to the proposal name and sends a `rename_session` message to the extension (so pi's internal name is updated too). This reuses the existing rename infrastructure.

Detach does NOT revert the name.

### 4. New protocol messages (browser ↔ server only)

```
Browser → Server:
  { type: "attach_proposal", sessionId, changeName }
  { type: "detach_proposal", sessionId }
```

No new extension↔server messages needed. The bridge sends `attach_proposal` to the server using the same server message type (the server accepts it from both extensions and browsers). Actually, simpler: the bridge already sends `openspec_activity_update` with `changeName`. The server can handle auto-attach logic itself when it receives an activity update with a changeName and the session has no `attachedProposal`.

**Revised approach:** Server handles auto-attach when processing `openspec_activity_update`. No new bridge-side messages needed.

### 5. Bulk Archive sends prompt command

The Bulk Archive button sends `/opsx:bulk-archive` as a `send_prompt` to the session. It shows a confirmation dialog first. It does NOT clear the attachment.

## Risks / Trade-offs

- [Risk] Auto-attach might pick up incidental changeName references (e.g., reading a random change file) → Mitigation: Only auto-attach when phase is also detected (both phase AND changeName present in the activity update)
- [Risk] Attachment lost on server restart → Acceptable: sessions reconnect and auto-attach will re-trigger on next activity
- [Trade-off] Server-side auto-attach keeps bridge simple but adds logic to server's activity update handler
