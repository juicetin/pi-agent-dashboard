## 1. Browse API Endpoint

- [ ] 1.1 Add `GET /api/browse` endpoint in `server.ts`: accept `path` query param (default to `os.homedir()`), return directory entries with `isGit`/`isPi` flags, localhost-only, cap at 200 entries
- [ ] 1.2 Add tests for browse endpoint (valid dir, default to home, non-existent dir, parent path, hidden dirs excluded, remote blocked)

## 2. FilesystemBrowser Component

- [ ] 2.1 Create `src/client/lib/browse-api.ts` with `browseDirectory(path?)` helper function
- [ ] 2.2 Create `src/client/components/FilesystemBrowser.tsx`: modal with breadcrumb path bar, directory list, parent navigation, select/cancel buttons, loading state
- [ ] 2.3 Add visual indicators for git repos and pi projects in directory entries
- [ ] 2.4 Add tests for FilesystemBrowser (renders entries, breadcrumb navigation, parent navigation, select callback, loading state)

## 3. Replace AddWorkspaceDialog

- [ ] 3.1 Modify `AddWorkspaceDialog.tsx` to use FilesystemBrowser for path selection instead of text input
- [ ] 3.2 Two-step flow: browse → confirm with name field
- [ ] 3.3 Update AddWorkspaceDialog tests

## 4. Sidebar Workspace Merge

- [ ] 4.1 Fetch workspaces from `GET /api/workspaces` in App.tsx and pass to SessionList
- [ ] 4.2 Update `groupSessionsByDirectory` in SessionList.tsx to merge DB workspaces with session-derived groups
- [ ] 4.3 Show empty workspace groups (0 sessions) with name and action buttons
- [ ] 4.4 Add "Add Folder" button at top of sidebar that opens AddWorkspaceDialog
- [ ] 4.5 Add tests for merged group logic (DB workspace + sessions, DB workspace without sessions, sessions without DB workspace)

## 5. Remove Workspace

- [ ] 5.1 Add "✕ remove" button on group headers backed by DB workspaces
- [ ] 5.2 Wire remove button to `DELETE /api/workspaces/:id` with confirmation
- [ ] 5.3 Add tests for remove button (shown for DB workspaces, hidden for auto-derived groups)
