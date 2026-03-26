## Why

When working with multiple OpenSpec proposals in a project, the session card's OpenSpec section shows all changes — creating noise. Users typically work on one proposal per session. We need a way to "attach" a proposal to a session so only that proposal is visible, and auto-detect which proposal the session is working on from tool activity.

## What Changes

- Add `attachedProposal` field to `DashboardSession` for persistent proposal focus per session
- When a proposal is attached, the OpenSpec section header shows the proposal name and a "Detach" button; only that proposal's change card is displayed
- When no proposal is attached, each change shows an "Attach" button and the header shows a "Bulk Archive" button
- Auto-attach: when the bridge's activity detector identifies a `changeName` and no proposal is currently attached, automatically attach it
- Auto-name: when a proposal is attached and `session.name` is empty, set the session name to the proposal name
- Manual attach/detach via browser-to-server protocol messages
- Bulk Archive button with confirmation dialog, visible only when no proposal is attached

## Capabilities

### New Capabilities
- `proposal-attachment`: Persistent per-session proposal focus with attach/detach, auto-attach from activity detection, and auto-naming

### Modified Capabilities
- `openspec-card-section`: OpenSpec section UI changes to support attached/unattached states, filtered change display, header proposal name, Detach button, Attach buttons, and Bulk Archive button
- `shared-protocol`: New browser↔server messages for attach/detach proposal
- `session-rename`: Auto-set session name from attached proposal when name is empty

## Impact

- **Types**: `DashboardSession` gains `attachedProposal` field
- **Protocol**: New `attach_proposal` and `detach_proposal` browser→server messages; server broadcasts via `session_updated`
- **Bridge**: Auto-attach logic in activity detection flow, new `attach_proposal` message type
- **Server**: Handle attach/detach messages, persist `attachedProposal`, auto-set session name
- **Client**: `OpenSpecSection` conditional rendering based on attachment state, `SessionCard` header changes
