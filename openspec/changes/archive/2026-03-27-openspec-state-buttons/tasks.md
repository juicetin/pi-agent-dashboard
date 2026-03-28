## 1. Shared ChangeState Enum and Function

- [x] 1.1 Add `ChangeState` enum (`PLANNING`, `READY`, `IMPLEMENTING`, `COMPLETE`) to `src/shared/types.ts`
- [x] 1.2 Add `deriveChangeState(change: OpenSpecChange): ChangeState` pure function to `src/shared/types.ts`
- [x] 1.3 Write unit tests for `deriveChangeState` covering all state transitions (no artifacts, partial, all done + each status)

## 2. Session-Level Button Visibility

- [x] 2.1 Refactor `SessionOpenSpecActions` to use `deriveChangeState` instead of ad-hoc `isComplete`/`canApply` checks
- [x] 2.2 Add Verify button that sends `/opsx:verify <name>` when state is `COMPLETE`
- [x] 2.3 Color attached proposal name with `text-blue-400` in the badge
- [x] 2.4 Update `SessionOpenSpecActions` tests to verify button visibility per ChangeState

## 3. NewChangeDialog Component

- [x] 3.1 Create `NewChangeDialog.tsx` with name input and description textarea
- [x] 3.2 Implement prompt formatting: `/opsx:new <name>\n<description>` with empty field handling
- [x] 3.3 Write tests for NewChangeDialog send/cancel behavior

## 4. Folder-Level + New Button

- [x] 4.1 Add `+ New` button to `FolderOpenSpecSection` header (next to Refresh and Bulk Archive)
- [x] 4.2 Pass sessions list and `onSendPrompt` callback to `FolderOpenSpecSection`
- [x] 4.3 Wire `+ New` to open `NewChangeDialog`, targeting first active session in folder
- [x] 4.4 Disable `+ New` when no active sessions exist in folder
- [x] 4.5 Update `FolderOpenSpecSection` tests for + New button behavior

## 5. Cross-Session Links in Folder Change List

- [x] 5.1 Pass sessions list and `onNavigateToSession` callback to `FolderOpenSpecSection`
- [x] 5.2 Render clickable session indicators per change row (filter by `attachedProposal`)
- [x] 5.3 Write tests for session link rendering and click behavior
