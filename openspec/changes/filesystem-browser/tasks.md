## 1. Browse API Endpoint

- [ ] 1.1 Add `GET /api/browse` endpoint in `server.ts`: accept `path` query param (default to `os.homedir()`), return directory entries with `isGit`/`isPi` flags, localhost-only, cap at 200 entries
- [ ] 1.2 Add tests for browse endpoint (valid dir, default to home, non-existent dir, parent path, hidden dirs excluded, remote blocked)

## 2. FilesystemBrowser Component

- [ ] 2.1 Create `src/client/lib/browse-api.ts` with `browseDirectory(path?)` helper function
- [ ] 2.2 Create `src/client/components/FilesystemBrowser.tsx`: panel with breadcrumb path bar, directory list, parent navigation, select/cancel buttons, loading state
- [ ] 2.3 Add visual indicators for git repos and pi projects in directory entries
- [ ] 2.4 Add tests for FilesystemBrowser (renders entries, breadcrumb navigation, parent navigation, select callback, loading state)

## 3. Integrate with PinDirectoryDialog

- [ ] 3.1 Add "Browse" button to `PinDirectoryDialog.tsx` that opens FilesystemBrowser
- [ ] 3.2 On selection from browser, populate the text input with the selected path
- [ ] 3.3 Update PinDirectoryDialog tests for browse integration
