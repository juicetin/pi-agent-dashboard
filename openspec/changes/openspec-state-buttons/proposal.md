## Why

The OpenSpec section in the dashboard shows action buttons with ad-hoc logic that doesn't match the actual change lifecycle. Buttons like Continue show when they shouldn't, Apply shows on completed changes, and Verify is missing entirely. There's no formal state model, so button visibility is fragile and inconsistent. Additionally, the UI lacks cross-session visibility (which sessions work on which proposal), the "New Change" button is buried in the expanded body, and new sessions incorrectly inherit `attachedProposal` from ended sessions.

## What Changes

- Add a shared `ChangeState` enum (`PLANNING`, `READY`, `IMPLEMENTING`, `COMPLETE`) derived from artifact completion + task progress
- Add a `deriveChangeState()` pure function in shared code
- Update button visibility in `OpenSpecSection` to use derived state instead of ad-hoc checks
- Add **Verify** button for COMPLETE state
- Color the attached proposal name differently in the header for visual distinction
- Move "+ New Change" button from expanded body to the header bar
- Add a **New Change dialog** (name + description fields) instead of sending `/opsx:new` directly
- Disable "+ New" when a proposal is attached
- Show linked sessions (clickable, navigates to session) per change card when no proposal is attached
- Remove `attachedProposal` carry-over from ended sessions on new session registration

## Capabilities

### New Capabilities
- `openspec-change-state`: Shared state derivation enum and function for OpenSpec change lifecycle

### Modified Capabilities
- `openspec-card-section`: Update button visibility to use derived state, add Verify button, move New Change to header, color attached name, show linked sessions per change card
- `openspec-dialogs`: Add New Change dialog with name and description fields
- `proposal-attachment`: Remove attachedProposal carry-over on session spawn, disable New when attached

## Impact

- `src/shared/types.ts` — new enum + utility function
- `src/client/components/OpenSpecSection.tsx` — button logic, header layout, session links
- `src/client/components/NewChangeDialog.tsx` — new component
- `src/server/server.ts` — remove carry-over block in session_register handler
- `src/client/components/SessionCard.tsx` — pass sessions list and navigation callback to OpenSpecSection
