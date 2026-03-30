## 1. Mobile depth and detail panel

- [x] 1.1 Extend `mobileDepth` calculation in `App.tsx` to include `settingsMatch` and `tunnelSetupMatch` as depth-1 conditions
- [x] 1.2 Add `settingsMatch` and `tunnelSetupMatch` to the `MobileShell.detailPanel` rendering chain (settings → tunnel → terminal → session → landing)
- [x] 1.3 Pass `onBack={() => navigate("/")}` for ZrokInstallGuide when rendered inside MobileShell

## 2. Swipe-back reliability

- [x] 2.1 Widen swipe edge zone from 20px to 40px for real phone usability
- [x] 2.2 Move touch listeners from container element to document level so scrollable children don't intercept swipe gestures

## 3. Markdown preview on mobile

- [x] 3.1 Add `previewState` as top-level case in mobile `detailPanel` so P/S/D/T and Read buttons work without a session selected

## 4. OpenSpec commands in mobile content view

- [x] 4.1 Add OpenSpec commands (Read, Explore, Continue, FF, Apply, Verify, Archive) to mobile kebab menu when change is attached
- [x] 4.2 Add separate attach/detach icon (paperclip) in mobile session header
- [x] 4.3 Fix field name: use `session.attachedProposal` instead of `session.openspecChange`

## 5. Testing

- [x] 5.1 Unit tests for getMobileDepth helper (6 tests passing)
- [x] 5.2 Manual verification on real mobile device
