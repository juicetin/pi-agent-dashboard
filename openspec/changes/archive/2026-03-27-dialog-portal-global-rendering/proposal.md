## Why

All dialog components (ConfirmDialog, ExploreDialog, PinDirectoryDialog) are rendered inline inside sidebar components. Despite using `fixed inset-0 z-50`, they are structurally nested inside containers with `overflow-hidden` (ResizableSidebar) and `overflow-y-auto` (SessionList, MobileOverlay sidebar panel). This causes clipping and z-index stacking context issues, especially on mobile where dialogs opened from the mobile sidebar can render behind or get clipped by the sidebar panel (which is also z-50).

## What Changes

- Create a `DialogPortal` component that uses `ReactDOM.createPortal` to render children at `document.body`, escaping all ancestor stacking contexts
- Add scroll locking when a portal dialog is open (prevents background scroll on mobile)
- Bump dialog z-index from z-50 to z-[60] so dialogs layer above MobileOverlay's z-50 sidebar panel
- Wrap all 4 dialog render sites in `<DialogPortal>`:
  - `PinDirectoryDialog` in SessionList
  - `ConfirmDialog` (bulk archive) in FolderOpenSpecSection
  - `ExploreDialog` in SessionOpenSpecActions
  - `ConfirmDialog` (archive) in SessionOpenSpecActions

## Capabilities

### New Capabilities
- `dialog-portal`: Portal-based rendering wrapper with scroll lock for global dialog display

### Modified Capabilities
- `openspec-dialogs`: Dialogs now render via portal at document.body instead of inline
- `pinned-directories-ui`: PinDirectoryDialog now renders via portal at document.body instead of inline

## Impact

- **New file**: `src/client/components/DialogPortal.tsx`
- **Modified files** (1-2 line wrap each): `SessionList.tsx`, `FolderOpenSpecSection.tsx`, `SessionOpenSpecActions.tsx`
- **Modified files** (z-index bump): `ConfirmDialog.tsx`, `ExploreDialog.tsx`, `PinDirectoryDialog.tsx`
- No API changes, no server changes, no protocol changes
