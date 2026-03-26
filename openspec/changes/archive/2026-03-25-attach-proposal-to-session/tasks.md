## 1. Types & Protocol

- [x] 1.1 Add `attachedProposal?: string | null` field to `DashboardSession` in `src/shared/types.ts`
- [x] 1.2 Add `AttachProposalBrowserMessage` and `DetachProposalBrowserMessage` to `src/shared/browser-protocol.ts` and include in `BrowserToServerMessage` union

## 2. Server Logic

- [x] 2.1 Handle `attach_proposal` message in server: set `session.attachedProposal`, auto-name if `session.name` is empty (send `rename_session` to extension), broadcast `session_updated`
- [x] 2.2 Handle `detach_proposal` message in server: clear `session.attachedProposal`, broadcast `session_updated` (do not revert name)
- [x] 2.3 Auto-attach on `openspec_activity_update`: when server receives activity update with both `phase` and `changeName` and session has no `attachedProposal`, set it and trigger the same attach logic (auto-name included)

## 3. Client UI

- [x] 3.1 Update `OpenSpecSection` to accept `attachedProposal` and `sessionId` props; when attached, show only the matching change and hide "Attach" buttons
- [x] 3.2 Update `OpenSpecSection` header: when attached show `OpenSpec: <name> [Detach]`; when unattached show `OpenSpec [Bulk Archive] [Refresh]`
- [x] 3.3 Add "Attach" button to each `ChangeCard` (visible only when no proposal attached); clicking sends `attach_proposal` message
- [x] 3.4 Add "Detach" button to OpenSpec header (visible only when proposal attached); clicking sends `detach_proposal` message
- [x] 3.5 Add "Bulk Archive" button to OpenSpec header with `ConfirmDialog`; sends `/opsx:bulk-archive` as `send_prompt`; visible only when no proposal attached
- [x] 3.6 Wire new props through `SessionCard` → `OpenSpecSection` and connect to WebSocket send in `SessionList`/`App`
