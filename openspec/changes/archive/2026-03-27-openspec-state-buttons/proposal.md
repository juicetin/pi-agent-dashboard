## Why

The OpenSpec UI uses ad-hoc logic for action button visibility in `SessionOpenSpecActions`. Buttons like Continue show when they shouldn't, Apply shows on completed changes, and Verify is missing entirely. There's no formal state model, so button visibility is fragile and inconsistent. Additionally, the folder-level OpenSpec section lacks a `+ New Change` button (users must type `/opsx:new` manually), and there's no cross-session visibility showing which sessions are working on which change.

## What Changes

- Add a shared `ChangeState` enum (`PLANNING`, `READY`, `IMPLEMENTING`, `COMPLETE`) derived from artifact completion + task progress
- Add a `deriveChangeState()` pure function in shared code
- Update button visibility in `SessionOpenSpecActions` to use derived state instead of ad-hoc checks
- Add **Verify** button for COMPLETE state
- Color the attached proposal name with `text-blue-400` for visual distinction
- Add `+ New Change` button to the **folder-level** OpenSpec section header (next to Refresh and Bulk Archive)
- Add a **NewChangeDialog** (name + description fields) triggered from folder level; sends prompt to first active session in that folder
- Show linked sessions (clickable) per change in the folder-level expanded change list

## Capabilities

### New Capabilities
- `openspec-change-state`: Shared state derivation enum and function for OpenSpec change lifecycle

### Modified Capabilities
- `openspec-attach-combo`: Update button visibility to use derived state, add Verify button, color attached name
- `openspec-folder-section`: Add + New button to header, show linked sessions per change in expanded list
- `openspec-dialogs`: Add NewChangeDialog with name and description fields

## Impact

- `src/shared/types.ts` — new enum + utility function
- `src/client/components/SessionOpenSpecActions.tsx` — button logic using derived state
- `src/client/components/FolderOpenSpecSection.tsx` — + New button, session links per change
- `src/client/components/NewChangeDialog.tsx` — new component
- `src/client/components/openspec-helpers.tsx` — may export deriveChangeState wrapper
