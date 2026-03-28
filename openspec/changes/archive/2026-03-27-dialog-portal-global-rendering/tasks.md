## 1. DialogPortal Component

- [x] 1.1 Create `src/client/components/DialogPortal.tsx` — portal wrapper using `ReactDOM.createPortal` to `document.body` with scroll lock (save/restore `document.body.style.overflow`)
- [x] 1.2 Write tests for DialogPortal: renders children at body, sets overflow hidden on mount, restores overflow on unmount

## 2. Z-index Bump

- [x] 2.1 Change `ConfirmDialog.tsx` outermost div from `z-50` to `z-[60]`
- [x] 2.2 Change `ExploreDialog.tsx` outermost div from `z-50` to `z-[60]`
- [x] 2.3 Change `PinDirectoryDialog.tsx` outermost div from `z-50` to `z-[60]`

## 3. Wrap Dialog Call Sites in DialogPortal

- [x] 3.1 Wrap `PinDirectoryDialog` in `<DialogPortal>` in `SessionList.tsx`
- [x] 3.2 Wrap `ConfirmDialog` (bulk archive) in `<DialogPortal>` in `FolderOpenSpecSection.tsx`
- [x] 3.3 Wrap `ExploreDialog` in `<DialogPortal>` in `SessionOpenSpecActions.tsx`
- [x] 3.4 Wrap `ConfirmDialog` (archive) in `<DialogPortal>` in `SessionOpenSpecActions.tsx`

## 4. Verify

- [x] 4.1 Run existing dialog tests to confirm no regressions
- [x] 4.2 Run full test suite
